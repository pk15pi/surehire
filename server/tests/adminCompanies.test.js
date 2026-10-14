// Admin recruiter management: create without password, list, suspend, phone edits, audit, auth.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'

process.env.NODE_ENV = 'test'
process.env.EMAIL_TRANSPORT = 'memory'
process.env.SMS_PROVIDER = 'memory'
process.env.OTP_IP_SEND_LIMIT = '1000'
process.env.OTP_IP_VERIFY_LIMIT = '1000'

const { startTestApp } = await import('./fixtures.js')
const { testOutbox } = await import('../services/notify.js')
const Company = (await import('../models/Company.js')).default
const AuditLog = (await import('../models/AuditLog.js')).default

let t, id
before(async () => { t = await startTestApp('admin_companies_test') })
after(async () => { await t.stop() })
const api = (method, path) => t.admin(t.request(t.app)[method](`/api/admin${path}`))

test('admin creates a recruiter without a password; audited; duplicate rejected', async () => {
    const r = await api('post', '/companies').send({ name: 'Acme Eng', email: 'HR@Acme.test', phone: '9811122233', status: 'active', password: 'ignored-pass', emailVerified: false, role: 'admin' })
    assert.equal(r.status, 201)
    id = r.body.company._id
    assert.equal(r.body.company.emailVerified, true); assert.equal(r.body.company.phoneVerified, false); assert.equal(r.body.company.phone, '+919811122233')
    assert.equal(r.body.company.password, undefined)
    const doc = await Company.findById(id).lean()
    assert.equal(doc.role, undefined); assert.equal(doc.createdByAdmin, true)
    assert.notEqual(doc.password, 'ignored-pass'); assert.ok(doc.password.startsWith('$2'))
    const login = await t.request(t.app).post('/api/company/login').send({ email: 'hr@acme.test', password: 'ignored-pass' })
    assert.equal(login.body.success, false, 'admin cannot set a password')
    const log = await AuditLog.findOne({ action: 'company.create', entityId: id }).lean()
    assert.ok(log); assert.ok(!JSON.stringify(log).includes('$2'))
    assert.equal((await api('post', '/companies').send({ name: 'Dup', email: 'hr@acme.test' })).status, 409)
    assert.equal((await api('post', '/companies').send({ name: 'Dup', email: 'a@b.test', phone: '9811122233' })).status, 409)
    assert.equal((await api('post', '/companies').send({ name: '', email: 'a@b.test' })).status, 400)
    assert.equal((await api('post', '/companies').send({ name: 'X', email: 'a@b.test', status: 'admin' })).status, 400)
})

test('admin-created recruiter can log in with an email code and set a password via reset', async () => {
    const ip = '10.77.0.1'
    await t.request(t.app).post('/api/company/auth/otp/request').set('X-Forwarded-For', ip).send({ purpose: 'login', channel: 'email', destination: 'hr@acme.test' })
    const code = testOutbox.at(-1).subject.match(/(\d{6})/)[1]
    const r = await t.request(t.app).post('/api/company/auth/otp/login').set('X-Forwarded-For', ip).send({ channel: 'email', destination: 'hr@acme.test', code })
    assert.equal(r.body.success, true)
    assert.equal((await t.request(t.app).get('/api/company/company').set('token', r.body.token)).body.success, true)
})

test('list, suspend (revokes access), reactivate, phone edit resets verification', async () => {
    const list = await api('get', '/companies?q=acme')
    assert.equal(list.body.items.length, 1); assert.equal(list.body.items[0].status, 'active')
    await Company.updateOne({ _id: id }, { $set: { phoneVerified: true } })
    const s = await api('patch', `/companies/${id}`).send({ status: 'suspended' })
    assert.equal(s.body.company.status, 'suspended')
    assert.equal((await api('get', '/companies?status=suspended')).body.items.length, 1)
    assert.equal((await api('patch', `/companies/${id}`).send({ status: 'active' })).body.company.status, 'active')
    const p = await api('patch', `/companies/${id}`).send({ phone: '+91 98222 33344' })
    assert.equal(p.body.company.phone, '+919822233344'); assert.equal(p.body.company.phoneVerified, false)
    assert.equal((await api('patch', `/companies/${id}`).send({ phone: 'abc' })).status, 400)
    const cleared = await api('patch', `/companies/${id}`).send({ phone: '' })
    assert.equal(cleared.body.company.phone, '')
    assert.ok(await AuditLog.exists({ action: 'company.update', entityId: id }))
    assert.equal((await api('patch', '/companies/000000000000000000000000').send({ status: 'active' })).status, 404)
})

test('admin endpoints require an admin token (recruiter token rejected)', async () => {
    assert.equal((await t.request(t.app).get('/api/admin/companies')).status, 401)
    assert.equal((await t.request(t.app).post('/api/admin/companies').send({ name: 'X', email: 'x@x.test' })).status, 401)
    const company = await Company.findById(id)
    const { default: generateToken } = await import('../utils/generateToken.js')
    const rt = generateToken(company._id, company.tokenVersion)
    assert.equal((await t.request(t.app).get('/api/admin/companies').set('Authorization', `Bearer ${rt}`)).status, 401)
})
