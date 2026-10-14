import mongoose from 'mongoose'
import Job, { JOB_STATUSES, generateReferenceId, effectiveStatus } from '../models/Job.js'
import Location from '../models/Location.js'
import JobApplication from '../models/jobApplication.js'
import { parseJobInput, mongooseErrors } from '../utils/jobInput.js'
import { JOB_MASTER_REFS, MASTER_TEXT_FIELDS, multiLocationText, resolveJobMasters } from '../utils/jobMasters.js'
import { MASTER_TYPES, typeFilter } from '../master/registry.js'
import { suggestJobMasters } from '../master/migrateJobMasters.js'
import { recordAudit } from '../utils/audit.js'

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

// Admin payload -> validated $set/$unset. Master-controlled legacy text is ignored
// in the input and re-derived from the referenced masters.
const buildJobChanges = async (rawBody, existing) => {
    const body = { ...(rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody : {}) }
    for (const k of MASTER_TEXT_FIELDS) delete body[k]
    const { refSet, refUnset, derived, errors: refErrors } = await resolveJobMasters(body, existing)
    const { _locationLabels, ...derivedText } = derived
    const partial = !!existing
    const { set, unset, errors } = parseJobInput({ ...body, ...derivedText }, { partial, existing })
    Object.assign(errors, refErrors)
    // An On-site/Hybrid job needs a location: show the error on the location picker
    if (errors.city) { errors.locationIds ||= errors.city; delete errors.city }
    if (errors.currency) { errors.currencyId = errors.currency; delete errors.currency }
    // Core classification is required when creating a job
    if (!existing) {
        for (const [k, msg] of [['categoryId', 'Category is required'], ['employmentTypeId', 'Employment type is required'], ['workplaceTypeId', 'Workplace type is required']]) {
            if (!refSet[k] && !errors[k]) errors[k] = msg
        }
    }
    Object.assign(set, refSet)
    const allUnset = [...unset, ...refUnset.filter(k => !has(set, k))]

    // Multi-location label (and keep it right when only the workplace type changes)
    const finalLocIds = has(set, 'locationIds') ? set.locationIds : (existing?.locationIds || [])
    const workplace = has(set, 'workplaceType') ? set.workplaceType : existing?.workplaceType
    if (finalLocIds.length && (_locationLabels || has(set, 'workplaceType') || has(set, 'location'))) {
        let labels = _locationLabels
        if (!labels) {
            const docs = await Location.find({ _id: { $in: finalLocIds } }).select('name city state country').lean()
            const byId = new Map(docs.map(d => [String(d._id), d]))
            labels = finalLocIds.map(id => byId.get(String(id))).filter(Boolean).map(l => [l.city, l.state, l.country].filter(Boolean).join(', ') || l.name)
        }
        if (labels.length) set.location = multiLocationText(labels, workplace)
    }
    return { set, unset: allUnset.filter(k => !has(set, k)), errors }
}

// ---------------------------------------------------------------------------
// Admin job management (mounted under /api/admin/jobs, protected by protectAdmin).
// Response shape: { success, message?, ... }. Never modifies JobApplication docs.
// ---------------------------------------------------------------------------

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 100
const ADMIN_SELECT = '+internalNotes +createdBy +updatedBy'
const SORTS = {
    createdAt: 'createdAt', title: 'title', deadline: 'applicationDeadline', updatedAt: 'updatedAt',
}

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const fail = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra })
const serverError = (res, error, context) => {
    console.error(`[admin-jobs] ${context}:`, error?.message || error)
    return fail(res, 500, 'Something went wrong. Please try again.')
}

const handleWriteError = (res, error, context) => {
    if (error?.name === 'ValidationError') return fail(res, 400, 'Validation failed', { errors: mongooseErrors(error) })
    if (error?.code === 11000) {
        const field = Object.keys(error.keyPattern || error.keyValue || { referenceId: 1 })[0]
        return fail(res, 409, field === 'referenceId' ? 'A job with this reference ID already exists' : 'Duplicate value', { errors: { [field]: 'Already in use' } })
    }
    return serverError(res, error, context)
}

const toAdminJob = (doc, applicationCount) => {
    const { __v, ...job } = doc
    return { ...job, status: effectiveStatus(job), ...(applicationCount !== undefined ? { applicationCount } : {}) }
}

// Validates :id and loads the job (with internal fields). Sends 400/404 itself.
const loadJob = async (req, res, { lean = true } = {}) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { fail(res, 400, 'Invalid job id'); return null }
    const q = Job.findById(id).select(ADMIN_SELECT)
    const job = lean ? await q.lean() : await q
    if (!job) { fail(res, 404, 'Job not found'); return null }
    return job
}

const countApplications = (jobId) => JobApplication.countDocuments({ jobId })

// Creates a doc, retrying on the (very unlikely) auto-generated referenceId collision
const createWithReference = async (data, autoRef) => {
    for (let attempt = 0; attempt < 5; attempt++) {
        if (autoRef) data.referenceId = generateReferenceId()
        try {
            return await Job.create(data)
        } catch (err) {
            if (!(autoRef && err?.code === 11000 && err.keyPattern?.referenceId)) throw err
        }
    }
    throw new Error('Could not allocate a unique reference ID')
}

// GET /api/admin/jobs?q=&status=&employmentType=&workplaceType=&category=&sort=&order=&page=&limit=
export const listJobs = async (req, res) => {
    try {
        const qp = req.query || {}
        const and = []

        const q = typeof qp.q === 'string' ? qp.q.trim().slice(0, 100) : ''
        if (q) {
            const re = new RegExp(escapeRegex(q), 'i')
            and.push({ $or: ['title', 'referenceId', 'clientName', 'department', 'city', 'location'].map(f => ({ [f]: re })) })
        }

        const status = typeof qp.status === 'string' ? qp.status : ''
        if (status) {
            if (!JOB_STATUSES.includes(status)) return fail(res, 400, 'Invalid status filter')
            // Legacy docs without `status` count as published (visible) or draft (hidden)
            if (status === 'archived') and.push({ status: 'archived' })
            else if (status === 'published') and.push({ $or: [{ status: 'published' }, { status: { $in: [null] }, visible: { $ne: false } }] })
            else and.push({ $or: [{ status: 'draft' }, { status: { $in: [null] }, visible: false }] })
        }
        // Master filters by id. Jobs not yet linked (legacy) match on the label text.
        for (const ref of JOB_MASTER_REFS) {
            const queryKey = ref.array ? ref.idField.replace(/Ids$/, 'Id') : ref.idField
            const v = typeof qp[queryKey] === 'string' ? qp[queryKey] : ''
            if (!v) continue
            if (!mongoose.isValidObjectId(v)) return fail(res, 400, `Invalid ${queryKey} filter`)
            const cfg = MASTER_TYPES[ref.type]
            const master = await cfg.model.findOne({ _id: v, ...typeFilter(cfg) }).select('name code city').lean()
            if (!master) return fail(res, 400, `Unknown ${cfg.singular.toLowerCase()} filter`)
            const legacy = { categoryId: 'category', employmentTypeId: 'employmentType', workplaceTypeId: 'workplaceType', experienceLevelId: 'experienceLevel', departmentId: 'department', clientId: 'clientName' }[ref.idField]
            const ors = [{ [ref.idField]: master._id }]
            if (legacy) ors.push({ [ref.idField]: { $in: [null] }, [legacy]: new RegExp(`^${escapeRegex(master.name)}$`, 'i') })
            if (ref.idField === 'locationIds' && master.city) ors.push({ locationIds: { $in: [null] }, city: new RegExp(`^${escapeRegex(master.city)}$`, 'i') })
            and.push({ $or: ors })
        }
        if (qp.expired === 'true') and.push({ expiresAt: { $lte: new Date() } })
        // Legacy text filters (kept for old links)
        for (const key of ['employmentType', 'workplaceType']) {
            const v = typeof qp[key] === 'string' ? qp[key].trim().slice(0, 100) : ''
            if (v) and.push({ [key]: v })
        }
        const sortField = SORTS[qp.sort] || 'createdAt'
        const dir = qp.order === 'asc' ? 1 : -1
        // createdAt is missing on legacy docs; fall back to the legacy numeric `date`
        const sort = sortField === 'createdAt' ? { createdAt: dir, date: dir, _id: dir } : { [sortField]: dir, _id: dir }

        const pageNum = Number.parseInt(qp.page, 10)
        const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 10000) : 1
        const limitNum = Number.parseInt(qp.limit, 10)
        const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, PAGE_SIZE_MAX) : PAGE_SIZE_DEFAULT

        const filter = and.length ? { $and: and } : {}
        const [items, total] = await Promise.all([
            Job.find(filter)
                .select('title referenceId clientName clientId department location city state country employmentType workplaceType category categoryId status visible featured applicationDeadline publishAt expiresAt createdAt updatedAt date companyId')
                .populate({ path: 'companyId', select: 'name' })
                .sort(sort).skip((page - 1) * limit).limit(limit).lean(),
            Job.countDocuments(filter),
        ])

        // One aggregation for all application counts on this page (no N+1)
        const counts = items.length
            ? await JobApplication.aggregate([
                { $match: { jobId: { $in: items.map(j => j._id) } } },
                { $group: { _id: '$jobId', count: { $sum: 1 } } },
            ])
            : []
        const countMap = new Map(counts.map(c => [String(c._id), c.count]))

        return res.json({
            success: true,
            items: items.map(j => toAdminJob(j, countMap.get(String(j._id)) || 0)),
            total, page, pageSize: limit,
            pages: Math.max(1, Math.ceil(total / limit)),
            options: { statuses: JOB_STATUSES },
        })
    } catch (error) {
        return serverError(res, error, 'listJobs')
    }
}

// GET /api/admin/jobs/:id
export const getJob = async (req, res) => {
    try {
        const job = await loadJob(req, res)
        if (!job) return
        if (job.companyId) {
            await Job.populate(job, { path: 'companyId', select: 'name image email' })
        }
        const suggestedMasters = await suggestJobMasters(job).catch(() => ({}))
        return res.json({ success: true, job: toAdminJob(job, await countApplications(job._id)), suggestedMasters })
    } catch (error) {
        return serverError(res, error, 'getJob')
    }
}

// POST /api/admin/jobs
export const createJob = async (req, res) => {
    try {
        const { set, errors } = await buildJobChanges(req.body, null)
        if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted fields', { errors })

        if (!set.status) { set.status = 'draft'; set.visible = false }
        const autoRef = !set.referenceId
        if (!autoRef && await Job.exists({ referenceId: set.referenceId })) {
            return fail(res, 409, 'A job with this reference ID already exists', { errors: { referenceId: 'Already in use' } })
        }
        const doc = await createWithReference({
            ...set, date: Date.now(), companyId: null, createdBy: req.admin?.email, updatedBy: req.admin?.email,
        }, autoRef)
        const job = await Job.findById(doc._id).select(ADMIN_SELECT).lean()
        await recordAudit(req, { action: 'create', entityType: 'job', entityId: job._id, entityLabel: `${job.referenceId} ${job.title}`, changes: Object.keys(set), meta: { status: job.status } })
        return res.status(201).json({ success: true, message: 'Job created', job: toAdminJob(job, 0) })
    } catch (error) {
        return handleWriteError(res, error, 'createJob')
    }
}

// PATCH /api/admin/jobs/:id  (partial update; only provided whitelisted fields change)
export const updateJob = async (req, res) => {
    try {
        const existing = await loadJob(req, res)
        if (!existing) return
        const { set, unset, errors } = await buildJobChanges(req.body, existing)
        if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted fields', { errors })
        if (!Object.keys(set).length && !unset.length) return fail(res, 400, 'Nothing to update')

        if (set.referenceId && set.referenceId !== existing.referenceId && await Job.exists({ referenceId: set.referenceId, _id: { $ne: existing._id } })) {
            return fail(res, 409, 'A job with this reference ID already exists', { errors: { referenceId: 'Already in use' } })
        }
        // Legacy docs get a reference ID the first time they are edited
        if (!existing.referenceId && !set.referenceId) set.referenceId = generateReferenceId()
        set.updatedBy = req.admin?.email

        const update = { $set: set }
        if (unset.length) update.$unset = Object.fromEntries(unset.map(k => [k, 1]))
        const job = await Job.findByIdAndUpdate(existing._id, update, { returnDocument: 'after', runValidators: true, context: 'query' })
            .select(ADMIN_SELECT).lean()
        if (!job) return fail(res, 404, 'Job not found')
        await recordAudit(req, { action: 'update', entityType: 'job', entityId: job._id, entityLabel: `${job.referenceId} ${job.title}`, changes: [...Object.keys(set), ...unset].filter(k => k !== 'updatedBy') })
        return res.json({ success: true, message: 'Job updated', job: toAdminJob(job, await countApplications(job._id)) })
    } catch (error) {
        return handleWriteError(res, error, 'updateJob')
    }
}

const setStatus = (status, message) => async (req, res) => {
    try {
        const existing = await loadJob(req, res)
        if (!existing) return
        const set = { status, visible: status === 'published', updatedBy: req.admin?.email }
        if (!existing.referenceId) set.referenceId = generateReferenceId()
        if (status === 'published') {
            if (existing.expiresAt && new Date(existing.expiresAt) <= new Date()) {
                return fail(res, 400, 'This job has expired. Update the expiry date before publishing.', { errors: { expiresAt: 'Expiry date is in the past' } })
            }
        }
        const job = await Job.findByIdAndUpdate(existing._id, { $set: set }, { returnDocument: 'after', runValidators: true })
            .select(ADMIN_SELECT).lean()
        await recordAudit(req, { action: status === 'published' ? 'publish' : status === 'draft' ? 'unpublish' : 'archive', entityType: 'job', entityId: job._id, entityLabel: `${job.referenceId} ${job.title}`, changes: ['status', 'visible'], meta: { from: effectiveStatus(existing), to: status } })
        return res.json({ success: true, message, job: toAdminJob(job, await countApplications(job._id)) })
    } catch (error) {
        return handleWriteError(res, error, `setStatus:${status}`)
    }
}

// POST /api/admin/jobs/:id/publish | /unpublish | /archive
export const publishJob = setStatus('published', 'Job published')
export const unpublishJob = setStatus('draft', 'Job unpublished')
export const archiveJob = setStatus('archived', 'Job archived')

// POST /api/admin/jobs/:id/duplicate -> new draft with a fresh reference ID
export const duplicateJob = async (req, res) => {
    try {
        const existing = await loadJob(req, res)
        if (!existing) return
        const { _id, __v, referenceId, createdAt, updatedAt, status, visible, publishAt, expiresAt, featured, ...rest } = existing
        const doc = await createWithReference({
            ...rest,
            title: `${existing.title} (Copy)`.slice(0, 200),
            status: 'draft', visible: false, featured: false,
            date: Date.now(), createdBy: req.admin?.email, updatedBy: req.admin?.email,
        }, true)
        const job = await Job.findById(doc._id).select(ADMIN_SELECT).lean()
        await recordAudit(req, { action: 'duplicate', entityType: 'job', entityId: job._id, entityLabel: `${job.referenceId} ${job.title}`, meta: { sourceId: String(existing._id), sourceReference: existing.referenceId || '' } })
        return res.status(201).json({ success: true, message: 'Job duplicated as draft', job: toAdminJob(job, 0) })
    } catch (error) {
        return handleWriteError(res, error, 'duplicateJob')
    }
}

// DELETE /api/admin/jobs/:id -> only when no applications exist (otherwise archive)
export const deleteJob = async (req, res) => {
    try {
        const existing = await loadJob(req, res)
        if (!existing) return
        const count = await countApplications(existing._id)
        if (count > 0) {
            return fail(res, 409, `This job has ${count} application(s) and cannot be deleted. Archive it instead.`, { applicationCount: count })
        }
        await Job.deleteOne({ _id: existing._id })
        await recordAudit(req, { action: 'delete', entityType: 'job', entityId: existing._id, entityLabel: `${existing.referenceId || ''} ${existing.title}`.trim() })
        return res.json({ success: true, message: 'Job deleted' })
    } catch (error) {
        return serverError(res, error, 'deleteJob')
    }
}
