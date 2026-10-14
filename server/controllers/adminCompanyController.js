// Admin-only recruiter/company management: list, create (no password), status + phone edits.
import crypto from 'crypto'
import bcrypt from 'bcrypt'
import mongoose from 'mongoose'
import Company from '../models/Company.js'
import Job from '../models/Job.js'
import { escapeRegex } from '../utils/normalize.js'
import { normalizeEmail, normalizePhone } from '../utils/authCrypto.js'
import { recordAudit } from '../utils/audit.js'

const fail = (res, code, message) => res.status(code).json({ success: false, message })
const STATUSES = ['active', 'suspended']
const view = (c) => ({
    _id: c._id, name: c.name, email: c.email, image: c.image || '', phone: c.phone || '',
    phoneVerified: c.phoneVerified === true, emailVerified: c.emailVerified !== false,
    status: c.status || 'active', createdByAdmin: c.createdByAdmin === true,
})
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : ''

// GET /api/admin/companies?q=&status=&page=
export const listCompanies = async (req, res) => {
    try {
        const qp = req.query || {}
        const limit = 25
        const page = Math.max(1, parseInt(qp.page, 10) || 1)
        const filter = {}
        const q = str(qp.q, 100)
        if (q) { const re = new RegExp(escapeRegex(q), 'i'); filter.$or = [{ name: re }, { email: re }, { phone: re }] }
        if (qp.status === 'suspended') filter.status = 'suspended'
        if (qp.status === 'active') filter.status = { $ne: 'suspended' }
        const [docs, total] = await Promise.all([
            Company.find(filter).select('-password').sort({ name: 1, _id: 1 }).skip((page - 1) * limit).limit(limit).lean(),
            Company.countDocuments(filter),
        ])
        const counts = docs.length ? await Job.aggregate([{ $match: { companyId: { $in: docs.map(d => d._id) } } }, { $group: { _id: '$companyId', n: { $sum: 1 } } }]) : []
        const map = new Map(counts.map(c => [String(c._id), c.n]))
        return res.json({ success: true, items: docs.map(d => ({ ...view(d), jobCount: map.get(String(d._id)) || 0 })), total, page, pages: Math.max(1, Math.ceil(total / limit)) })
    } catch (err) {
        console.error('[admin] listCompanies:', err?.name || 'error')
        return fail(res, 500, 'Something went wrong. Please try again.')
    }
}

// POST /api/admin/companies {name, email, phone?, status?}
// No password is set: an unusable random hash is stored and the recruiter signs in with an
// email code or sets a password via "Forgot password". The admin vouches for the email.
export const createCompany = async (req, res) => {
    const name = str(req.body?.name, 200)
    const email = normalizeEmail(req.body?.email)
    const rawPhone = str(req.body?.phone, 30)
    const phone = rawPhone ? normalizePhone(rawPhone) : ''
    const status = req.body?.status === undefined || req.body?.status === '' ? 'active' : req.body.status
    if (!name) return fail(res, 400, 'Company name is required')
    if (!email) return fail(res, 400, 'Enter a valid email address')
    if (rawPhone && !phone) return fail(res, 400, 'Enter a valid mobile number with country code')
    if (!STATUSES.includes(status)) return fail(res, 400, 'Invalid status')
    try {
        if (await Company.exists({ email })) return fail(res, 409, 'A recruiter with this email already exists')
        if (phone && await Company.exists({ phone })) return fail(res, 409, 'This mobile number is already linked to another account')
        const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10)
        const company = await Company.create({
            name, email, password, image: '', ...(phone ? { phone, phoneVerified: false } : {}),
            emailVerified: true, status, tokenVersion: 0, createdByAdmin: true,
        })
        await recordAudit(req, { action: 'company.create', entityType: 'company', entityId: company._id, entityLabel: `${name} <${email}>`, changes: ['name', 'email', ...(phone ? ['phone'] : []), 'status'], meta: { status } })
        return res.status(201).json({ success: true, company: view(company) })
    } catch (err) {
        if (err?.code === 11000) return fail(res, 409, 'A recruiter with this email or mobile already exists')
        console.error('[admin] createCompany:', err?.name || 'error')
        return fail(res, 500, 'Something went wrong. Please try again.')
    }
}

// PATCH /api/admin/companies/:id {name?, status?, phone?}  (phone edits reset phoneVerified)
export const updateCompany = async (req, res) => {
    const id = String(req.params.id || '')
    if (!mongoose.isValidObjectId(id)) return fail(res, 404, 'Recruiter not found')
    const body = req.body || {}
    const set = {}, unset = {}, changes = []
    try {
        const company = await Company.findById(id)
        if (!company) return fail(res, 404, 'Recruiter not found')
        if (body.name !== undefined) {
            const name = str(body.name, 200)
            if (!name) return fail(res, 400, 'Company name is required')
            if (name !== company.name) { set.name = name; changes.push('name') }
        }
        if (body.status !== undefined) {
            if (!STATUSES.includes(body.status)) return fail(res, 400, 'Invalid status')
            if (body.status !== (company.status || 'active')) { set.status = body.status; changes.push('status') }
        }
        if (body.phone !== undefined) {
            const raw = str(body.phone, 30)
            const phone = raw ? normalizePhone(raw) : ''
            if (raw && !phone) return fail(res, 400, 'Enter a valid mobile number with country code')
            if (phone !== (company.phone || '')) {
                if (phone && await Company.exists({ phone, _id: { $ne: company._id } })) return fail(res, 409, 'This mobile number is already linked to another account')
                if (phone) set.phone = phone; else unset.phone = 1
                set.phoneVerified = false
                unset.pendingPhone = 1
                changes.push('phone', 'phoneVerified')
            }
        }
        if (!changes.length) return res.json({ success: true, company: view(company) })
        const updated = await Company.findByIdAndUpdate(id, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { returnDocument: 'after' })
        await recordAudit(req, { action: 'company.update', entityType: 'company', entityId: id, entityLabel: `${updated.name} <${updated.email}>`, changes, meta: set.status ? { status: set.status } : undefined })
        return res.json({ success: true, company: view(updated) })
    } catch (err) {
        if (err?.code === 11000) return fail(res, 409, 'This mobile number is already linked to another account')
        console.error('[admin] updateCompany:', err?.name || 'error')
        return fail(res, 500, 'Something went wrong. Please try again.')
    }
}
