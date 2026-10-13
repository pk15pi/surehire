// Job management API tests. Uses an in-memory MongoDB (mongodb-memory-server);
// never connects to the real database.  Run: npm test
import { test, before, after, beforeEach, describe } from 'node:test'
import assert from 'node:assert/strict'

// Test-only configuration (set before the app is imported)
process.env.ADMIN_EMAILS = 'admin@test.local'
process.env.ADMIN_PASSWORD = 'test-password-123456'
process.env.ADMIN_JWT_SECRET = 'test-admin-secret-'.padEnd(48, 'x')
process.env.JWT_SECRET = 'test-recruiter-secret-'.padEnd(48, 'y')
delete process.env.ADMIN_PASSWORD_HASH

const { MongoMemoryServer } = await import('mongodb-memory-server')
const mongoose = (await import('mongoose')).default
const request = (await import('supertest')).default
const jwt = (await import('jsonwebtoken')).default
const { createApp } = await import('../app.js')
const Job = (await import('../models/Job.js')).default
const JobApplication = (await import('../models/jobApplication.js')).default
const Company = (await import('../models/Company.js')).default

let mongod, app, adminToken, company, companyToken, otherCompanyToken

const validJob = (over = {}) => ({
    title: 'Senior Piping Engineer',
    description: '<p>Design piping systems.</p><script>alert(1)</script><img src=x onerror="alert(2)">',
    category: 'Engineering',
    employmentType: 'Full-time',
    workplaceType: 'On-site',
    city: 'Pune', state: 'Maharashtra', country: 'India',
    salaryMin: 1200000, salaryMax: 1800000, salaryPeriod: 'Annual',
    experienceMin: 5, experienceMax: 10, experienceLevel: 'Senior level',
    vacancies: 2,
    skills: ['AutoCAD', 'PDMS', 'autocad'],
    screeningQuestions: ['Notice period?'],
    clientName: 'Acme Refineries',
    internalNotes: 'Client pays 8.33%',
    ...over,
})

const admin = (r) => r.set('Authorization', `Bearer ${adminToken}`)
const createJob = async (over) => {
    const res = await admin(request(app).post('/api/admin/jobs')).send(validJob(over))
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body.job
}

before(async () => {
    mongod = await MongoMemoryServer.create()
    await mongoose.connect(mongod.getUri(), { dbName: 'surehire-test' })
    await Job.init() // build unique indexes before tests rely on them
    app = createApp({ clerk: false })
    const login = await request(app).post('/api/admin/login').send({ email: 'admin@test.local', password: 'test-password-123456' })
    assert.equal(login.status, 200)
    adminToken = login.body.token
    company = await Company.create({ name: 'RecruitCo', email: 'r@co.test', image: 'http://img', password: 'x' })
    const other = await Company.create({ name: 'Other', email: 'o@co.test', image: 'http://img', password: 'x' })
    companyToken = jwt.sign({ id: company._id }, process.env.JWT_SECRET)
    otherCompanyToken = jwt.sign({ id: other._id }, process.env.JWT_SECRET)
})

after(async () => {
    await mongoose.connection.dropDatabase().catch(() => {})
    await mongoose.disconnect()
    await mongod?.stop()
})

beforeEach(async () => {
    await Job.deleteMany({})
    await JobApplication.deleteMany({})
})

describe('admin job management', () => {
    test('1. creates a job with valid data (sanitized, derived fields, ref id)', async () => {
        const job = await createJob()
        assert.match(job.referenceId, /^SH-JOB-\d{6}-[A-Z0-9]{4}$/)
        assert.equal(job.status, 'draft')
        assert.equal(job.visible, false)
        assert.equal(job.location, 'Pune, Maharashtra, India')
        assert.equal(job.level, 'Senior level')
        assert.equal(job.salary, 1800000)
        assert.equal(job.currency, 'INR')
        assert.deepEqual(job.skills, ['AutoCAD', 'PDMS'])
        assert.ok(!job.description.includes('<script'), 'script stripped')
        assert.ok(!job.description.includes('onerror'), 'handlers stripped')
        assert.equal(job.internalNotes, 'Client pays 8.33%')
    })

    test('2. rejects invalid data with 400 and field errors', async () => {
        const res = await admin(request(app).post('/api/admin/jobs')).send({ title: '', description: '<p><br></p>', employmentType: 'Weekly', vacancies: 0, workplaceType: 'On-site' })
        assert.equal(res.status, 400)
        assert.equal(res.body.success, false)
        for (const f of ['title', 'description', 'employmentType', 'vacancies', 'city']) assert.ok(res.body.errors[f], `error for ${f}`)
        assert.equal(await Job.countDocuments(), 0)
    })

    test('remote job does not require city', async () => {
        const job = await createJob({ workplaceType: 'Remote', city: '', state: '', country: '' })
        assert.equal(job.location, 'Remote')
    })

    test('3/4/5/6. edits with PATCH: only provided fields change, persisted and retrievable', async () => {
        const job = await createJob()
        const res = await admin(request(app).patch(`/api/admin/jobs/${job._id}`)).send({ title: 'Lead Piping Engineer', vacancies: 3 })
        assert.equal(res.status, 200, JSON.stringify(res.body))
        assert.equal(res.body.job.title, 'Lead Piping Engineer')

        const got = await admin(request(app).get(`/api/admin/jobs/${job._id}`))
        assert.equal(got.status, 200)
        const j = got.body.job
        assert.equal(j.title, 'Lead Piping Engineer')
        assert.equal(j.vacancies, 3)
        // untouched fields preserved
        assert.equal(j.clientName, 'Acme Refineries')
        assert.equal(j.salaryMin, 1200000)
        assert.deepEqual(j.skills, ['AutoCAD', 'PDMS'])
        assert.equal(j.internalNotes, 'Client pays 8.33%')
        assert.equal(j.referenceId, job.referenceId)
        assert.equal(j.applicationCount, 0)
        // persisted in the DB
        const raw = await Job.findById(job._id).lean()
        assert.equal(raw.title, 'Lead Piping Engineer')
        assert.equal(raw.city, 'Pune')
    })

    test('PATCH can clear an optional field and re-derives location', async () => {
        const job = await createJob()
        const res = await admin(request(app).patch(`/api/admin/jobs/${job._id}`)).send({ clientName: '', workplaceType: 'Remote' })
        assert.equal(res.status, 200)
        assert.equal(res.body.job.clientName, undefined)
        assert.match(res.body.job.location, /^Remote/)
    })

    test('7. publish and unpublish', async () => {
        const job = await createJob()
        let res = await admin(request(app).post(`/api/admin/jobs/${job._id}/publish`))
        assert.equal(res.status, 200)
        assert.equal(res.body.job.status, 'published')
        let pub = await request(app).get(`/api/jobs/${job._id}`)
        assert.equal(pub.status, 200)
        assert.equal(pub.body.job.internalNotes, undefined, 'internal notes never public')
        assert.equal((await request(app).get('/api/jobs')).body.jobs.length, 1)

        res = await admin(request(app).post(`/api/admin/jobs/${job._id}/unpublish`))
        assert.equal(res.body.job.status, 'draft')
        pub = await request(app).get(`/api/jobs/${job._id}`)
        assert.equal(pub.status, 404)
        assert.equal((await request(app).get('/api/jobs')).body.jobs.length, 0)
    })

    test('duplicate creates a draft with a new reference ID', async () => {
        const job = await createJob({ status: 'published' })
        const res = await admin(request(app).post(`/api/admin/jobs/${job._id}/duplicate`))
        assert.equal(res.status, 201)
        assert.notEqual(res.body.job.referenceId, job.referenceId)
        assert.equal(res.body.job.status, 'draft')
        assert.equal(res.body.job.clientName, 'Acme Refineries')
    })

    test('list: search, filter, sort, pagination and application counts', async () => {
        const a = await createJob({ title: 'Alpha Welder', status: 'published', employmentType: 'Contract' })
        await createJob({ title: 'Beta Fitter' })
        await createJob({ title: 'Gamma Rigger', city: 'Mumbai' })
        await JobApplication.create({ userId: 'u1', companyId: null, jobId: a._id, date: Date.now() })
        await JobApplication.create({ userId: 'u2', companyId: null, jobId: a._id, date: Date.now() })

        let res = await admin(request(app).get('/api/admin/jobs').query({ q: 'mumbai' }))
        assert.equal(res.status, 200)
        assert.deepEqual(res.body.items.map(i => i.title), ['Gamma Rigger'])

        res = await admin(request(app).get('/api/admin/jobs').query({ status: 'published' }))
        assert.deepEqual(res.body.items.map(i => i.title), ['Alpha Welder'])
        assert.equal(res.body.items[0].applicationCount, 2)

        res = await admin(request(app).get('/api/admin/jobs').query({ employmentType: 'Contract' }))
        assert.equal(res.body.total, 1)

        res = await admin(request(app).get('/api/admin/jobs').query({ sort: 'title', order: 'asc', limit: 2, page: 2 }))
        assert.equal(res.body.total, 3)
        assert.equal(res.body.pages, 2)
        assert.deepEqual(res.body.items.map(i => i.title), ['Gamma Rigger'])

        res = await admin(request(app).get('/api/admin/jobs').query({ status: 'bogus' }))
        assert.equal(res.status, 400)
    })

    test('legacy job without status/referenceId is listed as published and public', async () => {
        const legacy = await Job.collection.insertOne({ title: 'Legacy', description: '<p>x</p>', location: 'Bangalore', category: 'Programming', level: 'Senior level', salary: 100000, date: Date.now(), visible: true, companyId: company._id })
        const pub = await request(app).get(`/api/jobs/${legacy.insertedId}`)
        assert.equal(pub.status, 200)
        assert.equal(pub.body.job.companyId.name, 'RecruitCo')
        assert.equal(pub.body.job.companyId.password, undefined)
        const list = await admin(request(app).get('/api/admin/jobs').query({ status: 'published' }))
        assert.equal(list.body.items[0].status, 'published')
        // first edit assigns a reference id without touching the legacy fields
        const res = await admin(request(app).patch(`/api/admin/jobs/${legacy.insertedId}`)).send({ department: 'IT' })
        assert.equal(res.status, 200)
        assert.match(res.body.job.referenceId, /^SH-JOB-/)
        assert.equal(res.body.job.location, 'Bangalore')
        assert.equal(res.body.job.salary, 100000)
    })
})

describe('authorization', () => {
    test('8. unauthenticated users cannot create or modify jobs (401)', async () => {
        const job = await createJob()
        assert.equal((await request(app).post('/api/admin/jobs').send(validJob())).status, 401)
        assert.equal((await request(app).patch(`/api/admin/jobs/${job._id}`).send({ title: 'x' })).status, 401)
        assert.equal((await request(app).post(`/api/admin/jobs/${job._id}/publish`)).status, 401)
        assert.equal((await request(app).delete(`/api/admin/jobs/${job._id}`)).status, 401)
        // a recruiter token is not an admin token
        const res = await request(app).post('/api/admin/jobs').set('Authorization', `Bearer ${companyToken}`).send(validJob())
        assert.equal(res.status, 401)
        assert.equal((await Job.findById(job._id).lean()).title, 'Senior Piping Engineer')
    })

    test('9. public users cannot view draft, archived, scheduled or expired jobs', async () => {
        const draft = await createJob()
        const archived = await createJob({ status: 'published' })
        await admin(request(app).post(`/api/admin/jobs/${archived._id}/archive`))
        const scheduled = await createJob({ status: 'published', publishAt: new Date(Date.now() + 86400000).toISOString() })
        const expired = await Job.create({ ...validJob(), location: 'x', level: 'x', salary: 0, date: Date.now(), status: 'published', expiresAt: new Date(Date.now() - 1000) })
        for (const j of [draft, archived, scheduled, expired]) {
            assert.equal((await request(app).get(`/api/jobs/${j._id}`)).status, 404)
        }
        assert.equal((await request(app).get('/api/jobs')).body.jobs.length, 0)
    })

    test('10. nonexistent / invalid job ids return 404 / 400', async () => {
        const missing = new mongoose.Types.ObjectId()
        assert.equal((await admin(request(app).get(`/api/admin/jobs/${missing}`))).status, 404)
        assert.equal((await admin(request(app).patch(`/api/admin/jobs/${missing}`)).send({ title: 'x' })).status, 404)
        assert.equal((await admin(request(app).get('/api/admin/jobs/not-an-id'))).status, 400)
        assert.equal((await request(app).get(`/api/jobs/${missing}`)).status, 404)
        assert.equal((await request(app).get('/api/jobs/not-an-id')).status, 404)
    })

    test('recruiter cannot change another company\'s application status or job visibility', async () => {
        const job = await Job.create({ title: 'R', description: '<p>x</p>', location: 'Pune', category: 'c', level: 'l', salary: 1, date: Date.now(), companyId: company._id })
        const appDoc = await JobApplication.create({ userId: 'u1', companyId: company._id, jobId: job._id, date: Date.now() })

        let res = await request(app).post('/api/company/change-status').set('token', otherCompanyToken).send({ id: appDoc._id, status: 'Accepted' })
        assert.equal(res.body.success, false)
        assert.equal((await JobApplication.findById(appDoc._id).lean()).status, 'Pending')

        res = await request(app).post('/api/company/change-visiblity').set('token', otherCompanyToken).send({ id: job._id })
        assert.equal(res.body.success, false)
        assert.equal((await Job.findById(job._id).lean()).visible, true)

        res = await request(app).post('/api/company/change-status').set('token', companyToken).send({ id: appDoc._id, status: 'Accepted' })
        assert.equal(res.body.success, true)
        assert.equal((await JobApplication.findById(appDoc._id).lean()).status, 'Accepted')

        res = await request(app).post('/api/company/change-visiblity').set('token', companyToken).send({ id: job._id })
        assert.equal(res.body.success, true)
        assert.equal((await Job.findById(job._id).lean()).visible, false)
    })

    test('recruiter post-job still works and sanitizes the description', async () => {
        const res = await request(app).post('/api/company/post-job').set('token', companyToken)
            .send({ title: 'Recruiter job', description: '<p>Hi</p><script>x()</script>', location: 'Bangalore', salary: 50000, level: 'Beginner level', category: 'Programming' })
        assert.equal(res.body.success, true, JSON.stringify(res.body))
        assert.equal(res.body.newJob.description, '<p>Hi</p>')
        const list = await request(app).get('/api/company/list-job').set('token', companyToken)
        assert.equal(list.body.jobsData.length, 1)
        assert.equal(list.body.jobsData[0].applicants, 0)
        assert.equal((await request(app).get(`/api/jobs/${res.body.newJob._id}`)).status, 200)
    })
})

describe('validation and integrity', () => {
    test('11. duplicate referenceId is rejected with 409', async () => {
        const job = await createJob({ referenceId: 'SH-JOB-261013-AB12' })
        assert.equal(job.referenceId, 'SH-JOB-261013-AB12')
        let res = await admin(request(app).post('/api/admin/jobs')).send(validJob({ referenceId: 'sh-job-261013-ab12' }))
        assert.equal(res.status, 409)
        const other = await createJob()
        res = await admin(request(app).patch(`/api/admin/jobs/${other._id}`)).send({ referenceId: 'SH-JOB-261013-AB12' })
        assert.equal(res.status, 409)
        res = await admin(request(app).post('/api/admin/jobs')).send(validJob({ referenceId: 'JOB-1' }))
        assert.equal(res.status, 400)
        assert.ok(res.body.errors.referenceId)
    })

    test('12. invalid salary / experience / date ranges are rejected with 400', async () => {
        let res = await admin(request(app).post('/api/admin/jobs')).send(validJob({ salaryMin: 200, salaryMax: 100 }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.salaryMax)
        res = await admin(request(app).post('/api/admin/jobs')).send(validJob({ experienceMin: 8, experienceMax: 2 }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.experienceMax)
        res = await admin(request(app).post('/api/admin/jobs')).send(validJob({ publishAt: '2026-12-10', expiresAt: '2026-12-01' }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.expiresAt)
        res = await admin(request(app).post('/api/admin/jobs')).send(validJob({ applicationDeadline: 'not-a-date' }))
        assert.equal(res.status, 400); assert.ok(res.body.errors.applicationDeadline)
        // PATCH is validated against the stored values too
        const job = await createJob()
        res = await admin(request(app).patch(`/api/admin/jobs/${job._id}`)).send({ salaryMax: 1000 })
        assert.equal(res.status, 400); assert.ok(res.body.errors.salaryMax)
        // undisclosed salary skips the range check and hides salary publicly
        res = await admin(request(app).patch(`/api/admin/jobs/${job._id}`)).send({ salaryUndisclosed: true, status: 'published' })
        assert.equal(res.status, 200)
        const pub = await request(app).get(`/api/jobs/${job._id}`)
        assert.equal(pub.body.job.salaryMin, undefined)
        assert.equal(pub.body.job.salary, undefined)
    })

    test('13. existing applications are preserved after edit and archive', async () => {
        const job = await createJob({ status: 'published' })
        const a = await JobApplication.create({ userId: 'u1', companyId: null, jobId: job._id, status: 'Accepted', date: 123 })
        await admin(request(app).patch(`/api/admin/jobs/${job._id}`)).send({ title: 'Changed' })
        const res = await admin(request(app).post(`/api/admin/jobs/${job._id}/archive`))
        assert.equal(res.status, 200)
        assert.equal(res.body.job.status, 'archived')
        assert.equal(res.body.job.visible, false)
        const after = await JobApplication.findById(a._id).lean()
        assert.equal(after.status, 'Accepted')
        assert.equal(after.date, 123)
        assert.equal(String(after.jobId), String(job._id))
        assert.equal(await JobApplication.countDocuments(), 1)
        assert.equal((await request(app).get(`/api/jobs/${job._id}`)).status, 404)
    })

    test('14. delete is blocked when applications exist, allowed otherwise', async () => {
        const job = await createJob()
        await JobApplication.create({ userId: 'u1', companyId: null, jobId: job._id, date: Date.now() })
        let res = await admin(request(app).delete(`/api/admin/jobs/${job._id}`))
        assert.equal(res.status, 409)
        assert.ok(await Job.exists({ _id: job._id }))

        const empty = await createJob()
        res = await admin(request(app).delete(`/api/admin/jobs/${empty._id}`))
        assert.equal(res.status, 200)
        assert.equal(await Job.exists({ _id: empty._id }), null)
    })
})
