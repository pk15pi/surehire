import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'

// ---------------------------------------------------------------------------
// Minimal env-based admin auth (separate from recruiter/company JWT).
//
//   ADMIN_EMAILS         comma-separated list of allowed admin emails
//   ADMIN_PASSWORD_HASH  bcrypt hash of the shared admin password (preferred)
//   ADMIN_PASSWORD       plain password (fallback, min 12 chars) - used only if no hash
//   ADMIN_JWT_SECRET     secret for admin tokens (min 32 chars, must differ from JWT_SECRET)
//   ADMIN_TOKEN_TTL      optional token lifetime, e.g. "2h" or "90m" (default 2h, max 12h)
// ---------------------------------------------------------------------------

// Used when ADMIN_EMAILS is not set (compared case-insensitively)
export const DEFAULT_ADMIN_EMAILS = 'synfowebs@gmail.com,career@surehire.in'

const AUDIENCE = 'surehire-admin'
const ISSUER = 'surehire-api'
const DEFAULT_TTL_SECONDS = 2 * 60 * 60
const MAX_TTL_SECONDS = 12 * 60 * 60

const parseTtl = (raw) => {
    const m = /^(\d{1,4})([mh])$/.exec(String(raw || '').trim())
    if (!m) return DEFAULT_TTL_SECONDS
    const seconds = Number(m[1]) * (m[2] === 'h' ? 3600 : 60)
    return Math.min(Math.max(seconds, 300), MAX_TTL_SECONDS)
}

export const getAdminConfig = () => {
    const emails = String(process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAILS)
        .split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
    const passwordHash = String(process.env.ADMIN_PASSWORD_HASH || '').trim()
    const password = process.env.ADMIN_PASSWORD || ''
    const secret = process.env.ADMIN_JWT_SECRET || ''

    const problems = []
    if (!emails.length) problems.push('ADMIN_EMAILS')
    if (!passwordHash && password.length < 12) problems.push('ADMIN_PASSWORD_HASH or ADMIN_PASSWORD (min 12 chars)')
    if (secret.length < 32) problems.push('ADMIN_JWT_SECRET (min 32 chars)')
    if (secret && secret === process.env.JWT_SECRET) problems.push('ADMIN_JWT_SECRET must differ from JWT_SECRET')

    return {
        configured: problems.length === 0,
        problems,
        emails,
        passwordHash,
        password,
        secret,
        ttlSeconds: parseTtl(process.env.ADMIN_TOKEN_TTL),
    }
}

// Version tag derived from the current password material: rotating the admin
// password invalidates every previously issued admin token.
const passwordVersion = (cfg) =>
    crypto.createHmac('sha256', cfg.secret).update(cfg.passwordHash || cfg.password).digest('hex').slice(0, 16)

const safeEqual = (a, b) => {
    const ha = crypto.createHash('sha256').update(String(a)).digest()
    const hb = crypto.createHash('sha256').update(String(b)).digest()
    return crypto.timingSafeEqual(ha, hb)
}

// Always performs the password comparison so timing doesn't reveal whether the email exists
export const verifyAdminCredentials = async (cfg, email, password) => {
    const emailOk = cfg.emails.includes(String(email).trim().toLowerCase())
    let passwordOk = false
    if (cfg.passwordHash) {
        try { passwordOk = await bcrypt.compare(String(password), cfg.passwordHash) } catch { passwordOk = false }
    } else {
        passwordOk = safeEqual(password, cfg.password)
    }
    return emailOk && passwordOk
}

export const signAdminToken = (cfg, email) => {
    const token = jwt.sign(
        { role: 'admin', pwv: passwordVersion(cfg) },
        cfg.secret,
        { algorithm: 'HS256', expiresIn: cfg.ttlSeconds, audience: AUDIENCE, issuer: ISSUER, subject: email }
    )
    return { token, expiresAt: new Date(Date.now() + cfg.ttlSeconds * 1000).toISOString() }
}

const unauthorized = (res, message = 'Admin authentication required') =>
    res.status(401).json({ success: false, message })

// Verifies the admin JWT (Authorization: Bearer <token>). Rejects everyone else,
// including recruiter/company tokens and Clerk user sessions.
export const protectAdmin = (req, res, next) => {
    const cfg = getAdminConfig()
    if (!cfg.configured) return res.status(503).json({ success: false, message: 'Admin access is not configured' })

    const header = req.headers.authorization || ''
    const [scheme, token] = header.split(' ')
    if (scheme !== 'Bearer' || !token) return unauthorized(res)

    try {
        const payload = jwt.verify(token, cfg.secret, { algorithms: ['HS256'], audience: AUDIENCE, issuer: ISSUER })
        const email = String(payload.sub || '').toLowerCase()
        if (payload.role !== 'admin' || !cfg.emails.includes(email) || payload.pwv !== passwordVersion(cfg)) {
            return unauthorized(res, 'Session is no longer valid. Please log in again.')
        }
        req.admin = { email }
        return next()
    } catch {
        return unauthorized(res, 'Session expired or invalid. Please log in again.')
    }
}

// Admin responses contain personal data - never cache them
export const noStore = (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
}
