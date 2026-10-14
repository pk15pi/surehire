// Recruiter auth upgrade: password login (email/mobile), OTP login, signup with mobile OTP +
// email link, forgot password, rate limits, enumeration, role escalation, log hygiene.
// In-memory MongoDB + in-memory notification outbox only (NODE_ENV=test).
import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcrypt'
import { v2 as cloudinary } from 'cloudinary'

process.env.NODE_ENV = 'test'
process.env.EMAIL_TRANSPORT = 'memory'
process.env.SMS_PROVIDER = 'memory'
process.env.ALLOW_RECRUITER_SIGNUP = 'true'
process.env.OTP_IP_SEND_LIMIT = '1000'
process.env.OTP_IP_VERIFY_LIMIT = '1000'
process.env.OTP_RESEND_COOLDOWN_SECONDS = '60'
process.env.OTP_MAX_ATTEMPTS = '5'

const { startTestApp } = await import('./fixtures.js')
const { testOutbox } = await import('../services/notify.js')
const Company = (await import('../models/Company.js')).default
const AuthCode = (await import('../models/AuthCode.js')).default
const AuthToken = (await import('../models/AuthToken.js')).default

let t, n = 0
const ip = () => `10.9.${Math.floor(++n / 250)}.${n % 250}`
const post = (path, body, addr = ip()) => t.request(t.app).post(path).set('X-Forwarded-For', addr).send(body)
const last = () => testOutbox[testOutbox.length - 1]
const codeOf = (m) => m.code || (m.subject.match(/\b(\d{6})\b/) || [])[1]
const PNG = Buffer.from('89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d4944415478da63f8ffff3f0005fe02fea7d6a4b90000000049454e44ae426082', 'hex')

before(async () => {
    t = await startTestApp('company_auth_test')
    cloudinary.uploader.upload = async () => ({ secure_url: 'https://example.test/logo.png' })
})
after(async () => { await t.stop() })
beforeEach(async () => {
    testOutbox.length = 0
    await Promise.all([Company.deleteMany({}), AuthCode.deleteMany({}), AuthToken.deleteMany({})])
    await Company.create({ name: 'Acme', email: 'hr@acme.test', image: 'x', password: await bcrypt.hash('Passw0rd!x', 10), phone: '+919876543210', phoneVerified: true })
})

const requestCode = (purpose, channel, destination, addr) => post('/api/company/auth/otp/request', { purpose, channel, destination }, addr)
const company = (token) => t.request(t.app).get('/api/company/company').set('token', token)

test('password login with email (original contract) and with mobile', async () => {
    const a = await post('/api/company/login', { email: 'hr@acme.test', password: 'Passw0rd!x' })
    assert.equal(a.body.success, true); assert.ok(a.body.token); assert.equal(a.body.company.email, 'hr@acme.test')
    assert.equal(a.body.company.password, undefined)
    const b = await post('/api/company/login', { identifier: '98765 43210', password: 'Passw0rd!x' })
    assert.equal(b.body.success, true)
    assert.equal((await company(b.body.token)).body.success, true)
})

test('password login failures are generic (no enumeration)', async () => {
    const wrong = await post('/api/company/login', { email: 'hr@acme.test', password: 'nope-nope' })
    const unknown = await post('/api/company/login', { email: 'ghost@acme.test', password: 'nope-nope' })
    assert.deepEqual(wrong.body, unknown.body)
    assert.equal(wrong.body.success, false)
})

test('legacy company documents (no new fields) still log in and keep sessions', async () => {
    await Company.collection.insertOne({ name: 'Old', email: 'old@co.test', image: 'x', password: await bcrypt.hash('OldPass123', 10) })
    const r = await post('/api/company/login', { email: 'old@co.test', password: 'OldPass123' })
    assert.equal(r.body.success, true)
    const jwt = (await import('jsonwebtoken')).default
    const legacyToken = jwt.sign({ id: r.body.company._id }, process.env.JWT_SECRET, { expiresIn: '1d' })
    assert.equal((await company(legacyToken)).body.success, true)
})

test('email OTP login: success, then the code cannot be reused', async () => {
    const r = await requestCode('login', 'email', 'HR@acme.test')
    assert.equal(r.status, 200); assert.equal(r.body.success, true)
    assert.ok(!JSON.stringify(r.body).match(/\d{6}/), 'code never returned')
    const code = codeOf(last())
    const ok = await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code })
    assert.equal(ok.body.success, true); assert.ok(ok.body.token)
    const again = await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code })
    assert.equal(again.status, 400)
})

test('mobile OTP login works; stored code is hashed', async () => {
    await requestCode('login', 'sms', '+91 98765-43210')
    const code = last().code
    const doc = await AuthCode.findOne().lean()
    assert.ok(!JSON.stringify(doc).includes(code)); assert.ok(!JSON.stringify(doc).includes('9876543210'))
    const ok = await post('/api/company/auth/otp/login', { channel: 'sms', destination: '9876543210', code })
    assert.equal(ok.body.success, true)
})

test('invalid, expired and wrong-purpose codes are rejected', async () => {
    await requestCode('login', 'email', 'hr@acme.test')
    const code = codeOf(last())
    const bad = String((Number(code) + 1) % 1000000).padStart(6, '0')
    assert.equal((await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code: bad })).status, 400)
    assert.equal((await post('/api/company/auth/password/verify-otp', { channel: 'email', destination: 'hr@acme.test', code })).status, 400, 'login code not valid for reset')
    await AuthCode.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code })).status, 400)
})

test('attempt limit locks the code even if the right code comes later', async () => {
    await requestCode('login', 'email', 'hr@acme.test')
    const code = codeOf(last())
    const bad = String((Number(code) + 1) % 1000000).padStart(6, '0')
    for (let i = 0; i < 5; i++) await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code: bad })
    assert.equal((await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code })).status, 400)
})

test('resend cooldown and hourly cap per destination', async () => {
    assert.equal((await requestCode('login', 'email', 'hr@acme.test')).status, 200)
    const again = await requestCode('login', 'email', 'hr@acme.test')
    assert.equal(again.status, 429); assert.ok(again.body.retryAfter > 0)
    assert.equal(testOutbox.length, 1)
    for (let i = 0; i < 5; i++) {
        await AuthCode.collection.updateMany({}, [{ $set: { createdAt: { $subtract: ['$createdAt', 120000] } } }])
        await requestCode('login', 'email', 'hr@acme.test')
    }
    await AuthCode.collection.updateMany({}, [{ $set: { createdAt: { $subtract: ['$createdAt', 120000] } } }])
    const capped = await requestCode('login', 'email', 'hr@acme.test')
    assert.equal(capped.status, 429)
    // a new code invalidates the previous one
    const codes = testOutbox.map(codeOf)
    assert.equal((await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code: codes[0] })).status, 400)
})

test('no enumeration: unknown destinations get identical responses and no message', async () => {
    const known = await requestCode('reset', 'email', 'hr@acme.test')
    const unknown = await requestCode('reset', 'email', 'nobody@acme.test')
    assert.equal(known.status, unknown.status); assert.deepEqual(known.body, unknown.body)
    assert.equal(testOutbox.length, 1)
    const known2 = await requestCode('reset', 'email', 'hr@acme.test')
    const unknown2 = await requestCode('reset', 'email', 'nobody@acme.test')
    assert.equal(known2.status, unknown2.status); assert.equal(unknown2.status, 429)
})

test('per-IP rate limit on code requests', async () => {
    process.env.OTP_IP_SEND_LIMIT = '3'
    try {
        const addr = '10.200.0.1'
        const statuses = []
        for (let i = 0; i < 5; i++) statuses.push((await requestCode('login', 'email', `p${i}@x.test`, addr)).status)
        assert.deepEqual(statuses.slice(0, 3), [200, 200, 200]); assert.equal(statuses[4], 429)
    } finally { process.env.OTP_IP_SEND_LIMIT = '1000' }
})

test('suspended accounts: no code, no login, existing sessions rejected', async () => {
    const login = await post('/api/company/login', { email: 'hr@acme.test', password: 'Passw0rd!x' })
    await Company.updateOne({ email: 'hr@acme.test' }, { $set: { status: 'suspended' } })
    assert.equal((await company(login.body.token)).body.success, false)
    const r = await post('/api/company/login', { email: 'hr@acme.test', password: 'Passw0rd!x' })
    assert.equal(r.body.success, false)
    await requestCode('login', 'email', 'hr@acme.test')
    assert.equal(testOutbox.length, 0)
})

test('forgot password: OTP -> single-use reset token -> new password -> old sessions revoked', async () => {
    const session = (await post('/api/company/login', { email: 'hr@acme.test', password: 'Passw0rd!x' })).body.token
    await requestCode('reset', 'sms', '9876543210')
    const v = await post('/api/company/auth/password/verify-otp', { channel: 'sms', destination: '9876543210', code: last().code })
    assert.equal(v.body.success, true); assert.ok(v.body.resetToken)
    const short = await post('/api/company/auth/password/reset', { resetToken: v.body.resetToken, password: 'short' })
    assert.equal(short.status, 400)
    const r = await post('/api/company/auth/password/reset', { resetToken: v.body.resetToken, password: 'BrandNew#2026' })
    assert.equal(r.body.success, true)
    assert.equal((await company(session)).body.success, false, 'old session invalidated')
    assert.equal((await post('/api/company/login', { email: 'hr@acme.test', password: 'Passw0rd!x' })).body.success, false)
    assert.equal((await post('/api/company/login', { email: 'hr@acme.test', password: 'BrandNew#2026' })).body.success, true)
    const reuse = await post('/api/company/auth/password/reset', { resetToken: v.body.resetToken, password: 'Another#2026' })
    assert.equal(reuse.status, 400)
})

test('expired reset token is rejected', async () => {
    await requestCode('reset', 'email', 'hr@acme.test')
    const v = await post('/api/company/auth/password/verify-otp', { channel: 'email', destination: 'hr@acme.test', code: codeOf(last()) })
    await AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await post('/api/company/auth/password/reset', { resetToken: v.body.resetToken, password: 'BrandNew#2026' })).status, 400)
})

const register = async (fields, addr) => {
    let r = t.request(t.app).post('/api/company/register').set('X-Forwarded-For', addr || ip())
    for (const [k, v] of Object.entries(fields)) r = r.field(k, v)
    return r.attach('image', PNG, { filename: 'logo.png', contentType: 'image/png' })
}
const signupCode = async (phone) => { await requestCode('signup', 'sms', phone); return last().code }

test('signup: mobile OTP + email link; login blocked until confirmed; link single-use and expiring', async () => {
    const phoneCode = await signupCode('9123456789')
    const r = await register({ name: 'NewCo', email: 'Jobs@NewCo.test', password: 'Secure#1234', phone: '9123456789', phoneCode,
        role: 'admin', isAdmin: 'true', status: 'active', emailVerified: 'true', tokenVersion: '-1' })
    assert.equal(r.body.success, true); assert.equal(r.body.verificationRequired, true); assert.equal(r.body.token, undefined)
    const doc = await Company.findOne({ email: 'jobs@newco.test' }).lean()
    assert.equal(doc.emailVerified, false); assert.equal(doc.role, undefined); assert.equal(doc.isAdmin, undefined); assert.equal(doc.tokenVersion, 0)
    assert.equal(doc.phone, '+919123456789')
    const blocked = await post('/api/company/login', { email: 'jobs@newco.test', password: 'Secure#1234' })
    assert.equal(blocked.body.success, false); assert.equal(blocked.body.verificationRequired, true)
    const link = last().text.match(/recruiter-verify=([\w%-]+)/)[1]
    const token = decodeURIComponent(link)
    assert.equal(await AuthToken.countDocuments({ tokenHash: token }), 0, 'token stored hashed')
    assert.equal((await post('/api/company/auth/verify-email', { token })).body.success, true)
    assert.equal((await post('/api/company/auth/verify-email', { token })).status, 400, 'single use')
    const ok = await post('/api/company/login', { email: 'jobs@newco.test', password: 'Secure#1234' })
    assert.equal(ok.body.success, true)
    const adminTry = await t.request(t.app).get('/api/admin/jobs').set('Authorization', `Bearer ${ok.body.token}`)
    assert.notEqual(adminTry.status, 200, 'recruiter token is not an admin token')
})

test('signup: expired verification link and resend', async () => {
    const phoneCode = await signupCode('9123456780')
    await register({ name: 'Co2', email: 'a@co2.test', password: 'Secure#1234', phone: '9123456780', phoneCode })
    const token = decodeURIComponent(last().text.match(/recruiter-verify=([\w%-]+)/)[1])
    await AuthToken.updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    assert.equal((await post('/api/company/auth/verify-email', { token })).status, 400)
    await AuthToken.collection.updateMany({}, { $set: { createdAt: new Date(Date.now() - 3600_000) } })
    const before = testOutbox.length
    const res1 = await post('/api/company/auth/verify-email/resend', { email: 'a@co2.test' })
    const res2 = await post('/api/company/auth/verify-email/resend', { email: 'ghost@co2.test' })
    assert.deepEqual(res1.body, res2.body)
    assert.equal(testOutbox.length, before + 1)
})

test('signup duplicates: same response, no second account, owner notified; bad/missing OTP rejected', async () => {
    const phoneCode = await signupCode('9123456781')
    const dup = await register({ name: 'Imposter', email: 'hr@acme.test', password: 'Secure#1234', phone: '9123456781', phoneCode })
    assert.equal(dup.body.success, true); assert.equal(dup.body.verificationRequired, true)
    assert.equal(await Company.countDocuments({ email: 'hr@acme.test' }), 1)
    assert.match(last().subject, /sign-up attempt/)
    const noOtp = await register({ name: 'X', email: 'x@x.test', password: 'Secure#1234', phone: '9123456782', phoneCode: '000000' })
    assert.equal(noOtp.body.success, false)
    // signup code is not sent for an already-registered mobile
    testOutbox.length = 0
    await requestCode('signup', 'sms', '9876543210')
    assert.equal(testOutbox.length, 0)
})

test('signup stays gated by ALLOW_RECRUITER_SIGNUP', async () => {
    process.env.ALLOW_RECRUITER_SIGNUP = 'false'
    try {
        assert.equal((await requestCode('signup', 'sms', '9123456783')).status, 403)
        assert.equal((await register({ name: 'X', email: 'y@y.test', password: 'Secure#1234', phone: '9123456783', phoneCode: '123456' })).status, 403)
    } finally { process.env.ALLOW_RECRUITER_SIGNUP = 'true' }
})

test('delivery fails clearly when unconfigured; test transport refused in production', async () => {
    process.env.SMS_PROVIDER = ''
    try { assert.equal((await requestCode('login', 'sms', '9876543210')).status, 503) } finally { process.env.SMS_PROVIDER = 'memory' }
    process.env.NODE_ENV = 'production'
    try {
        assert.equal((await requestCode('login', 'email', 'hr@acme.test')).status, 503)
        assert.equal((await requestCode('login', 'sms', '9876543210')).status, 503)
    } finally { process.env.NODE_ENV = 'test' }
    assert.equal(testOutbox.length, 0)
})

test('codes, tokens and passwords never appear in logs', async () => {
    const lines = []
    const orig = { log: console.log, error: console.error, warn: console.warn, info: console.info }
    for (const k of Object.keys(orig)) console[k] = (...a) => { lines.push(a.map(String).join(' ')); }
    try {
        await requestCode('login', 'email', 'hr@acme.test')
        const code = codeOf(last())
        await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code: '000000' })
        await post('/api/company/auth/otp/login', { channel: 'email', destination: 'hr@acme.test', code })
        await requestCode('reset', 'email', 'hr@acme.test')
        const rc = codeOf(last())
        const v = await post('/api/company/auth/password/verify-otp', { channel: 'email', destination: 'hr@acme.test', code: rc })
        await post('/api/company/auth/password/reset', { resetToken: v.body.resetToken, password: 'LogCheck#2026' })
        const all = lines.join('\n')
        for (const secret of [code, rc, v.body.resetToken, 'LogCheck#2026', 'Passw0rd!x']) assert.ok(!all.includes(secret))
    } finally { Object.assign(console, orig) }
})
