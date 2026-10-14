import crypto from 'crypto'
import { otpSecret } from '../config/authConfig.js'

// 6-digit crypto-random code (uniform, leading zeros kept)
export const generateOtp = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0')

// High-entropy URL-safe token (email verification / password reset)
export const generateToken = () => crypto.randomBytes(32).toString('base64url')

export const keyedHash = (value, label = 'otp') =>
    crypto.createHmac('sha256', otpSecret()).update(`${label}:${value}`).digest('hex')

export const safeEqualHex = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false
    const ba = Buffer.from(a, 'hex'), bb = Buffer.from(b, 'hex')
    return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb)
}

export const normalizeEmail = (v) => {
    const e = typeof v === 'string' ? v.trim().toLowerCase().slice(0, 254) : ''
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e) ? e : ''
}

// Indian 10-digit mobiles become +91XXXXXXXXXX; other numbers must be full E.164.
export const normalizePhone = (v) => {
    if (typeof v !== 'string') return ''
    const raw = v.replace(/[\s\-().]/g, '')
    if (/^[6-9]\d{9}$/.test(raw)) return `+91${raw}`
    if (/^0[6-9]\d{9}$/.test(raw)) return `+91${raw.slice(1)}`
    if (/^91[6-9]\d{9}$/.test(raw)) return `+${raw}`
    if (/^\+[1-9]\d{7,14}$/.test(raw)) return raw
    return ''
}

export const normalizeDestination = (channel, v) => channel === 'email' ? normalizeEmail(v) : channel === 'sms' ? normalizePhone(v) : ''
