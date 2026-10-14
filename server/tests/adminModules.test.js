// Dashboard, candidates, applications and audit-log admin endpoints.
import { test, before, after, beforeEach, describe } from 'node:test'
import assert from 'node:assert/strict'
import { startTestApp, seedTestMasters, clearMasters } from './fixtures.js'
import Job from '../models/Job.js'
import JobApplication from '../models/jobApplication.js'
import User from '../models/User.js'
import AuditLog from '../models/AuditLog.js'

let t, M
before(async () => { t = await startTestApp('surehire-modules-test') })
after(async () => { await t?.stop() })
beforeEach(async () => {
    await clearMasters(); await Job.deleteMany({}); await JobApplication.deleteMany({}); await User.deleteMany({}); await AuditLog.deleteMany({})
    M = await seedTestMasters()
})
const get = (p, q = {}) => t.admin(t.request(t.app).get(`/api/admin${p}`).query(q))

const fixture = async () => {
    await User.create({ _id: 'user_a', name: 'Asha Rao', email: 'asha@x.test', image: 'i', resume: 'http://r' })
    await User.create({ _id: 'user_b', name: 'Bilal Khan', email: 'bilal@x.test', image: 'i', resume: '' })
    const job = await Job.create({ title: 'Welder', description: '<p>x</p>', category: 'c', location: 'Pune', level: 'l', salary: 1, date: Date.now(), status: 'published', applicationDeadline: new Date(Date.now() + 3 * 86400000) })
    await Job.create({ title: 'Draft', description: '<p>x</p>', category: 'c', location: 'Pune', level: 'l', salary: 1, date: Date.now(), status: 'draft', visible: false })
    const a1 = await JobApplication.create({ userId: 'user_a', companyId: null, jobId: job._id, date: Date.now() })
    await JobApplication.create({ userId: 'user_b', companyId: null, jobId: job._id, status: 'Rejected', date: Date.now() - 30 * 86400000 })
    return { job, a1 }
}

describe('dashboard', () => {
    test('empty database returns zeros, not made-up numbers', async () => {
        await clearMasters()
        const res = await get('/dashboard')
        assert.equal(res.status, 200)
        assert.equal(res.body.metrics.jobs.total, 0)
        assert.equal(res.body.metrics.applications.total, 0)
        assert.equal(res.body.metrics.clients.active, 0)
        assert.deepEqual(res.body.upcomingDeadlines, [])
    })
    test('reports live counts', async () => {
        await fixture()
        const m = (await get('/dashboard')).body
        assert.deepEqual(m.metrics.jobs, { total: 2, published: 1, draft: 1, archived: 0, expired: 0 })
        assert.equal(m.metrics.candidates.total, 2)
        assert.deepEqual(m.metrics.applications, { total: 2, pending: 1, last7Days: 1 })
        assert.equal(m.metrics.clients.active, 2)
        assert.equal(m.upcomingDeadlines.length, 1)
    })
    test('requires admin auth', async () => {
        for (const p of ['/dashboard', '/candidates', '/applications', '/audit-logs']) {
            assert.equal((await t.request(t.app).get(`/api/admin${p}`)).status, 401, p)
        }
    })
})

describe('candidates and applications', () => {
    test('candidate list search/pagination and detail', async () => {
        await fixture()
        let res = await get('/candidates', { q: 'bilal' })
        assert.equal(res.body.total, 1); assert.equal(res.body.items[0].applicationCount, 1); assert.equal(res.body.items[0].hasResume, false)
        res = await get('/candidates', { limit: 1, page: 2 })
        assert.equal(res.body.items.length, 1); assert.equal(res.body.pages, 2)
        res = await get('/candidates/user_a')
        assert.equal(res.body.candidate.name, 'Asha Rao'); assert.equal(res.body.applications[0].jobId.title, 'Welder')
        assert.equal((await get('/candidates/nobody')).status, 404)
    })

    test('application list filters and status change (audited)', async () => {
        const { a1 } = await fixture()
        let res = await get('/applications', { status: 'Pending' })
        assert.equal(res.body.total, 1); assert.equal(res.body.items[0].userId.name, 'Asha Rao')
        assert.equal((await get('/applications', { q: 'welder' })).body.total, 2)
        assert.equal((await get('/applications', { since: '7d' })).body.total, 1)
        assert.equal((await get('/applications', { status: 'Bogus' })).status, 400)
        res = await t.admin(t.request(t.app).patch(`/api/admin/applications/${a1._id}`)).send({ status: 'Accepted' })
        assert.equal(res.status, 200); assert.equal(res.body.item.status, 'Accepted')
        assert.equal((await t.admin(t.request(t.app).patch(`/api/admin/applications/${a1._id}`)).send({ status: 'Hired' })).status, 400)
        assert.equal((await t.request(t.app).patch(`/api/admin/applications/${a1._id}`).send({ status: 'Rejected' })).status, 401)
        await new Promise(r => setTimeout(r, 50))
        const logs = await get('/audit-logs', { entityType: 'application' })
        assert.equal(logs.body.total, 1); assert.deepEqual(logs.body.items[0].meta, { from: 'Pending', to: 'Accepted' })
        assert.equal(logs.body.items[0].actor, 'admin@test.local')
    })

    test('audit logs never contain secrets', async () => {
        await t.admin(t.request(t.app).post('/api/admin/master/clients')).send({ name: 'Hush', code: 'HSH', internalNotes: 'top secret' })
        await new Promise(r => setTimeout(r, 50))
        const raw = JSON.stringify(await AuditLog.find().lean())
        assert.ok(!raw.includes('top secret'))
        assert.ok(!raw.includes('test-password'))
    })
})
