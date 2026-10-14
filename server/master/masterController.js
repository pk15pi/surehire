import mongoose from 'mongoose'
import Job from '../models/Job.js'
import { MASTER_TYPES, getMasterConfig, typeFilter } from './registry.js'
import { escapeRegex, normalizeText } from '../utils/normalize.js'
import { recordAudit } from '../utils/audit.js'

// ---------------------------------------------------------------------------
// Generic master-data controller. Every handler reads req.params.type and the
// registry config, so one implementation serves all lists.
// ---------------------------------------------------------------------------

const PAGE_SIZE = 25
const MAX_PAGE_SIZE = 500
const fail = (res, code, message, extra = {}) => res.status(code).json({ success: false, message, ...extra })
const serverError = (res, err, ctx) => {
    console.error(`[master] ${ctx}:`, err?.message || err)
    return fail(res, 500, 'Something went wrong. Please try again.')
}
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)
const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

const withConfig = (handler) => async (req, res) => {
    const cfg = getMasterConfig(req.params.type)
    if (!cfg) return fail(res, 404, 'Unknown master data type')
    try {
        return await handler(req, res, cfg)
    } catch (err) {
        if (err?.name === 'ValidationError') {
            const errors = Object.fromEntries(Object.entries(err.errors || {}).map(([k, e]) => [k, e.message]))
            return fail(res, 400, 'Validation failed', { errors })
        }
        if (err?.code === 11000) return duplicateError(res, cfg, err)
        return serverError(res, err, `${req.method} ${req.params.type}`)
    }
}

const duplicateError = (res, cfg, err) => {
    const field = Object.keys(err?.keyPattern || {}).find(k => k !== 'type') || 'key'
    const target = field === 'code' ? 'code' : 'name'
    return fail(res, 409, `A ${cfg.singular.toLowerCase()} with this ${target === 'code' ? 'code' : 'name'} already exists`, { errors: { [target]: 'Already exists' } })
}

// Validate + normalise the editable fields of a master record
const parseInput = async (cfg, body, { partial }) => {
    const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
    const set = {}, unset = [], errors = {}
    for (const [k, spec] of Object.entries(cfg.fields)) {
        if (!has(src, k)) continue
        const v = src[k]
        if (spec.kind === 'boolean') {
            if (typeof v === 'boolean') set[k] = v
            else if (v === 'true' || v === 'false') set[k] = v === 'true'
            else if (isBlank(v)) set[k] = false
            else errors[k] = 'Must be true or false'
            continue
        }
        if (isBlank(v)) {
            if (spec.required) errors[k] = 'This field is required'
            else if (spec.kind === 'number' && (k === 'displayOrder')) set[k] = 0
            else unset.push(k)
            continue
        }
        if (spec.kind === 'string') {
            if (typeof v !== 'string' && typeof v !== 'number') { errors[k] = 'Must be text'; continue }
            let s = normalizeText(v)
            if (spec.upper) s = s.toUpperCase()
            if (s.length > spec.max) errors[k] = `Must be at most ${spec.max} characters`
            else if (spec.pattern && !spec.pattern.test(s)) errors[k] = spec.patternMessage || 'Invalid format'
            else set[k] = s
        } else if (spec.kind === 'number') {
            const n = typeof v === 'number' ? v : Number(String(v).trim())
            if (!Number.isFinite(n)) errors[k] = 'Must be a number'
            else if (spec.integer && !Number.isInteger(n)) errors[k] = 'Must be a whole number'
            else if (n < spec.min || n > spec.max) errors[k] = `Must be between ${spec.min} and ${spec.max}`
            else set[k] = n
        } else if (spec.kind === 'ref') {
            const refCfg = MASTER_TYPES[spec.type]
            if (!mongoose.isValidObjectId(v)) { errors[k] = 'Invalid selection'; continue }
            const ref = await refCfg.model.findOne({ _id: v, ...typeFilter(refCfg) }).select('active').lean()
            if (!ref) errors[k] = `Selected ${refCfg.singular.toLowerCase()} does not exist`
            else set[k] = ref._id
        }
    }
    if (has(src, 'active')) {
        if (typeof src.active === 'boolean') set.active = src.active
        else errors.active = 'Must be true or false'
    }
    if (!partial) for (const [k, spec] of Object.entries(cfg.fields)) if (spec.required && !has(set, k) && !errors[k]) errors[k] = 'This field is required'
    return { set, unset: unset.filter(k => !has(set, k)), errors }
}

// Usage = jobs referencing each id (+ configured extra refs). One aggregation per collection.
export const usageCounts = async (cfg, ids) => {
    const map = new Map(ids.map(id => [String(id), 0]))
    if (!ids.length) return map
    const add = (rows) => { for (const r of rows) map.set(String(r._id), (map.get(String(r._id)) || 0) + r.count) }
    // $unwind treats a scalar as a one-element array, so this works for single and array refs
    add(await Job.aggregate([
        { $match: { [cfg.jobField]: { $in: ids } } },
        { $project: { v: `$${cfg.jobField}` } },
        { $unwind: '$v' },
        { $match: { v: { $in: ids } } },
        { $group: { _id: '$v', count: { $sum: 1 } } },
    ]))
    for (const ref of cfg.refs || []) {
        add(await ref.model.aggregate([
            { $match: { ...(ref.filter || {}), [ref.field]: { $in: ids } } },
            { $group: { _id: `$${ref.field}`, count: { $sum: 1 } } },
        ]))
    }
    return map
}

const toItem = (doc, usage) => {
    const { __v, key, ...rest } = doc
    return usage === undefined ? rest : { ...rest, usageCount: usage }
}

const loadOne = async (req, res, cfg, { select } = {}) => {
    const { id } = req.params
    if (!mongoose.isValidObjectId(id)) { fail(res, 400, 'Invalid id'); return null }
    const q = cfg.model.findOne({ _id: id, ...typeFilter(cfg) })
    if (select || cfg.adminSelect) q.select(select || cfg.adminSelect)
    const doc = await q.lean()
    if (!doc) { fail(res, 404, `${cfg.singular} not found`); return null }
    return doc
}

// Recomputes the unique key; returns an error response if it collides
const checkKey = async (res, cfg, merged, excludeId) => {
    const key = cfg.keyOf(merged)
    if (!key) { fail(res, 400, 'Please fix the highlighted fields', { errors: { name: 'This field is required' } }); return null }
    const clash = await cfg.model.findOne({ ...typeFilter(cfg), key, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).select('_id').lean()
    if (clash) { fail(res, 409, `A ${cfg.singular.toLowerCase()} with this name${cfg.model.modelName === 'Location' ? '/place' : ''} already exists`, { errors: { name: 'Already exists' } }); return null }
    if (merged.code && cfg.fields.code && cfg.model.modelName === 'Client') {
        const codeClash = await cfg.model.findOne({ code: merged.code, ...(excludeId ? { _id: { $ne: excludeId } } : {}) }).select('_id').lean()
        if (codeClash) { fail(res, 409, 'A client with this code already exists', { errors: { code: 'Already exists' } }); return null }
    }
    return key
}

// GET /api/admin/master/:type?q=&page=&limit=&includeInactive=true&sort=name|displayOrder|createdAt
export const listMaster = withConfig(async (req, res, cfg) => {
    const qp = req.query || {}
    const filter = { ...typeFilter(cfg) }
    if (qp.includeInactive !== 'true' && qp.includeInactive !== '1') filter.active = true
    if (qp.active === 'false') filter.active = false
    const q = typeof qp.q === 'string' ? qp.q.trim().slice(0, 100) : ''
    if (q) {
        const re = new RegExp(escapeRegex(q), 'i')
        filter.$or = cfg.searchFields.map(f => ({ [f]: re }))
    }
    const pageNum = Number.parseInt(qp.page, 10)
    const page = Number.isFinite(pageNum) && pageNum > 0 ? Math.min(pageNum, 10000) : 1
    const limitNum = Number.parseInt(qp.limit, 10)
    const limit = Number.isFinite(limitNum) && limitNum > 0 ? Math.min(limitNum, MAX_PAGE_SIZE) : PAGE_SIZE
    const sort = qp.sort === 'name' ? { name: 1, _id: 1 } : qp.sort === 'createdAt' ? { createdAt: -1, _id: -1 } : { displayOrder: 1, name: 1, _id: 1 }

    const [docs, total] = await Promise.all([
        cfg.model.find(filter).sort(sort).skip((page - 1) * limit).limit(limit).lean(),
        cfg.model.countDocuments(filter),
    ])
    const usage = await usageCounts(cfg, docs.map(d => d._id))
    return res.json({
        success: true,
        items: docs.map(d => toItem(d, usage.get(String(d._id)) || 0)),
        total, page, pageSize: limit, pages: Math.max(1, Math.ceil(total / limit)),
    })
})

// GET /api/admin/master/:type/:id
export const getMaster = withConfig(async (req, res, cfg) => {
    const doc = await loadOne(req, res, cfg)
    if (!doc) return
    const usage = await usageCounts(cfg, [doc._id])
    return res.json({ success: true, item: toItem(doc, usage.get(String(doc._id)) || 0) })
})

// POST /api/admin/master/:type
export const createMaster = withConfig(async (req, res, cfg) => {
    const { set, errors } = await parseInput(cfg, req.body, { partial: false })
    const extra = cfg.validate?.(set)
    if (extra) Object.assign(errors, extra)
    if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted fields', { errors })
    const key = await checkKey(res, cfg, set)
    if (!key) return
    const doc = await cfg.model.create({ ...set, ...typeFilter(cfg), key, createdBy: req.admin.email, updatedBy: req.admin.email })
    await recordAudit(req, { action: 'create', entityType: `master:${req.params.type}`, entityId: doc._id, entityLabel: doc.name, changes: Object.keys(set) })
    const out = await cfg.model.findById(doc._id).select(cfg.adminSelect || '').lean()
    return res.status(201).json({ success: true, message: `${cfg.singular} created`, item: toItem(out, 0) })
})

// PATCH /api/admin/master/:type/:id  (only provided fields change)
export const updateMaster = withConfig(async (req, res, cfg) => {
    const existing = await loadOne(req, res, cfg)
    if (!existing) return
    const { set, unset, errors } = await parseInput(cfg, req.body, { partial: true })
    const merged = { ...existing, ...set }
    for (const k of unset) merged[k] = null
    const extra = cfg.validate?.(merged)
    if (extra) Object.assign(errors, extra)
    if (Object.keys(errors).length) return fail(res, 400, 'Please fix the highlighted fields', { errors })
    if (!Object.keys(set).length && !unset.length) return fail(res, 400, 'Nothing to update')
    const key = await checkKey(res, cfg, merged, existing._id)
    if (!key) return
    const update = { $set: { ...set, key, updatedBy: req.admin.email } }
    if (unset.length) update.$unset = Object.fromEntries(unset.map(k => [k, 1]))
    const doc = await cfg.model.findOneAndUpdate({ _id: existing._id }, update, { returnDocument: 'after', runValidators: true }).select(cfg.adminSelect || '').lean()
    await recordAudit(req, { action: 'update', entityType: `master:${req.params.type}`, entityId: doc._id, entityLabel: doc.name, changes: [...Object.keys(set), ...unset] })
    const usage = await usageCounts(cfg, [doc._id])
    return res.json({ success: true, message: `${cfg.singular} updated`, item: toItem(doc, usage.get(String(doc._id)) || 0) })
})

const setActive = (active) => withConfig(async (req, res, cfg) => {
    const existing = await loadOne(req, res, cfg)
    if (!existing) return
    const doc = await cfg.model.findOneAndUpdate({ _id: existing._id }, { $set: { active, updatedBy: req.admin.email } }, { returnDocument: 'after' }).select(cfg.adminSelect || '').lean()
    if (existing.active !== active) {
        await recordAudit(req, { action: active ? 'activate' : 'deactivate', entityType: `master:${req.params.type}`, entityId: doc._id, entityLabel: doc.name, changes: ['active'] })
    }
    const usage = await usageCounts(cfg, [doc._id])
    return res.json({ success: true, message: `${cfg.singular} ${active ? 'activated' : 'deactivated'}`, item: toItem(doc, usage.get(String(doc._id)) || 0) })
})

// POST /api/admin/master/:type/:id/activate | /deactivate
export const activateMaster = setActive(true)
export const deactivateMaster = setActive(false)

// DELETE /api/admin/master/:type/:id -> 409 while anything references it
export const deleteMaster = withConfig(async (req, res, cfg) => {
    const existing = await loadOne(req, res, cfg)
    if (!existing) return
    const usage = (await usageCounts(cfg, [existing._id])).get(String(existing._id)) || 0
    if (usage > 0) {
        return fail(res, 409, `"${existing.name}" is used by ${usage} record(s) (jobs or other master data) and cannot be deleted. Deactivate it instead so it is hidden from new selections.`, { usageCount: usage })
    }
    await cfg.model.deleteOne({ _id: existing._id })
    await recordAudit(req, { action: 'delete', entityType: `master:${req.params.type}`, entityId: existing._id, entityLabel: existing.name })
    return res.json({ success: true, message: `${cfg.singular} deleted` })
})

// GET /api/admin/master  -> available types (for the Master Data index page)
export const listMasterTypes = async (req, res) => {
    try {
        const types = await Promise.all(Object.entries(MASTER_TYPES).map(async ([type, cfg]) => {
            const [total, active] = await Promise.all([
                cfg.model.countDocuments(typeFilter(cfg)),
                cfg.model.countDocuments({ ...typeFilter(cfg), active: true }),
            ])
            // Field specs drive the generic admin form (no duplicated config in the client)
            const fields = Object.entries(cfg.fields).map(([name, f]) => ({
                name, kind: f.kind, required: !!f.required, max: f.max, min: f.min, refType: f.type, upper: !!f.upper,
            }))
            return { type, label: cfg.label, singular: cfg.singular, jobField: cfg.jobField, total, active, fields }
        }))
        return res.json({ success: true, types })
    } catch (err) {
        return serverError(res, err, 'listMasterTypes')
    }
}

// GET /api/master/:type  (public, active records, safe fields only)
export const publicMasterList = async (req, res) => {
    const cfg = getMasterConfig(req.params.type)
    if (!cfg) return fail(res, 404, 'Unknown master data type')
    try {
        const items = await cfg.model.find({ ...typeFilter(cfg), ...(cfg.publicFilter || {}), active: true })
            .select(cfg.publicFields.join(' '))
            .sort({ displayOrder: 1, name: 1 }).limit(1000).lean()
        res.set('Cache-Control', 'public, max-age=60, s-maxage=300')
        return res.json({ success: true, items })
    } catch (err) {
        return serverError(res, err, 'publicMasterList')
    }
}
