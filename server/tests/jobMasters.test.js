// Job <-> master data integration: reference validation, inactive values,
// PATCH preservation, filters and the migration script logic.
import { test, before, after, beforeEach, describe } from 'node:test'
import assert from 'node:assert/strict'
import { startTestApp, seedTestMasters, clearMasters } from './fixtures.js'
import Job from '../models/Job.js'
import JobApplication from '../models/jobApplication.js'
import MasterItem from '../models/MasterItem.js'
import Location from '../models/Location.js'
import Client from '../models/Client.js'
import { runJobMasterMigration, formatReport } from '../master/migrateJobMasters.js'
import { seedMasterData } from '../master/seed.js'

let t, M
before(async () => { t = await startTestApp('surehire-jobmasters-test') })
after(async () => { await t?.stop() })
beforeEach(async () => { await clearMasters(); await Job.deleteMany({}); await JobApplication.deleteMany({}); M = await seedTestMasters() })

const base = (over = {}) => ({
    title: 'Data Engineer', description: '<p>Pipelines</p>',
    categoryId: M.category['Data Science'], employmentTypeId: M.employmentType['Full-time'], workplaceTypeId: M.workplaceType.Hybrid,
    locationIds: [M.location.Pune, M.location.Chennai], ...over,
})
const post = (body) => t.admin(t.request(t.app).post('/api/admin/jobs')).send(body)
const patch = (id, body) => t.admin(t.request(t.app).patch(`/api/admin/jobs/${id}`)).send(body)

describe('job master references', () => {
    test('valid ids: legacy text derived, multi-location label, currency code', async () => {
        const res = await post(base({ currencyId: M.currency['US Dollar'], clientId: M.client['Secret Corp'] }))
        assert.equal(res.status, 201, JSON.stringify(res.body))
        const j = res.body.job
        assert.equal(j.category, 'Data Science'); assert.equal(j.workplaceType, 'Hybrid')
        assert.equal(j.city, 'Pune'); assert.equal(j.location, 'Pune, Maharashtra, India / Chennai, Tamil Nadu, India (Hybrid)')
        assert.equal(j.currency, 'USD')
        assert.equal(j.clientName, undefined, 'confidential client name not copied to text')
        const pub = await t.request(t.app).get(`/api/jobs/${j._id}`)
        assert.equal(pub.status, 404) // draft
        await t.admin(t.request(t.app).post(`/api/admin/jobs/${j._id}/publish`))
        const pub2 = await t.request(t.app).get(`/api/jobs/${j._id}`)
        assert.equal(pub2.body.job.clientId, undefined, 'client ref hidden publicly')
    })

    test('nonexistent and malformed ids are rejected with 400', async () => {
        let res = await post(base({ categoryId: '507f1f77bcf86cd799439011' }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.categoryId)
        res = await post(base({ locationIds: ['507f1f77bcf86cd799439011'] }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.locationIds)
        res = await post(base({ skillIds: 'abc' }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.skillIds)
        // an id of the wrong master type is "not found"
        res = await post(base({ categoryId: M.employmentType.Contract }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.categoryId)
        assert.equal(await Job.countDocuments(), 0)
    })

    test('inactive values cannot be newly selected', async () => {
        await MasterItem.updateOne({ _id: M.category.Finance }, { active: false })
        await Location.updateOne({ _id: M.location.Mumbai }, { active: false })
        let res = await post(base({ categoryId: M.category.Finance }))
        assert.equal(res.status, 400); assert.match(res.body.errors.categoryId, /inactive/)
        res = await post(base({ locationIds: [M.location.Mumbai] }))
        assert.equal(res.status, 400); assert.match(res.body.errors.locationIds, /inactive/)
    })

    test('an unchanged inactive reference is kept on edit; PATCH preserves unrelated refs', async () => {
        const created = (await post(base({ skillIds: [M.skill.Selenium], clientId: M.client['Acme Refineries'] }))).body.job
        await MasterItem.updateOne({ _id: M.category['Data Science'] }, { active: false, name: 'Data Science (old)' })
        await Location.updateOne({ _id: M.location.Pune }, { active: false })
        // edit form resends the unchanged inactive values
        let res = await patch(created._id, { title: 'Senior Data Engineer', categoryId: M.category['Data Science'], locationIds: [M.location.Pune, M.location.Chennai] })
        assert.equal(res.status, 200, JSON.stringify(res.body))
        const j = res.body.job
        assert.equal(j.category, 'Data Science', 'label not rewritten when unchanged')
        assert.equal(String(j.categoryId), M.category['Data Science'])
        assert.deepEqual(j.skillIds.map(String), [M.skill.Selenium])
        assert.equal(String(j.clientId), M.client['Acme Refineries'])
        // adding an inactive location is not allowed
        res = await patch(created._id, { locationIds: [M.location.Chennai, M.location.Pune] })
        assert.equal(res.status, 200, 'same set reordered still contains only pre-existing ids')
        await Location.updateOne({ _id: M.location.Mumbai }, { active: false })
        res = await patch(created._id, { locationIds: [M.location.Chennai, M.location.Mumbai] })
        assert.equal(res.status, 400)
        // workplace change re-labels location
        res = await patch(created._id, { workplaceTypeId: M.workplaceType['On-site'] })
        assert.equal(res.status, 200); assert.ok(!res.body.job.location.includes('Hybrid'))
    })

    test('legacy text in the admin payload is ignored (masters only) and masters are never auto-created', async () => {
        const before = await MasterItem.countDocuments()
        const res = await post({ ...base(), category: 'Brand New Category', employmentType: 'Weird' })
        assert.equal(res.status, 201)
        assert.equal(res.body.job.category, 'Data Science')
        assert.equal(await MasterItem.countDocuments(), before)
    })

    test('admin list filters by master id with legacy text fallback', async () => {
        await post(base({ title: 'A' }))
        await post(base({ title: 'B', categoryId: M.category.Finance }))
        await Job.collection.insertOne({ title: 'Legacy', description: '<p>x</p>', category: 'Finance', location: 'Pune', level: 'x', salary: 1, date: Date.now() })
        let res = await t.admin(t.request(t.app).get('/api/admin/jobs').query({ categoryId: M.category.Finance, sort: 'title', order: 'asc' }))
        assert.equal(res.status, 200)
        assert.deepEqual(res.body.items.map(i => i.title), ['B', 'Legacy'])
        res = await t.admin(t.request(t.app).get('/api/admin/jobs').query({ locationId: M.location.Chennai }))
        assert.equal(res.body.total, 2)
    })
})

describe('migration (memory DB)', () => {
    const legacy = (over) => ({ description: '<p>x</p>', level: 'x', salary: 1, date: Date.now(), ...over })
    const seedLegacyJobs = async () => {
        await Job.collection.insertMany([
            legacy({ title: 'L1', category: 'programming', location: 'Bangalore', level: 'Senior level', employmentType: 'Full-time' }),
            legacy({ title: 'L2', category: 'Programming', location: 'Pune', level: 'Intermediate level', skills: ['AutoCAD', 'Kotlin'] }),
            legacy({ title: 'L3', category: 'Robotics', location: 'Pune / Mumbai', level: 'Senior level', clientName: 'Initech' }),
            legacy({ title: 'L4', category: 'Programming', location: 'Remote', workplaceType: 'Remote', level: 'Not specified' }),
            legacy({ title: 'L5', category: 'Finance', location: 'Bangalore', level: 'Senior level', categoryId: M.category.Sales }),
        ])
    }

    test('dry run writes nothing and reports mappings/ambiguity', async () => {
        await seedLegacyJobs()
        const snap = JSON.stringify(await Job.find().sort({ title: 1 }).lean())
        const masters = await MasterItem.countDocuments() + await Location.countDocuments() + await Client.countDocuments()
        const r = await runJobMasterMigration({ apply: false })
        assert.equal(JSON.stringify(await Job.find().sort({ title: 1 }).lean()), snap)
        assert.equal(await MasterItem.countDocuments() + await Location.countDocuments() + await Client.countDocuments(), masters)
        const row = (f, v) => r.rows.find(x => x.field === f && x.value.toLowerCase() === v.toLowerCase())
        assert.equal(row('category', 'Programming').count, 3)
        assert.equal(row('category', 'Programming').action, 'link')
        assert.equal(row('category', 'Robotics').action, 'create')
        assert.equal(row('location', 'Pune').action, 'link')
        assert.equal(row('location', 'Bangalore').action, 'create')
        assert.equal(row('location', 'Pune / Mumbai').ambiguous, true)
        assert.equal(row('location', 'Remote').action, 'skip')
        assert.equal(row('category', 'Finance').linked, 1, 'already linked jobs are counted, not changed')
        assert.ok(!r.rows.some(x => x.value === 'Not specified'), 'placeholders ignored')
        assert.match(formatReport(r), /Robotics/)
    })

    test('ambiguous bare city (several locations) is not linked', async () => {
        await Location.create({ name: 'Pune Cantonment', city: 'Pune', state: 'MH', country: 'IN', key: 'pune|mh|in' })
        await Job.collection.insertOne(legacy({ title: 'X', category: 'Programming', location: 'Pune' }))
        const r = await runJobMasterMigration({ apply: true })
        assert.equal(r.rows.find(x => x.field === 'location').ambiguous, true)
        assert.equal((await Job.findOne({ title: 'X' }).lean()).locationIds?.length || 0, 0)
    })

    test('apply links jobs, creates missing masters, preserves text/apps/counts and is idempotent', async () => {
        await seedLegacyJobs()
        const job = await Job.findOne({ title: 'L2' }).lean()
        await JobApplication.create({ userId: 'u1', companyId: null, jobId: job._id, status: 'Accepted', date: 5 })
        const r = await runJobMasterMigration({ apply: true })
        assert.deepEqual(r.before, r.after)
        assert.ok(r.created >= 3) // Robotics, Bangalore, Kotlin, Initech, Full-time? (exists)
        const l1 = await Job.findOne({ title: 'L1' }).lean()
        assert.equal(String(l1.categoryId), M.category.Programming)
        assert.equal(String(l1.experienceLevelId), M.level['Senior level'])
        assert.equal(String(l1.employmentTypeId), M.employmentType['Full-time'])
        assert.equal(l1.category, 'programming', 'legacy text untouched')
        const l2 = await Job.findOne({ title: 'L2' }).lean()
        assert.deepEqual(l2.locationIds.map(String), [M.location.Pune])
        assert.equal(l2.skillIds.length, 2)
        const l3 = await Job.findOne({ title: 'L3' }).lean()
        assert.equal(l3.locationIds?.length || 0, 0, 'ambiguous location left alone')
        assert.ok(l3.clientId)
        assert.ok(await Client.exists({ name: 'Initech', code: 'INITECH' }))
        const l5 = await Job.findOne({ title: 'L5' }).lean()
        assert.equal(String(l5.categoryId), M.category.Sales, 'existing ref not overwritten')
        assert.equal((await JobApplication.findOne().lean()).status, 'Accepted')

        const snap = JSON.stringify(await Job.find().sort({ title: 1 }).lean())
        const r2 = await runJobMasterMigration({ apply: true })
        assert.equal(r2.created, 0)
        assert.equal(JSON.stringify(await Job.find().sort({ title: 1 }).lean()), snap)
    })

    test('seed is idempotent and never changes edited records', async () => {
        await MasterItem.updateOne({ _id: M.category.Finance }, { active: false, description: 'edited' })
        const r = await seedMasterData()
        assert.equal(r.created, 0)
        const fin = await MasterItem.findById(M.category.Finance).lean()
        assert.equal(fin.active, false); assert.equal(fin.description, 'edited')
    })
})
