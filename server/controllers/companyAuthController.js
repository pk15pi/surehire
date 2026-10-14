// Recruiter/company passwordless login, password reset and email verification.
// Public responses never reveal whether an account exists; codes/tokens are never logged or returned.
import bcrypt from 'bcrypt'
import Company from '../models/Company.js'
import AuthCode from '../models/AuthCode.js'
import AuthToken from '../models/AuthToken.js'
import generateToken from '../utils/generateToken.js'
import { authConfig } from '../config/authConfig.js'
import { generateToken as randomToken, keyedHash, normalizeDestination, normalizeEmail } from '../utils/authCrypto.js'
import { issueOtp, verifyOtp } from '../services/otpService.js'
import { channelConfigured, emailConfigured, sendEmail, NotificationError } from '../services/notify.js'

const GENERIC_SENT = 'If an account matches, a 6-digit code has been sent. It expires shortly.'
const INVALID_CODE = 'Invalid or expired code'
const PURPOSES = ['login', 'reset', 'signup']
const CHANNELS = ['email', 'sms']

export const signupAllowed = () => process.env.ALLOW_RECRUITER_SIGNUP === 'true'
export const isSuspended = (c) => c?.status === 'suspended'
export const publicCompany = (c) => ({ _id: c._id, name: c.name, email: c.email, image: c.image })
export const sessionFor = (c) => generateToken(c._id, c.tokenVersion || 0)

const str = (v, max = 300) => typeof v === 'string' ? v.slice(0, max) : ''

export const findByDestination = (channel, dest) =>
    channel === 'email' ? Company.findOne({ email: dest }) : Company.findOne({ phone: dest })

const unavailable = (res) => res.status(503).json({ success: false, message: 'We could not send the code right now. Please try again later.' })

// POST /api/company/auth/otp/request {purpose, channel, destination}
export const requestOtp = async (req, res) => {
    const purpose = str(req.body?.purpose, 20), channel = str(req.body?.channel, 10)
    if (!PURPOSES.includes(purpose) || !CHANNELS.includes(channel)) return res.status(400).json({ success: false, message: 'Invalid request' })
    if (purpose === 'signup' && (!signupAllowed() || channel !== 'sms')) return res.status(403).json({ success: false, message: 'Registration is not available' })
    const destination = normalizeDestination(channel, req.body?.destination)
    if (!destination) return res.status(400).json({ success: false, message: channel === 'email' ? 'Please enter a valid email address' : 'Please enter a valid mobile number' })
    // Checked before any account lookup so the answer doesn't depend on account existence
    if (!channelConfigured(channel)) return unavailable(res)

    try {
        const company = await findByDestination(channel, destination)
        let deliver, companyId = null
        if (purpose === 'signup') deliver = !company
        else {
            deliver = Boolean(company) && !isSuspended(company) && (channel === 'email' || company.phoneVerified === true)
            companyId = deliver ? company._id : null
        }
        const r = await issueOtp({ purpose, channel, destination, companyId, deliver, ip: req.ip })
        if (r.status !== 'sent') {
            res.set('Retry-After', String(r.retryAfter))
            return res.status(429).json({ success: false, message: r.status === 'cooldown' ? `Please wait ${r.retryAfter}s before requesting another code.` : 'Too many codes requested. Please try again later.', retryAfter: r.retryAfter })
        }
        return res.json({ success: true, message: GENERIC_SENT, cooldown: r.cooldown })
    } catch (err) {
        if (err instanceof NotificationError) return unavailable(res)
        console.error('[auth] otp request failed:', err?.name || 'error')
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}

const readCodeBody = (body) => {
    const channel = str(body?.channel, 10)
    if (!CHANNELS.includes(channel)) return null
    const destination = normalizeDestination(channel, body?.destination)
    const code = str(body?.code, 12).trim()
    return destination ? { channel, destination, code } : null
}

// POST /api/company/auth/otp/login {channel, destination, code}
export const loginWithOtp = async (req, res) => {
    const input = readCodeBody(req.body)
    if (!input) return res.status(400).json({ success: false, message: INVALID_CODE })
    try {
        const v = await verifyOtp({ purpose: 'login', ...input })
        const company = v.ok && v.companyId ? await Company.findById(v.companyId) : null
        if (!company) return res.status(400).json({ success: false, message: INVALID_CODE })
        if (isSuspended(company)) return res.status(403).json({ success: false, message: 'Your account is suspended. Please contact support.' })
        // A code delivered to the inbox/phone proves ownership of it
        if (input.channel === 'email' && company.emailVerified === false) { company.emailVerified = true; await company.save() }
        return res.json({ success: true, company: publicCompany(company), token: sessionFor(company) })
    } catch (err) {
        console.error('[auth] otp login failed:', err?.name || 'error')
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}

// POST /api/company/auth/password/verify-otp {channel, destination, code} -> short-lived reset token
export const verifyResetOtp = async (req, res) => {
    const input = readCodeBody(req.body)
    if (!input) return res.status(400).json({ success: false, message: INVALID_CODE })
    try {
        const v = await verifyOtp({ purpose: 'reset', ...input })
        const company = v.ok && v.companyId ? await Company.findById(v.companyId).select('_id status') : null
        if (!company || isSuspended(company)) return res.status(400).json({ success: false, message: INVALID_CODE })
        const ttl = authConfig().resetTokenTtlSeconds
        const resetToken = randomToken()
        await AuthToken.updateMany({ companyId: company._id, type: 'password_reset', usedAt: null }, { $set: { usedAt: new Date() } })
        await AuthToken.create({ type: 'password_reset', tokenHash: keyedHash(resetToken, 'reset'), companyId: company._id, expiresAt: new Date(Date.now() + ttl * 1000) })
        return res.json({ success: true, resetToken, expiresIn: ttl })
    } catch (err) {
        console.error('[auth] reset verify failed:', err?.name || 'error')
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}

// POST /api/company/auth/password/reset {resetToken, password}
export const resetPassword = async (req, res) => {
    const resetToken = str(req.body?.resetToken, 200)
    const password = typeof req.body?.password === 'string' ? req.body.password : ''
    if (password.length < 8 || password.length > 128) return res.status(400).json({ success: false, message: 'Password must be 8 to 128 characters' })
    if (!resetToken) return res.status(400).json({ success: false, message: 'This reset link has expired. Please start again.' })
    try {
        const now = new Date()
        const tok = await AuthToken.findOneAndUpdate(
            { tokenHash: keyedHash(resetToken, 'reset'), type: 'password_reset', usedAt: null, expiresAt: { $gt: now } },
            { $set: { usedAt: now } },
        )
        if (!tok) return res.status(400).json({ success: false, message: 'This reset link has expired. Please start again.' })
        const hash = await bcrypt.hash(password, 10)
        // Bumping tokenVersion signs out every existing session (see protectCompany)
        const company = await Company.findOneAndUpdate(
            { _id: tok.companyId, status: { $ne: 'suspended' } },
            { $set: { password: hash, passwordChangedAt: now }, $inc: { tokenVersion: 1 } },
        )
        if (!company) return res.status(400).json({ success: false, message: 'This reset link has expired. Please start again.' })
        await AuthCode.updateMany({ companyId: company._id, consumedAt: null }, { $set: { consumedAt: now } })
        return res.json({ success: true, message: 'Password updated. Please log in with your new password.' })
    } catch (err) {
        console.error('[auth] reset failed:', err?.name || 'error')
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}

// ---- email verification ------------------------------------------------------

export const sendVerificationEmail = async (company) => {
    const cfg = authConfig()
    const token = randomToken()
    await AuthToken.updateMany({ companyId: company._id, type: 'email_verify', usedAt: null }, { $set: { usedAt: new Date() } })
    await AuthToken.create({ type: 'email_verify', tokenHash: keyedHash(token, 'verify'), companyId: company._id, expiresAt: new Date(Date.now() + cfg.emailVerifyTtlSeconds * 1000) })
    const link = `${cfg.appBaseUrl}/?recruiter-verify=${encodeURIComponent(token)}`
    const hours = Math.round(cfg.emailVerifyTtlSeconds / 3600)
    await sendEmail({
        to: company.email,
        subject: 'Confirm your SureHire recruiter account',
        text: `Hi ${company.name},\n\nConfirm your email address to activate your SureHire recruiter account:\n${link}\n\nThis link expires in ${hours} hours and can be used once. If you did not sign up, ignore this email.`,
    })
}

// POST /api/company/auth/verify-email {token}
export const verifyEmail = async (req, res) => {
    const token = str(req.body?.token, 200)
    const fail = () => res.status(400).json({ success: false, message: 'This verification link is invalid or has expired.' })
    if (!token) return fail()
    try {
        const now = new Date()
        const tok = await AuthToken.findOneAndUpdate(
            { tokenHash: keyedHash(token, 'verify'), type: 'email_verify', usedAt: null, expiresAt: { $gt: now } },
            { $set: { usedAt: now } },
        )
        if (!tok) return fail()
        await Company.updateOne({ _id: tok.companyId }, { $set: { emailVerified: true } })
        return res.json({ success: true, message: 'Email verified. You can now log in.' })
    } catch (err) {
        console.error('[auth] verify email failed:', err?.name || 'error')
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}

// POST /api/company/auth/verify-email/resend {email} - always the same answer
export const resendVerification = async (req, res) => {
    const email = normalizeEmail(req.body?.email)
    if (!email) return res.status(400).json({ success: false, message: 'Please enter a valid email address' })
    if (!emailConfigured()) return unavailable(res)
    const cooldown = authConfig().otpResendCooldownSeconds
    try {
        const company = await Company.findOne({ email })
        if (company && company.emailVerified === false && !isSuspended(company)) {
            const last = await AuthToken.findOne({ companyId: company._id, type: 'email_verify' }).sort({ createdAt: -1 }).select('createdAt').lean()
            if (!last || Date.now() - new Date(last.createdAt).getTime() >= cooldown * 1000) await sendVerificationEmail(company)
        }
    } catch (err) {
        if (!(err instanceof NotificationError)) console.error('[auth] resend verification failed:', err?.name || 'error')
    }
    return res.json({ success: true, message: 'If the account needs verification, a new link has been sent.', cooldown })
}
