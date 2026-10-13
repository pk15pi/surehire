// Smoke test for the combined Vercel entry (api/index.js at the repo root):
// it must load without listen(), connect lazily, and serve /api/* routes.
// Skipped when the root api/ folder is absent (server deployed on its own).
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const entry = new URL('../../api/index.js', import.meta.url)
const hasEntry = existsSync(fileURLToPath(entry))
let mongod, mongoose, request, handler

before(async () => {
    if (!hasEntry) return
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    mongod = await MongoMemoryServer.create()
    process.env.MONGODB_URI = mongod.getUri().replace(/\/+$/, '') // db.js appends /job-portal
    process.env.ADMIN_PASSWORD = 'test-password-123456'
    process.env.ADMIN_JWT_SECRET = 'test-admin-secret-'.padEnd(48, 'x')
    process.env.JWT_SECRET = 'test-recruiter-secret-'.padEnd(48, 'y')
    process.env.CLERK_PUBLISHABLE_KEY ||= 'pk_test_ZXhhbXBsZS5jbGVyay5hY2NvdW50cy5kZXYk'
    process.env.CLERK_SECRET_KEY ||= 'sk_test_dummy'
    mongoose = (await import('mongoose')).default
    request = (await import('supertest')).default
    handler = (await import(entry.href)).default
})

after(async () => {
    if (!hasEntry) return
    await mongoose.disconnect()
    await mongod?.stop()
})

test('api/index.js serves the Express app with a lazy DB connection', { skip: !hasEntry && 'api/ not present' }, async () => {
    assert.equal(typeof handler, 'function')
    assert.equal(mongoose.connection.readyState, 0, 'no connection at import time')
    const jobs = await request(handler).get('/api/jobs')
    assert.equal(jobs.status, 200)
    assert.deepEqual(jobs.body, { success: true, jobs: [] })
    assert.equal(mongoose.connection.readyState, 1)
    assert.equal(mongoose.connection.name, 'job-portal')
    const login = await request(handler).post('/api/admin/login').send({ email: 'synfowebs@gmail.com', password: 'wrong-password' })
    assert.equal(login.status, 401)
    assert.equal((await request(handler).get('/api/jobs/not-an-id')).status, 404)
})
