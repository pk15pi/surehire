import {
    EMPLOYMENT_TYPES, WORKPLACE_TYPES, SALARY_PERIODS, JOB_STATUSES, REFERENCE_ID_REGEX, buildLocation,
} from '../models/Job.js'
import { sanitizeHtml, isHtmlEmpty } from './sanitizeHtml.js'

// ---------------------------------------------------------------------------
// Server-side validation + normalisation of job payloads (admin create/PATCH).
// Only whitelisted fields are read; unknown keys are ignored. For PATCH only
// the keys present in the body are touched, so omitted fields are never reset.
// An empty string / null for an optional field means "clear it".
// ---------------------------------------------------------------------------

const STRING_FIELDS = {
    title: 200, location: 300, category: 100, level: 100, department: 150, clientName: 200, recruiterOwner: 150,
    experienceLevel: 100, country: 100, state: 100, city: 100, address: 500, requiredDocuments: 2000,
    applicationInstructions: 5000, internalNotes: 10000,
}
const HTML_FIELDS = { description: 50000, responsibilities: 20000, qualifications: 20000 }
const NUMBER_FIELDS = {
    salary: [0, 1e12], salaryMin: [0, 1e12], salaryMax: [0, 1e12],
    experienceMin: [0, 60], experienceMax: [0, 60], vacancies: [1, 10000],
}
const INT_FIELDS = new Set(['vacancies'])
const BOOL_FIELDS = ['salaryNegotiable', 'salaryUndisclosed', 'featured']
const DATE_FIELDS = ['applicationDeadline', 'publishAt', 'expiresAt']
const ENUM_FIELDS = { employmentType: EMPLOYMENT_TYPES, workplaceType: WORKPLACE_TYPES, salaryPeriod: SALARY_PERIODS, status: JOB_STATUSES }
const ARRAY_FIELDS = { skills: [60, 50], screeningQuestions: [500, 30] }
const REQUIRED = new Set(['title', 'description'])

export const EDITABLE_FIELDS = [
    ...Object.keys(STRING_FIELDS), ...Object.keys(HTML_FIELDS), ...Object.keys(NUMBER_FIELDS), ...BOOL_FIELDS,
    ...DATE_FIELDS, ...Object.keys(ENUM_FIELDS), ...Object.keys(ARRAY_FIELDS), 'referenceId', 'currency',
]

const isBlank = (v) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

const label = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).toLowerCase().replace(/^./, c => c.toUpperCase())

/**
 * @param {object} body          raw request body
 * @param {object} opts
 * @param {boolean} opts.partial PATCH semantics (only provided keys)
 * @param {object} [opts.existing] current document (plain object) for cross-field checks on PATCH
 * @returns {{ set: object, unset: string[], errors: object }}
 */
export const parseJobInput = (body, { partial = false, existing = null } = {}) => {
    const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
    const set = {}
    const unset = []
    const errors = {}
    const clear = (k) => { if (REQUIRED.has(k)) errors[k] = `${label(k)} is required`; else unset.push(k) }

    for (const [k, max] of Object.entries(STRING_FIELDS)) {
        if (!has(src, k)) continue
        const v = src[k]
        if (isBlank(v)) { clear(k); continue }
        if (typeof v !== 'string' && typeof v !== 'number') { errors[k] = `${label(k)} must be text`; continue }
        const s = String(v).trim()
        if (s.length > max) errors[k] = `${label(k)} must be at most ${max} characters`
        else set[k] = s
    }

    for (const [k, max] of Object.entries(HTML_FIELDS)) {
        if (!has(src, k)) continue
        const v = src[k]
        if (isBlank(v) || (typeof v === 'string' && isHtmlEmpty(v))) { clear(k); continue }
        if (typeof v !== 'string') { errors[k] = `${label(k)} must be text`; continue }
        const clean = sanitizeHtml(v)
        if (isHtmlEmpty(clean)) clear(k)
        else if (clean.length > max) errors[k] = `${label(k)} is too long`
        else set[k] = clean
    }

    for (const [k, [min, max]] of Object.entries(NUMBER_FIELDS)) {
        if (!has(src, k)) continue
        const v = src[k]
        if (isBlank(v)) { clear(k); continue }
        const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v.trim()) : NaN)
        if (!Number.isFinite(n)) errors[k] = `${label(k)} must be a number`
        else if (INT_FIELDS.has(k) && !Number.isInteger(n)) errors[k] = `${label(k)} must be a whole number`
        else if (n < min || n > max) errors[k] = `${label(k)} must be between ${min} and ${max}`
        else set[k] = n
    }

    for (const k of BOOL_FIELDS) {
        if (!has(src, k)) continue
        const v = src[k]
        if (v === true || v === 'true') set[k] = true
        else if (v === false || v === 'false' || isBlank(v)) set[k] = false
        else errors[k] = `${label(k)} must be true or false`
    }

    for (const k of DATE_FIELDS) {
        if (!has(src, k)) continue
        const v = src[k]
        if (isBlank(v)) { clear(k); continue }
        const d = typeof v === 'string' || typeof v === 'number' ? new Date(v) : null
        if (!d || Number.isNaN(d.getTime())) errors[k] = `${label(k)} must be a valid date`
        else set[k] = d
    }

    for (const [k, values] of Object.entries(ENUM_FIELDS)) {
        if (!has(src, k)) continue
        const v = src[k]
        if (isBlank(v)) { if (k === 'status') errors[k] = 'Status is required'; else clear(k); continue }
        if (!values.includes(v)) errors[k] = `${label(k)} must be one of: ${values.join(', ')}`
        else set[k] = v
    }

    for (const [k, [maxLen, maxItems]] of Object.entries(ARRAY_FIELDS)) {
        if (!has(src, k)) continue
        const v = src[k]
        if (isBlank(v)) { set[k] = []; continue }
        if (!Array.isArray(v) || v.some(x => typeof x !== 'string')) { errors[k] = `${label(k)} must be a list of text values`; continue }
        const seen = new Set()
        const items = v.map(x => x.trim()).filter(x => x && !seen.has(x.toLowerCase()) && seen.add(x.toLowerCase()))
        if (items.length > maxItems) errors[k] = `At most ${maxItems} ${label(k).toLowerCase()} allowed`
        else if (items.some(x => x.length > maxLen)) errors[k] = `Each item must be at most ${maxLen} characters`
        else set[k] = items
    }

    if (has(src, 'referenceId')) {
        const v = src.referenceId
        if (isBlank(v)) { if (partial) errors.referenceId = 'Reference ID cannot be removed' }
        else if (typeof v !== 'string' || !REFERENCE_ID_REGEX.test(v.trim().toUpperCase())) errors.referenceId = 'Reference ID must look like SH-JOB-YYMMDD-XXXX'
        else set.referenceId = v.trim().toUpperCase()
    }

    if (has(src, 'currency')) {
        const v = src.currency
        if (isBlank(v)) set.currency = 'INR'
        else if (typeof v !== 'string' || !/^[A-Za-z]{3}$/.test(v.trim())) errors.currency = 'Currency must be a 3-letter code (e.g. INR)'
        else set.currency = v.trim().toUpperCase()
    }

    // ----- required fields on create -----
    if (!partial) {
        for (const k of REQUIRED) if (!has(set, k) && !errors[k]) errors[k] = `${label(k)} is required`
    }

    // ----- cross-field checks on the merged result -----
    const merged = { ...(existing || {}), ...set }
    for (const k of unset) delete merged[k]
    const num = (k) => (merged[k] === undefined || merged[k] === null ? null : Number(merged[k]))

    if (!errors.experienceMin && !errors.experienceMax && num('experienceMin') !== null && num('experienceMax') !== null && num('experienceMin') > num('experienceMax')) {
        errors.experienceMax = 'Maximum experience must be greater than or equal to minimum experience'
    }
    if (!merged.salaryUndisclosed && !errors.salaryMin && !errors.salaryMax && num('salaryMin') !== null && num('salaryMax') !== null && num('salaryMin') > num('salaryMax')) {
        errors.salaryMax = 'Maximum salary must be greater than or equal to minimum salary'
    }
    if (!errors.publishAt && !errors.expiresAt && merged.publishAt && merged.expiresAt && new Date(merged.expiresAt) <= new Date(merged.publishAt)) {
        errors.expiresAt = 'Expiry date must be after the publish date'
    }

    // ----- derived legacy fields -----
    const structuralKeys = ['workplaceType', 'city', 'state', 'country']
    const touchesLocation = structuralKeys.some(k => has(set, k) || unset.includes(k))
    if (touchesLocation || !partial) {
        const derived = buildLocation(merged)
        if (derived) set.location = derived
        else {
            // Legacy jobs only have the free-text `location`; keep it unless it no longer fits
            const stale = !merged.location || (merged.workplaceType !== 'Remote' && /^remote\b/i.test(merged.location))
            if (stale && !errors.city) errors.city = 'City is required for on-site and hybrid jobs'
        }
    }

    // legacy `level` mirrors experienceLevel
    if (has(set, 'experienceLevel')) set.level = set.experienceLevel
    else if (!partial && !set.level) set.level = 'Not specified'
    if (has(set, 'level') && !has(set, 'experienceLevel') && !partial && !merged.experienceLevel) set.experienceLevel = set.level

    if (!partial && !set.category) set.category = 'General'

    // legacy `salary` (Number, required) mirrors the top of the range
    const salaryTouched = ['salaryMin', 'salaryMax', 'salaryUndisclosed'].some(k => has(set, k) || unset.includes(k))
    if (!has(set, 'salary') && (salaryTouched || !partial)) {
        set.salary = merged.salaryUndisclosed ? 0 : (num('salaryMax') ?? num('salaryMin') ?? num('salary') ?? 0)
    }

    // status <-> visible stay in sync
    if (has(set, 'status')) set.visible = set.status === 'published'

    return { set, unset: unset.filter(k => !has(set, k)), errors }
}

// Mongoose ValidationError -> { field: message }
export const mongooseErrors = (err) => {
    const out = {}
    for (const [k, e] of Object.entries(err?.errors || {})) out[k] = e.message
    return out
}
