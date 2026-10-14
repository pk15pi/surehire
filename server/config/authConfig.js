// Auth/OTP settings, read at call time so tests (and env changes) apply without restarts.
const int = (v, d, min, max) => { const n = parseInt(v, 10); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : d }

export const authConfig = () => ({
    otpExpirySeconds: int(process.env.OTP_EXPIRY_SECONDS, 300, 60, 1800),
    otpResendCooldownSeconds: int(process.env.OTP_RESEND_COOLDOWN_SECONDS, 60, 10, 3600),
    otpMaxAttempts: int(process.env.OTP_MAX_ATTEMPTS, 5, 1, 10),
    otpMaxSendsPerHour: int(process.env.OTP_MAX_SENDS_PER_HOUR, 5, 1, 50),
    resetTokenTtlSeconds: int(process.env.RESET_TOKEN_TTL_SECONDS, 600, 60, 3600),
    emailVerifyTtlSeconds: int(process.env.EMAIL_VERIFY_TTL_SECONDS, 86400, 600, 7 * 86400),
    appBaseUrl: String(process.env.APP_BASE_URL || 'https://surehire.in').replace(/\/+$/, ''),
})

// Keyed-hash secret for OTPs / tokens. Dedicated OTP_SECRET preferred; falls back to a
// value derived from JWT_SECRET so existing deployments keep working. Never logged.
export const otpSecret = () => {
    const s = process.env.OTP_SECRET || (process.env.JWT_SECRET ? `otp:${process.env.JWT_SECRET}` : '')
    if (!s) throw new Error('OTP_SECRET / JWT_SECRET is not configured')
    return s
}

export const isProduction = () => process.env.NODE_ENV === 'production'
export const isTest = () => process.env.NODE_ENV === 'test'
