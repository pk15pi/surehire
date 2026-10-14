import mongoose from 'mongoose'
import Job from '../models/Job.js'
import JobApplication from '../models/jobApplication.js'
import User from '../models/User.js'
import Client from '../models/Client.js'
import AuditLog from '../models/AuditLog.js'
import Enquiry from '../models/Enquiry.js'
import CallRequest from '../models/CallRequest.js'
import HireRequest from '../models/HireRequest.js'
import CandidateSubmission from '../models/CandidateSubmission.js'
import { escapeRegex } from '../utils/normalize.js'
import { recordAudit } from '../utils/audit.js'

// Dashboard, candidates, applications and audit-log endpoints (all admin-only).

const DAY = 24 * 60 * 60 * 1000
const fail = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra })
const serverError = (res, err, ctx) => {
    console.error(`[admin] ${ctx}:`, err?.message || err)
    return fail(res, 500, 'Something went wrong. Please try again.')
}
const paging = (qp, def = 20, max = 100) => {
    const p = Number.parseInt(qp.page, 10), l = Number.parseInt(qp.limit, 10)
    const page = Number.isFinite(p) && p > 0 ? Math.min(p, 10000) : 1
    const limit = Number.isFinite(l) && l > 0 ? Math.min(l, max) : def
    return { page, limit, skip: (page - 1) * limit }
}
const pageMeta = (total, page, limit) => ({ total, page, pageSize: limit, pages: Math.max(1, Math.ceil(total / limit)) })
export const APPLICATION_STATUSES = ['Pending', 'Accepted', 'Rejected']

// Status filter for jobs, treating legacy docs without `status` by `visible`
const statusMatch = (status) => status === 'published'
    ? { $or: [{ status: 'published' }, { status: { $in: [null] }, visible: { $ne: false } }] }
    : status === 'draft' ? { $or: [{ status: 'draft' }, { status: { $in: [null] }, visible: false }] } : { status }

// GET /api/admin/dashboard  -> every metric from live data, in parallel
export const getDashboard = async (req, res) => {
    try {
        const now = new Date()
        const in14 = new Date(now.getTime() + 14 * DAY)
        const weekAgoMs = now.getTime() - 7 * DAY
        const count = (model, filter = {}) => model.countDocuments(filter)
        const [
            jobsTotal, jobsPublished, jobsDraft, jobsArchived, jobsExpired,
            candidates, appsTotal, appsPending, appsNew7d, clients,
            enqCall, enqQuick, enqHire, enqCandidate, deadlines, recent,
        ] = await Promise.all([
            count(Job), count(Job, statusMatch('published')), count(Job, statusMatch('draft')), count(Job, { status: 'archived' }),
            count(Job, { $and: [statusMatch('published'), { expiresAt: { $lte: now } }] }),
            count(User), count(JobApplication), count(JobApplication, { status: 'Pending' }), count(JobApplication, { date: { $gte: weekAgoMs } }),
            count(Client, { active: true }),
            count(CallRequest, { status: 'new' }), count(Enquiry, { status: 'new' }), count(HireRequest, { status: 'new' }), count(CandidateSubmission, { status: 'new' }),
            Job.find({ status: { $ne: 'archived' }, applicationDeadline: { $gte: new Date(now.getTime() - DAY), $lte: in14 } })
                .select('title referenceId applicationDeadline status visible').sort({ applicationDeadline: 1 }).limit(10).lean(),
            AuditLog.find().sort({ createdAt: -1 }).limit(10).lean(),
        ])
        return res.json({
            success: true,
            generatedAt: now.toISOString(),
            metrics: {
                jobs: { total: jobsTotal, published: jobsPublished, draft: jobsDraft, archived: jobsArchived, expired: jobsExpired },
                candidates: { total: candidates },
                applications: { total: appsTotal, pending: appsPending, last7Days: appsNew7d },
                clients: { active: clients },
                enquiries: { call: enqCall, quick: enqQuick, hire: enqHire, candidate: enqCandidate, total: enqCall + enqQuick + enqHire + enqCandidate },
            },
            upcomingDeadlines: deadlines.map(j => ({ ...j, status: j.status || (j.visible === false ? 'draft' : 'published') })),
            recentActivity: recent.map(({ __v, ...a }) => a),
        })
    } catch (err) {
        return serverError(res, err, 'dashboard')
    }
}

// GET /api/admin/candidates?q=&page=&limit=
export const listCandidates = async (req, res) => {
    try {
        const qp = req.query || {}
        const { page, limit, skip } = paging(qp)
        const filter = {}
        const q = typeof qp.q === 'string' ? qp.q.trim().slice(0, 100) : ''
        if (q) {
            const re = new RegExp(escapeRegex(q), 'i')
            filter.$or = [{ name: re }, { email: re }]
        }
        if (qp.hasResume === 'true') filter.resume = { $nin: [null, ''] }
        const [users, total] = await Promise.all([
            User.find(filter).select('name email image resume').sort({ name: 1, _id: 1 }).skip(skip).limit(limit).lean(),
            User.countDocuments(filter),
        ])
        const counts = users.length ? await JobApplication.aggregate([
            { $match: { userId: { $in: users.map(u => u._id) } } },
            { $group: { _id: '$userId', count: { $sum: 1 }, last: { $max: '$date' } } },
        ]) : []
        const map = new Map(counts.map(c => [String(c._id), c]))
        return res.json({
            success: true,
            items: users.map(({ __v, ...u }) => ({ ...u, hasResume: !!u.resume, applicationCount: map.get(String(u._id))?.count || 0, lastAppliedAt: map.get(String(u._id))?.last || null })),
            ...pageMeta(total, page, limit),
        })
    } catch (err) {
        return serverError(res, err, 'listCandidates')
    }
}

// GET /api/admin/candidates/:id
export const getCandidate = async (req, res) => {
    try {
        const id = String(req.params.id || '').slice(0, 100)
        const user = await User.findById(id).select('name email image resume').lean()
        if (!user) return fail(res, 404, 'Candidate not found')
        const applications = await JobApplication.find({ userId: id }).sort({ date: -1 }).limit(200)
            .populate({ path: 'jobId', select: 'title referenceId location status visible' })
            .populate({ path: 'companyId', select: 'name' }).lean()
        const { __v, ...rest } = user
        return res.json({ success: true, candidate: rest, applications: applications.map(({ __v: _v, ...a }) => a) })
    } catch (err) {
        return serverError(res, err, 'getCandidate')
    }
}

// GET /api/admin/applications?status=&jobId=&userId=&q=&page=&limit=
export const listApplications = async (req, res) => {
    try {
        const qp = req.query || {}
        const { page, limit, skip } = paging(qp)
        const and = []
        if (typeof qp.status === 'string' && qp.status) {
            if (!APPLICATION_STATUSES.includes(qp.status)) return fail(res, 400, 'Invalid status filter')
            and.push({ status: qp.status })
        }
        if (typeof qp.jobId === 'string' && qp.jobId) {
            if (!mongoose.isValidObjectId(qp.jobId)) return fail(res, 400, 'Invalid job filter')
            and.push({ jobId: qp.jobId })
        }
        if (typeof qp.userId === 'string' && qp.userId) and.push({ userId: qp.userId.slice(0, 100) })
        if (qp.since === '7d') and.push({ date: { $gte: Date.now() - 7 * DAY } })
        const q = typeof qp.q === 'string' ? qp.q.trim().slice(0, 100) : ''
        if (q) {
            const re = new RegExp(escapeRegex(q), 'i')
            const [users, jobs] = await Promise.all([
                User.find({ $or: [{ name: re }, { email: re }] }).select('_id').limit(500).lean(),
                Job.find({ $or: [{ title: re }, { referenceId: re }] }).select('_id').limit(500).lean(),
            ])
            and.push({ $or: [{ userId: { $in: users.map(u => u._id) } }, { jobId: { $in: jobs.map(j => j._id) } }] })
        }
        const filter = and.length ? { $and: and } : {}
        const [items, total] = await Promise.all([
            JobApplication.find(filter).sort({ date: -1, _id: -1 }).skip(skip).limit(limit)
                .populate({ path: 'userId', model: User, select: 'name email image resume' })
                .populate({ path: 'jobId', model: Job, select: 'title referenceId clientName location status visible' })
                .populate({ path: 'companyId', select: 'name' }).lean(),
            JobApplication.countDocuments(filter),
        ])
        return res.json({ success: true, statuses: APPLICATION_STATUSES, items: items.map(({ __v, ...a }) => a), ...pageMeta(total, page, limit) })
    } catch (err) {
        return serverError(res, err, 'listApplications')
    }
}

// PATCH /api/admin/applications/:id  body: { status }
export const updateApplicationStatus = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.isValidObjectId(id)) return fail(res, 400, 'Invalid application id')
        const status = req.body?.status
        if (!APPLICATION_STATUSES.includes(status)) return fail(res, 400, `Status must be one of: ${APPLICATION_STATUSES.join(', ')}`, { errors: { status: 'Invalid status' } })
        const before = await JobApplication.findById(id).select('status jobId').lean()
        if (!before) return fail(res, 404, 'Application not found')
        const app = await JobApplication.findByIdAndUpdate(id, { $set: { status } }, { returnDocument: 'after' })
            .populate({ path: 'userId', select: 'name email' }).populate({ path: 'jobId', select: 'title referenceId' }).lean()
        if (before.status !== status) {
            await recordAudit(req, { action: 'status-change', entityType: 'application', entityId: id, entityLabel: app.jobId?.title, changes: ['status'], meta: { from: before.status, to: status } })
        }
        const { __v, ...rest } = app
        return res.json({ success: true, message: 'Application status updated', status: rest.status, item: rest })
    } catch (err) {
        return serverError(res, err, 'updateApplicationStatus')
    }
}

// GET /api/admin/audit-logs?entityType=&action=&actor=&entityId=&page=
export const listAuditLogs = async (req, res) => {
    try {
        const qp = req.query || {}
        const { page, limit, skip } = paging(qp, 50, 200)
        const filter = {}
        for (const k of ['entityType', 'action', 'entityId']) if (typeof qp[k] === 'string' && qp[k]) filter[k] = qp[k].slice(0, 100)
        if (typeof qp.actor === 'string' && qp.actor) filter.actor = qp.actor.toLowerCase().slice(0, 254)
        const [items, total, entityTypes] = await Promise.all([
            AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
            AuditLog.countDocuments(filter),
            AuditLog.distinct('entityType'),
        ])
        return res.json({ success: true, items: items.map(({ __v, ...a }) => a), entityTypes: entityTypes.sort(), ...pageMeta(total, page, limit) })
    } catch (err) {
        return serverError(res, err, 'listAuditLogs')
    }
}
