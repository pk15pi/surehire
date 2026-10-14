import { rateLimit } from 'express-rate-limit'

// Rate limiter for public enquiry form submissions (per IP)
export const enquiryRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    limit: 10,                // 10 submissions per window per IP
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many submissions from this device. Please try again in a few minutes.'
        })
    }
})

// Admin login: strict per-IP limit; successful logins don't count against it
export const adminLoginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({
            success: false,
            message: 'Too many login attempts. Please try again in 15 minutes.'
        })
    }
})

// Authenticated admin API: generous limit, just a safety net
export const adminApiRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 600,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ success: false, message: 'Too many requests. Please slow down.' })
    }
})

// Recruiter (company) login / registration: per-IP brute-force protection
export const companyAuthRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ success: false, message: 'Too many attempts. Please try again in 15 minutes.' })
    }
})

// OTP / verification-link sends: per-IP cap (per-destination cooldown + hourly cap live in otpService)
const envInt = (k, d) => { const n = parseInt(process.env[k], 10); return Number.isFinite(n) && n > 0 ? n : d }
export const otpSendRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: () => envInt('OTP_IP_SEND_LIMIT', 10),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ success: false, message: 'Too many code requests from this device. Please try again later.' })
    }
})

// Code / token checks: per-IP cap on top of the per-code attempt limit
export const otpVerifyRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: () => envInt('OTP_IP_VERIFY_LIMIT', 30),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (req, res) => {
        res.status(429).json({ success: false, message: 'Too many attempts. Please try again in 15 minutes.' })
    }
})
