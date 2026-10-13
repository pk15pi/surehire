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
