// Recruiter account mobile number: add, verify, change, duplicates, auth, then mobile login.
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'

process.env.NODE_ENV = 'test'
process.env.EMAIL_TRANSPORT = 'memory'
process.env.SMS_PROVIDER = 'memory'
process.env.OTP_IP_SEND_LIMIT = '1000'
process.env.OTP_IP_VERIFY_LIMIT = '1000'

const { startTestApp } = await import('./fixtures.js')
const { testOutbox } = await import('../services/notify.js')
const Company = (await import('../models/Company.js')).default
const AuthCode = (await import('../models/AuthCode.js')).default

let t, token, n = 0
const ip = () => `10.8.${Math.floor(++n / 250)}.${n % 250}`
const as = (r, tok = token) => r.set('X-Forwarded-For', ip()).set('token', tok)
const send = (phone, tok) => as(t.request(t.app).post('/api/company/phone/send-code'), tok).send({ phone })
const verify = (code, tok) => as(t.request(t.app).post('/api/company/phone/verify'), tok).send({ code })
const lastCode = () => testOutbox[testOutbox.length - 1]?.code
const wrong = (c) => String((Number(c) + 1) % 1000000).padStart(6, '0')

before(async () => { t = await startTestApp('company_phone_test') })
after(async () => { await t.stop() })
beforeEach(async () => {
    testOutbox.length = 0
    await Promise.all([Company.deleteMany({}), AuthCode.deleteMany({})])
    await Company.create({ name: 'Acme', email: 'hr@acme.test', image: 'x', password: await bcrypt.hash('Passw0rd!x', 10) })
    await Company.create({ name: 'Other', email: 'hr@other.test', image: 'x', password: await bcrypt.hash('Passw0rd!x', 10), phone: '+919000000001', phoneVerified: true })
    token = (await t.request(t.app).post('/api/company/login').set('X-Forwarded-For', ip()).send({ email: 'hr@acme.test', password: 'Passw0rd!x' })).body.token
})

test('add a number, verify it, then log in with mobile + password and mobile OTP', async () => {
    const s = await send('+91 98111 22233')
    assert.equal(s.status, 200); assert.equal(s.body.pendingPhone, '+919811122233'); assert.equal(s.body.phoneVerified, false)
    assert.ok(!JSON.stringify(s.body).includes(lastCode()))
    const before = await Company.findOne({ email: 'hr@acme.test' }).lean()
    assert.equal(before.phone, undefined, 'phone only set after verification')
    const v = await verify(lastCode())
    assert.equal(v.body.success, true); assert.equal(v.body.phone, '+919811122233'); assert.equal(v.body.phoneVerified, true)
    const pw = await t.request(t.app).post('/api/company/login').set('X-Forwarded-For', ip()).send({ identifier: '9811122233', password: 'Passw0rd!x' })
    assert.equal(pw.body.success, true)
    await t.request(t.app).post('/api/company/auth/otp/request').set('X-Forwarded-For', ip()).send({ purpose: 'login', channel: 'sms', destination: '9811122233' })
    const otp = await t.request(t.app).post('/api/company/auth/otp/login').set('X-Forwarded-For', ip()).send({ channel: 'sms', destination: '9811122233', code: lastCode() })
    assert.equal(otp.body.success, true)
    const me = await as(t.request(t.app).get('/api/company/phone'))
    assert.deepEqual([me.body.phone, me.body.phoneVerified], ['+919811122233', true])
})

test('wrong, expired and reused codes are rejected', async () => {
    await send('9811122233')
    const code = lastCode()
    assert.equal((await verify(wrong(code))).status, 400)
    await AuthCode.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await verify(code)).status, 400)
    await AuthCode.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 600_000) } })
    await send('9811122233')
    assert.equal((await verify(lastCode())).body.success, true)
    assert.equal((await verify(lastCode())).status, 400, 'no pending number / code used')
})

test('code is bound to the company: another account cannot use it', async () => {
    await send('9811122233')
    const code = lastCode()
    await Company.create({ name: 'Third', email: 'x@third.test', image: 'x', password: await bcrypt.hash('Passw0rd!x', 10), pendingPhone: '+919811122233' })
    const tok3 = (await t.request(t.app).post('/api/company/login').set('X-Forwarded-For', ip()).send({ email: 'x@third.test', password: 'Passw0rd!x' })).body.token
    assert.equal((await verify(code, tok3)).status, 400)
})

test('duplicate number is rejected and no code is sent', async () => {
    const r = await send('9000000001')
    assert.equal(r.status, 409); assert.equal(testOutbox.length, 0)
})

test('changing the number resets verification until the new one is verified', async () => {
    await send('9811122233'); await verify(lastCode())
    await AuthCode.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 600_000) } })
    const s = await send('9822233344')
    assert.equal(s.body.phoneVerified, false); assert.equal(s.body.phone, '+919811122233'); assert.equal(s.body.pendingPhone, '+919822233344')
    const old = await t.request(t.app).post('/api/company/login').set('X-Forwarded-For', ip()).send({ identifier: '9811122233', password: 'Passw0rd!x' })
    assert.equal(old.body.success, false, 'old number no longer valid for mobile login')
    const v = await verify(lastCode())
    assert.equal(v.body.phone, '+919822233344'); assert.equal(v.body.phoneVerified, true)
})

test('resend cooldown applies', async () => {
    assert.equal((await send('9811122233')).status, 200)
    assert.equal((await send('9811122233')).status, 429)
})

test('unauthenticated or bad token is rejected', async () => {
    for (const r of [
        t.request(t.app).get('/api/company/phone'),
        t.request(t.app).post('/api/company/phone/send-code').send({ phone: '9811122233' }),
        t.request(t.app).post('/api/company/phone/verify').send({ code: '123456' }),
        t.request(t.app).post('/api/company/phone/send-code').set('token', 'garbage').send({ phone: '9811122233' }),
    ]) assert.equal((await r).body.success, false)
    assert.equal(testOutbox.length, 0)
})

test('SMS not configured returns 503; invalid number returns 400', async () => {
    assert.equal((await send('12345')).status, 400)
    process.env.SMS_PROVIDER = ''
    try { assert.equal((await send('9811122233')).status, 503) } finally { process.env.SMS_PROVIDER = 'memory' }
})
