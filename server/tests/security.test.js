// Security / audit regression tests (in-memory MongoDB only). Run: npm test
import { test, before, after, beforeEach, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.ADMIN_EMAILS = 'admin@test.local'
process.env.ADMIN_PASSWORD = 'test-password-123456'
process.env.ADMIN_JWT_SECRET = 'test-admin-secret-'.padEnd(48, 'x')
process.env.JWT_SECRET = 'test-recruiter-secret-'.padEnd(48, 'y')
process.env.CLERK_WEBHOOK_SECRET = 'whsec_' + Buffer.from('test-webhook-secret-0123456789abcdef').toString('base64')
delete process.env.ADMIN_PASSWORD_HASH

const { MongoMemoryServer } = await import('mongodb-memory-server')
const mongoose = (await import('mongoose')).default
const request = (await import('supertest')).default
const bcrypt = (await import('bcrypt')).default
const express = (await import('express')).default
const { Webhook } = await import('svix')
const { createApp } = await import('../app.js')
const Job = (await import('../models/Job.js')).default
const JobApplication = (await import('../models/jobApplication.js')).default
const Company = (await import('../models/Company.js')).default
const User = (await import('../models/User.js')).default

let mongod, app, adminToken

// Wraps the real app with a fake Clerk session (req.auth) for candidate routes
const asUser = (userId) => {
    const outer = express()
    outer.set('trust proxy', 1)
    outer.use((req, res, next) => { req.auth = () => ({ userId }); next() })
    outer.use(createApp({ clerk: false }))
    return outer
}

const publishedJob = (over = {}) => Job.create({
    title: 'Piping Engineer', description: '<p>x</p>', location: 'Pune', category: 'Engineering',
    level: 'Senior level', salary: 0, date: Date.now(), status: 'published', visible: true, ...over,
})

before(async () => {
    mongod = await MongoMemoryServer.create()
    await mongoose.connect(mongod.getUri(), { dbName: 'surehire-sec-test' })
    app = createApp({ clerk: false })
    const login = await request(app).post('/api/admin/login').send({ email: 'admin@test.local', password: 'test-password-123456' })
    adminToken = login.body.token
    await Company.create({ name: 'RecruitCo', email: 'r@co.test', image: 'http://img', password: await bcrypt.hash('correct-horse-1', 4) })
    await User.create({ _id: 'user_1', name: 'Cand One', email: 'c1@test.local', image: 'http://img', resume: 'http://cv.pdf' })
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

describe('recruiter login hardening', () => {
    test('unknown email and wrong password give the same generic message', async () => {
        const a = await request(app).post('/api/company/login').send({ email: 'nobody@co.test', password: 'whatever-1' })
        const b = await request(app).post('/api/company/login').send({ email: 'r@co.test', password: 'wrong-pass-1' })
        assert.equal(a.body.success, false)
        assert.equal(a.body.message, 'Invalid email or password')
        assert.equal(b.body.message, 'Invalid email or password')
    })
    test('NoSQL operator objects are rejected, not queried', async () => {
        const res = await request(app).post('/api/company/login').send({ email: { $ne: null }, password: { $ne: null } })
        assert.equal(res.body.success, false)
        assert.ok(!res.body.token)
        assert.doesNotMatch(res.body.message, /Cannot|undefined|null/)
    })
    test('valid recruiter credentials still work', async () => {
        const res = await request(app).post('/api/company/login').send({ email: 'r@co.test', password: 'correct-horse-1' })
        assert.equal(res.body.success, true)
        assert.ok(res.body.token)
    })
    test('invalid recruiter token returns generic message', async () => {
        const res = await request(app).get('/api/company/company').set('token', 'garbage')
        assert.equal(res.body.message, 'Not Authorized, Login Again')
    })
})

describe('candidate routes require a Clerk session', () => {
    for (const [method, path] of [['get', '/api/users/user'], ['get', '/api/users/applications'], ['post', '/api/users/apply'], ['post', '/api/users/update-resume']]) {
        test(`${method.toUpperCase()} ${path} -> 401 when signed out`, async () => {
            const res = await request(app)[method](path)
            assert.equal(res.status, 401)
        })
    }
    test('resume upload rejects non-PDF files', async () => {
        const res = await request(asUser('user_1')).post('/api/users/update-resume').attach('resume', Buffer.from('hello'), { filename: 'cv.exe', contentType: 'application/octet-stream' })
        assert.equal(res.status, 400)
        assert.match(res.body.message, /PDF/)
    })
})

describe('screening questions and admin applications', () => {
    test('apply requires answers when the job has screening questions; admin sees the application', async () => {
        const job = await publishedJob({ screeningQuestions: ['Notice period?', 'Current CTC?'] })
        const u = asUser('user_1')
        let res = await request(u).post('/api/users/apply').send({ jobId: String(job._id) })
        assert.equal(res.body.success, false)
        assert.match(res.body.message, /screening/)
        res = await request(u).post('/api/users/apply').send({ jobId: String(job._id), answers: ['30 days', ' '] })
        assert.equal(res.body.success, false)
        res = await request(u).post('/api/users/apply').send({ jobId: String(job._id), answers: ['30 days', '12 LPA'] })
        assert.equal(res.body.success, true, JSON.stringify(res.body))

        const list = await request(app).get('/api/admin/applications').set('Authorization', `Bearer ${adminToken}`)
        assert.equal(list.status, 200)
        assert.equal(list.body.total, 1)
        const item = list.body.items[0]
        assert.equal(item.companyId, null) // admin-posted job
        assert.equal(item.userId.email, 'c1@test.local')
        assert.equal(item.jobId.title, 'Piping Engineer')
        assert.deepEqual(item.screeningAnswers.map(a => a.answer), ['30 days', '12 LPA'])

        const upd = await request(app).patch(`/api/admin/applications/${item._id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: 'Accepted' })
        assert.equal(upd.body.status, 'Accepted')
        const bad = await request(app).patch(`/api/admin/applications/${item._id}`).set('Authorization', `Bearer ${adminToken}`).send({ status: { $ne: 1 } })
        assert.equal(bad.status, 400)
    })
    test('jobs without screening questions still apply with just jobId', async () => {
        const job = await publishedJob()
        const res = await request(asUser('user_1')).post('/api/users/apply').send({ jobId: String(job._id) })
        assert.equal(res.body.success, true)
    })
    test('applications and overview endpoints reject unauthenticated and recruiter tokens', async () => {
        for (const p of ['/api/admin/applications', '/api/admin/overview']) {
            assert.equal((await request(app).get(p)).status, 401)
            assert.equal((await request(app).get(p).set('Authorization', 'Bearer not-a-jwt')).status, 401)
        }
        assert.equal((await request(app).patch('/api/admin/applications/000000000000000000000000').send({ status: 'Accepted' })).status, 401)
    })
    test('overview returns real counts', async () => {
        await publishedJob(); await publishedJob({ status: 'draft', visible: false })
        const res = await request(app).get('/api/admin/overview').set('Authorization', `Bearer ${adminToken}`)
        assert.equal(res.status, 200)
        assert.equal(res.body.jobs.published, 1)
        assert.equal(res.body.jobs.draft, 1)
    })
})

describe('CORS and webhooks', () => {
    test('CORS allows surehire.in and rejects unknown origins', async () => {
        const ok = await request(app).get('/api/jobs').set('Origin', 'https://surehire.in')
        assert.equal(ok.headers['access-control-allow-origin'], 'https://surehire.in')
        const bad = await request(app).get('/api/jobs').set('Origin', 'https://evil.example')
        assert.equal(bad.headers['access-control-allow-origin'], undefined)
    })
    const signed = (payload) => {
        const id = 'msg_test_' + Math.random().toString(36).slice(2)
        const ts = new Date()
        const sig = new Webhook(process.env.CLERK_WEBHOOK_SECRET).sign(id, ts, payload)
        return { 'svix-id': id, 'svix-timestamp': String(Math.floor(ts.getTime() / 1000)), 'svix-signature': sig, 'content-type': 'application/json' }
    }
    test('unsigned webhook is rejected with 400', async () => {
        const res = await request(app).post('/webhooks').set('content-type', 'application/json').send('{"type":"user.deleted","data":{"id":"user_1"}}')
        assert.equal(res.status, 400)
        assert.ok(await User.exists({ _id: 'user_1' }))
    })
    test('signed user.created is stored, retried delivery is idempotent, unknown events are acknowledged', async () => {
        // Non-compact JSON: verifying a re-serialised body would fail, raw body must be used
        const payload = JSON.stringify({ type: 'user.created', data: { id: 'user_wh', first_name: 'Web', last_name: null, image_url: 'http://img', email_addresses: [{ id: 'e1', email_address: 'wh@test.local' }], primary_email_address_id: 'e1' } }, null, 2)
        for (let i = 0; i < 2; i++) {
            const res = await request(app).post('/webhooks').set(signed(payload)).send(payload)
            assert.equal(res.status, 200, JSON.stringify(res.body))
        }
        const u = await User.findById('user_wh').lean()
        assert.equal(u.name, 'Web')
        assert.equal(u.email, 'wh@test.local')
        const other = JSON.stringify({ type: 'session.created', data: {} })
        const res = await request(app).post('/webhooks').set(signed(other)).send(other)
        assert.equal(res.status, 200)
    })
})
