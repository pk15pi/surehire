// Audit-pass regressions (in-memory MongoDB only). Run: npm test
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
process.env.JWT_SECRET = 'test-recruiter-secret-'.padEnd(48, 'y')
process.env.ADMIN_JWT_SECRET = 'test-admin-secret-'.padEnd(48, 'x')
process.env.ADMIN_EMAILS = 'admin@test.local'
process.env.ADMIN_PASSWORD = 'test-password-123456'
const { MongoMemoryServer } = await import('mongodb-memory-server')
const mongoose = (await import('mongoose')).default
const request = (await import('supertest')).default
const express = (await import('express')).default
const bcrypt = (await import('bcrypt')).default
const { createApp } = await import('../app.js')
const Job = (await import('../models/Job.js')).default
const JobApplication = (await import('../models/jobApplication.js')).default
const Company = (await import('../models/Company.js')).default
const User = (await import('../models/User.js')).default
let mongod, app, companyToken
const asUser = (userId) => { const o = express(); o.use((req, res, next) => { req.auth = () => ({ userId }); next() }); o.use(createApp({ clerk: false })); return o }
before(async () => {
    mongod = await MongoMemoryServer.create()
    await mongoose.connect(mongod.getUri(), { dbName: 'surehire-audit-test' })
    await JobApplication.syncIndexes()
    app = createApp({ clerk: false })
    await Company.create({ name: 'RecruitCo', email: 'r@co.test', image: 'http://img', password: await bcrypt.hash('correct-horse-1', 4) })
    await User.create({ _id: 'user_a', name: 'A', email: 'a@test.local', image: 'http://img', resume: 'http://cv.pdf' })
    const login = await request(app).post('/api/company/login').send({ email: 'r@co.test', password: 'correct-horse-1' })
    companyToken = login.body.token
})
after(async () => { await mongoose.connection.dropDatabase().catch(() => {}); await mongoose.disconnect(); await mongod?.stop() })
beforeEach(async () => { await Job.deleteMany({}); await JobApplication.deleteMany({}) })

test('concurrent duplicate apply creates exactly one application', async () => {
    const job = await Job.create({ title: 'T', description: '<p>x</p>', location: 'Pune', category: 'Engineering', level: 'Senior level', salary: 0, date: Date.now(), status: 'published', visible: true })
    const u = asUser('user_a')
    const res = await Promise.all([1, 2, 3, 4].map(() => request(u).post('/api/users/apply').send({ jobId: String(job._id) })))
    assert.equal(res.filter(r => r.body.success).length, 1)
    assert.ok(res.filter(r => !r.body.success).every(r => r.body.message === 'Already Applied'))
    assert.equal(await JobApplication.countDocuments({ jobId: job._id, userId: 'user_a' }), 1)
})

test('postJob rejects non-string location/level/category and over-long title', async () => {
    const base = { title: 'Ok', description: '<p>desc</p>', salary: 10, location: 'Pune', level: 'Senior level', category: 'Engineering' }
    for (const bad of [{ location: { $gt: '' } }, { level: ['x'] }, { category: 'c'.repeat(101) }, { title: 't'.repeat(201) }]) {
        const r = await request(app).post('/api/company/post-job').set('token', companyToken).send({ ...base, ...bad })
        assert.equal(r.body.success, false)
        assert.equal(r.body.message, 'Invalid job details')
    }
    const ok = await request(app).post('/api/company/post-job').set('token', companyToken).send(base)
    assert.equal(ok.body.success, true)
})

test('controller errors do not leak internal messages', async () => {
    const orig = Job.find
    Job.find = () => { throw new Error('SECRET internal detail') }
    try {
        const r = await request(app).get('/api/company/list-job').set('token', companyToken)
        assert.equal(r.body.success, false)
        assert.doesNotMatch(String(r.body.message), /SECRET/)
    } finally { Job.find = orig }
})

test('recruiter sign-up is disabled by default (403) and allowed only with ALLOW_RECRUITER_SIGNUP=true', async () => {
    delete process.env.ALLOW_RECRUITER_SIGNUP
    const r = await request(app).post('/api/company/register').field('name', 'X').field('email', 'new@co.test').field('password', 'pw-123456')
    assert.equal(r.status, 403)
    assert.equal(r.body.success, false)
    assert.equal(await Company.countDocuments({ email: 'new@co.test' }), 0)
    process.env.ALLOW_RECRUITER_SIGNUP = 'true'
    const r2 = await request(app).post('/api/company/register').field('name', 'X').field('email', 'new@co.test').field('password', 'pw-123456')
    assert.notEqual(r2.status, 403)
    delete process.env.ALLOW_RECRUITER_SIGNUP
    const login = await request(app).post('/api/company/login').send({ email: 'r@co.test', password: 'correct-horse-1' })
    assert.equal(login.body.success, true, 'existing company login still works')
})
