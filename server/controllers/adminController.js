import mongoose from "mongoose"
import { v2 as cloudinary } from "cloudinary"
import CallRequest from "../models/CallRequest.js"
import Enquiry from "../models/Enquiry.js"
import HireRequest from "../models/HireRequest.js"
import CandidateSubmission from "../models/CandidateSubmission.js"
import Job from "../models/Job.js"
import JobApplication from "../models/jobApplication.js"
import User from "../models/User.js"
import { getAdminConfig, signAdminToken, verifyAdminCredentials } from "../middleware/adminAuth.js"

// Submission types the admin panel can manage. `fileField` holds a private Cloudinary document.
const TYPES = {
    call: { model: CallRequest, search: ['referenceId', 'name', 'email', 'phone'] },
    enquiry: { model: Enquiry, search: ['referenceId', 'name', 'email', 'subject'] },
    hire: { model: HireRequest, search: ['referenceId', 'companyName', 'contactName', 'email', 'roleTitle', 'location'], fileField: 'jdFile' },
    candidate: { model: CandidateSubmission, search: ['referenceId', 'fullName', 'email', 'discipline', 'currentLocation'], fileField: 'resume' },
}

// Server-side status allowlist per type, taken from each model's schema enum
const statusesFor = (cfg) => cfg.model.schema.path('status').enumValues

const SIGNED_URL_TTL_SECONDS = 5 * 60
const MAX_NOTES = 5000
const PAGE_SIZE = 20

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const serverError = (res, error, context) => {
    console.error(`[admin] ${context}:`, error?.message || error)
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
}

// Remove internal storage identifiers before sending a document to the browser
const sanitize = (doc, fileField) => {
    const { __v, ...rest } = doc
    if (fileField && rest[fileField]) {
        const { publicId, resourceType, deliveryType, ...meta } = rest[fileField]
        rest[fileField] = meta
    }
    return rest
}

// POST /api/admin/login
export const adminLogin = async (req, res) => {
    try {
        const cfg = getAdminConfig()
        if (!cfg.configured) {
            console.error('[admin] login disabled - missing/invalid env:', cfg.problems.join(', '))
            return res.status(503).json({ success: false, message: 'Admin access is not configured' })
        }
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().slice(0, 254) : ''
        const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 256) : ''
        if (!email || !password) {
            return res.status(400).json({ success: false, message: 'Email and password are required' })
        }

        const ok = await verifyAdminCredentials(cfg, email, password)
        if (!ok) return res.status(401).json({ success: false, message: 'Invalid email or password' })

        const { token, expiresAt } = signAdminToken(cfg, email.toLowerCase())
        return res.json({ success: true, token, expiresAt, email: email.toLowerCase() })
    } catch (error) {
        return serverError(res, error, 'login')
    }
}

// GET /api/admin/me
export const adminMe = (req, res) => res.json({ success: true, email: req.admin.email })

// GET /api/admin/submissions?type=call|enquiry|hire|candidate&status=&q=&page=
export const listSubmissions = async (req, res) => {
    try {
        const type = String(req.query.type || '')
        const cfg = TYPES[type]
        if (!cfg) return res.status(400).json({ success: false, message: 'Invalid submission type' })

        const statuses = statusesFor(cfg)
        const filter = {}

        const status = typeof req.query.status === 'string' ? req.query.status : ''
        if (status) {
            if (!statuses.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status filter' })
            filter.status = status
        }

        const q = typeof req.query.q === 'string' ? req.query.q.trim().slice(0, 100) : ''
        if (q) {
            const re = new RegExp(escapeRegex(q), 'i')
            filter.$or = cfg.search.map(field => ({ [field]: re }))
        }

        const pageNum = Number.parseInt(req.query.page, 10)
        const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 10000) : 1

        const [items, total] = await Promise.all([
            cfg.model.find(filter).sort({ createdAt: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE).lean(),
            cfg.model.countDocuments(filter),
        ])

        return res.json({
            success: true,
            type,
            statuses,
            items: items.map(d => sanitize(d, cfg.fileField)),
            total,
            page,
            pageSize: PAGE_SIZE,
            pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        })
    } catch (error) {
        return serverError(res, error, 'listSubmissions')
    }
}

// PATCH /api/admin/submissions/:type/:id   body: { status?, notes? }
export const updateSubmission = async (req, res) => {
    try {
        const cfg = TYPES[req.params.type]
        if (!cfg) return res.status(400).json({ success: false, message: 'Invalid submission type' })
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' })

        const body = req.body && typeof req.body === 'object' ? req.body : {}
        const update = {}

        if (body.status !== undefined) {
            if (typeof body.status !== 'string' || !statusesFor(cfg).includes(body.status)) {
                return res.status(400).json({ success: false, message: 'Invalid status for this submission type' })
            }
            update.status = body.status
        }
        if (body.notes !== undefined) {
            if (typeof body.notes !== 'string') return res.status(400).json({ success: false, message: 'Notes must be text' })
            const notes = body.notes.trim()
            if (notes.length > MAX_NOTES) return res.status(400).json({ success: false, message: `Notes must be at most ${MAX_NOTES} characters` })
            update.adminNotes = notes
        }
        if (!Object.keys(update).length) return res.status(400).json({ success: false, message: 'Nothing to update' })

        update.adminUpdatedAt = new Date()
        update.adminUpdatedBy = req.admin.email

        const doc = await cfg.model.findByIdAndUpdate(req.params.id, { $set: update }, { returnDocument: 'after', runValidators: true }).lean()
        if (!doc) return res.status(404).json({ success: false, message: 'Submission not found' })

        return res.json({ success: true, message: 'Updated', item: sanitize(doc, cfg.fileField) })
    } catch (error) {
        return serverError(res, error, 'updateSubmission')
    }
}

// GET /api/admin/resumes/:id/url?type=candidate|hire
// Returns a short-lived signed Cloudinary download URL for a private resume (candidate) or JD (hire).
export const getDocumentUrl = async (req, res) => {
    try {
        const type = req.query.type === 'hire' ? 'hire' : 'candidate'
        const cfg = TYPES[type]
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' })

        const doc = await cfg.model.findById(req.params.id).select(`${cfg.fileField} referenceId`).lean()
        const file = doc?.[cfg.fileField]
        if (!file?.publicId) return res.status(404).json({ success: false, message: 'No document attached' })

        const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS
        const url = cloudinary.utils.private_download_url(file.publicId, '', {
            resource_type: file.resourceType || 'raw',
            type: file.deliveryType || 'authenticated',
            expires_at: expiresAt,
        })

        return res.json({
            success: true,
            url,
            expiresAt: new Date(expiresAt * 1000).toISOString(),
            fileName: file.originalName || doc.referenceId,
        })
    } catch (error) {
        return serverError(res, error, 'getDocumentUrl')
    }
}

// ---------------------------------------------------------------------------
// Job applications (Clerk candidates applying via "Apply Now").
// Covers admin-posted jobs (companyId null) and recruiter jobs alike.
// ---------------------------------------------------------------------------
export const APPLICATION_STATUSES = ['Pending', 'Accepted', 'Rejected']

// GET /api/admin/applications?jobId=&status=&page=
export const listApplications = async (req, res) => {
    try {
        const filter = {}
        const jobId = typeof req.query.jobId === 'string' ? req.query.jobId : ''
        if (jobId) {
            if (!mongoose.isValidObjectId(jobId)) return res.status(400).json({ success: false, message: 'Invalid job id' })
            filter.jobId = jobId
        }
        const status = typeof req.query.status === 'string' ? req.query.status : ''
        if (status) {
            if (!APPLICATION_STATUSES.includes(status)) return res.status(400).json({ success: false, message: 'Invalid status filter' })
            filter.status = status
        }
        const pageNum = Number.parseInt(req.query.page, 10)
        const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 10000) : 1

        const [items, total] = await Promise.all([
            JobApplication.find(filter).sort({ date: -1 }).skip((page - 1) * PAGE_SIZE).limit(PAGE_SIZE)
                .populate({ path: 'userId', model: User, select: 'name email image resume' })
                .populate({ path: 'jobId', model: Job, select: 'title referenceId clientName location status visible' })
                .lean(),
            JobApplication.countDocuments(filter),
        ])

        return res.json({
            success: true,
            statuses: APPLICATION_STATUSES,
            items: items.map(({ __v, ...a }) => a),
            total, page, pageSize: PAGE_SIZE,
            pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
        })
    } catch (error) {
        return serverError(res, error, 'listApplications')
    }
}

// PATCH /api/admin/applications/:id   body: { status }
export const updateApplicationStatus = async (req, res) => {
    try {
        if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' })
        const status = req.body?.status
        if (typeof status !== 'string' || !APPLICATION_STATUSES.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' })
        }
        const doc = await JobApplication.findByIdAndUpdate(req.params.id, { $set: { status } }, { returnDocument: 'after' }).lean()
        if (!doc) return res.status(404).json({ success: false, message: 'Application not found' })
        return res.json({ success: true, message: 'Status updated', status: doc.status })
    } catch (error) {
        return serverError(res, error, 'updateApplicationStatus')
    }
}

// GET /api/admin/overview -> real counts straight from the database (no estimates)
export const getOverview = async (req, res) => {
    try {
        const countBy = async (model, field) => {
            const rows = await model.aggregate([{ $group: { _id: `$${field}`, count: { $sum: 1 } } }])
            return Object.fromEntries(rows.map(r => [r._id == null ? 'unset' : String(r._id), r.count]))
        }
        const [jobs, applications, call, enquiry, hire, candidate] = await Promise.all([
            countBy(Job, 'status'),
            countBy(JobApplication, 'status'),
            countBy(CallRequest, 'status'),
            countBy(Enquiry, 'status'),
            countBy(HireRequest, 'status'),
            countBy(CandidateSubmission, 'status'),
        ])
        return res.json({ success: true, generatedAt: new Date().toISOString(), jobs, applications, submissions: { call, enquiry, hire, candidate } })
    } catch (error) {
        return serverError(res, error, 'getOverview')
    }
}
