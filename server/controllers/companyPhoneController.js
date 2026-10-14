// Authenticated recruiter: add / change / verify the account mobile number.
// Flow: send-code {phone} stores it as pendingPhone and texts a 'phone_verify' code bound to
// this company + number; verify {code} moves it to phone with phoneVerified=true.
// Starting a change to a different number clears phoneVerified on the old one.
import Company from '../models/Company.js'
import { normalizePhone } from '../utils/authCrypto.js'
import { issueOtp, verifyOtp } from '../services/otpService.js'
import { smsConfigured, NotificationError } from '../services/notify.js'

const phoneState = (c) => ({ phone: c.phone || '', phoneVerified: c.phoneVerified === true, pendingPhone: c.pendingPhone || '' })
const IN_USE = 'This mobile number is already linked to another account'

// GET /api/company/phone
export const getPhone = async (req, res) => res.json({ success: true, ...phoneState(req.company) })

// POST /api/company/phone/send-code {phone}
export const sendPhoneCode = async (req, res) => {
    const phone = normalizePhone(req.body?.phone)
    if (!phone) return res.status(400).json({ success: false, message: 'Enter a valid mobile number with country code, e.g. +91 98765 43210' })
    if (!smsConfigured()) return res.status(503).json({ success: false, message: 'SMS delivery is not available right now. Please try again later.' })
    const company = req.company
    try {
        if (company.phone === phone && company.phoneVerified === true) return res.json({ success: true, alreadyVerified: true, message: 'This number is already verified.', ...phoneState(company) })
        if (await Company.exists({ phone, _id: { $ne: company._id } })) return res.status(409).json({ success: false, message: IN_USE })
        const r = await issueOtp({ purpose: 'phone_verify', channel: 'sms', destination: phone, bind: String(company._id), companyId: company._id, deliver: true, ip: req.ip })
        if (r.status !== 'sent') {
            res.set('Retry-After', String(r.retryAfter))
            return res.status(429).json({ success: false, message: r.status === 'cooldown' ? `Please wait ${r.retryAfter}s before requesting another code.` : 'Too many codes requested. Please try again later.', retryAfter: r.retryAfter })
        }
        const set = { pendingPhone: phone }
        if (company.phone !== phone) set.phoneVerified = false
        const updated = await Company.findByIdAndUpdate(company._id, { $set: set }, { returnDocument: 'after' })
        return res.json({ success: true, message: 'We sent a 6-digit code to your mobile.', cooldown: r.cooldown, ...phoneState(updated) })
    } catch (err) {
        if (err instanceof NotificationError) return res.status(503).json({ success: false, message: 'We could not send the code right now. Please try again later.' })
        console.error('[company] phone send-code:', err?.name || 'error')
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}

// POST /api/company/phone/verify {code}
export const verifyPhoneCode = async (req, res) => {
    const company = await Company.findById(req.company._id)
    const phone = company?.pendingPhone
    const code = typeof req.body?.code === 'string' ? req.body.code.trim() : ''
    if (!phone) return res.status(400).json({ success: false, message: 'Request a code first.' })
    try {
        const v = await verifyOtp({ purpose: 'phone_verify', channel: 'sms', destination: phone, bind: String(company._id), code })
        if (!v.ok || String(v.companyId) !== String(company._id)) return res.status(400).json({ success: false, message: 'Invalid or expired code' })
        if (await Company.exists({ phone, _id: { $ne: company._id } })) return res.status(409).json({ success: false, message: IN_USE })
        const updated = await Company.findByIdAndUpdate(company._id, { $set: { phone, phoneVerified: true }, $unset: { pendingPhone: 1 } }, { returnDocument: 'after' })
        return res.json({ success: true, message: 'Mobile number verified.', ...phoneState(updated) })
    } catch (err) {
        if (err?.code === 11000) return res.status(409).json({ success: false, message: IN_USE })
        console.error('[company] phone verify:', err?.name || 'error')
        return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}
