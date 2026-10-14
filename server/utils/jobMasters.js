import mongoose from 'mongoose'
import { MASTER_TYPES, typeFilter } from '../master/registry.js'

// ---------------------------------------------------------------------------
// Job <-> master data integration.
// Admin job payloads carry master IDs; the legacy text fields (category,
// employmentType, location, ...) are derived from the master labels so the
// public UI, filters and the recruiter flow keep working unchanged.
// ---------------------------------------------------------------------------

const label = (l) => [l.city, l.state, l.country].filter(Boolean).join(', ') || l.name

// idField -> master type + how its label(s) fill legacy text fields
export const JOB_MASTER_REFS = [
    { idField: 'categoryId', type: 'categories', derive: (m) => ({ category: m.name }) },
    { idField: 'employmentTypeId', type: 'employment-types', derive: (m) => ({ employmentType: m.name }) },
    { idField: 'workplaceTypeId', type: 'workplace-types', derive: (m) => ({ workplaceType: m.name }) },
    { idField: 'experienceLevelId', type: 'experience-levels', derive: (m) => ({ experienceLevel: m.name, level: m.name }) },
    { idField: 'departmentId', type: 'departments', derive: (m) => ({ department: m.name }) },
    { idField: 'industryId', type: 'industries', derive: (m) => ({ industry: m.name }) },
    { idField: 'currencyId', type: 'currencies', derive: (m) => ({ currency: m.code || m.name }) },
    { idField: 'salaryPeriodId', type: 'salary-periods', derive: (m) => ({ salaryPeriod: m.name }) },
    // Confidential clients are never named publicly
    { idField: 'clientId', type: 'clients', select: 'name active confidential', derive: (m) => ({ clientName: m.confidential ? '' : m.name }) },
    { idField: 'skillIds', type: 'skills', array: true, derive: (ms) => ({ skills: ms.map(m => m.name) }) },
    {
        idField: 'locationIds', type: 'locations', array: true, select: 'name active city state country address',
        derive: (ms) => ms.length ? ({
            city: ms[0].city || ms[0].name, state: ms[0].state || '', country: ms[0].country || '', address: ms[0].address || '',
            _locationLabels: ms.map(label),
        }) : ({}),
    },
]

// Legacy text fields that admins can no longer set directly (derived from masters)
export const MASTER_TEXT_FIELDS = ['category', 'employmentType', 'workplaceType', 'experienceLevel', 'level', 'department', 'industry',
    'currency', 'salaryPeriod', 'clientName', 'skills', 'city', 'state', 'country', 'address', 'location']

const CLEARABLE_TEXT = { clientId: 'clientName', departmentId: 'department', industryId: 'industry', salaryPeriodId: 'salaryPeriod' }

const sameIds = (a, b) => JSON.stringify((a || []).map(String)) === JSON.stringify((b || []).map(String))

/**
 * Validates master references in a job payload.
 * New values must exist and be active; a value that is unchanged from the
 * stored job may be inactive (legacy reference). Returns derived text fields.
 * @returns {{ refSet: object, refUnset: string[], derived: object, errors: object }}
 */
export const resolveJobMasters = async (body, existing = null) => {
    const src = body && typeof body === 'object' ? body : {}
    const refSet = {}, refUnset = [], derived = {}, errors = {}
    for (const ref of JOB_MASTER_REFS) {
        if (!Object.prototype.hasOwnProperty.call(src, ref.idField)) continue
        const cfg = MASTER_TYPES[ref.type]
        const raw = src[ref.idField]
        const name = cfg.singular.toLowerCase()

        if (ref.array) {
            if (raw === null || raw === '' || (Array.isArray(raw) && raw.length === 0)) {
                refSet[ref.idField] = []
                Object.assign(derived, ref.derive([]))
                continue
            }
            if (!Array.isArray(raw) || raw.some(v => !mongoose.isValidObjectId(v))) { errors[ref.idField] = `Invalid ${name} selection`; continue }
            const ids = [...new Set(raw.map(String))]
            if (ids.length > 50) { errors[ref.idField] = `At most 50 ${cfg.label.toLowerCase()} allowed`; continue }
            const docs = await cfg.model.find({ _id: { $in: ids }, ...typeFilter(cfg) }).select(ref.select || 'name active code').lean()
            const byId = new Map(docs.map(d => [String(d._id), d]))
            const before = new Set((existing?.[ref.idField] || []).map(String))
            const missing = ids.filter(id => !byId.has(id))
            const inactiveNew = ids.filter(id => byId.has(id) && !byId.get(id).active && !before.has(id))
            if (missing.length) { errors[ref.idField] = `${missing.length} selected ${name}(s) no longer exist`; continue }
            if (inactiveNew.length) { errors[ref.idField] = `${inactiveNew.map(id => byId.get(id).name).join(', ')} ${inactiveNew.length > 1 ? 'are' : 'is'} inactive and cannot be selected`; continue }
            const ordered = ids.map(id => byId.get(id))
            refSet[ref.idField] = ordered.map(d => d._id)
            if (!sameIds(existing?.[ref.idField], refSet[ref.idField]) || !existing) Object.assign(derived, ref.derive(ordered))
            continue
        }

        if (raw === null || raw === '') {
            refUnset.push(ref.idField)
            // Clearing an optional reference clears its label too
            if (CLEARABLE_TEXT[ref.idField]) derived[CLEARABLE_TEXT[ref.idField]] = ''
            continue
        }
        if (!mongoose.isValidObjectId(raw)) { errors[ref.idField] = `Invalid ${name} selection`; continue }
        const doc = await cfg.model.findOne({ _id: raw, ...typeFilter(cfg) }).select(ref.select || 'name active code').lean()
        if (!doc) { errors[ref.idField] = `Selected ${name} no longer exists`; continue }
        const unchanged = existing && String(existing[ref.idField] || '') === String(doc._id)
        if (!doc.active && !unchanged) { errors[ref.idField] = `${doc.name} is inactive and cannot be selected`; continue }
        refSet[ref.idField] = doc._id
        if (!unchanged) Object.assign(derived, ref.derive(doc))
    }
    return { refSet, refUnset, derived, errors }
}

// Multi-location display text, respecting Remote / Hybrid
export const multiLocationText = (labels, workplaceType) => {
    const text = labels.join(' / ')
    if (/^remote$/i.test(workplaceType || '')) return text ? `Remote (${text})` : 'Remote'
    if (/^hybrid$/i.test(workplaceType || '') && text) return `${text} (Hybrid)`
    return text
}
