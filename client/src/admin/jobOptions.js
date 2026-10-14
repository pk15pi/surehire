// Admin job form state helpers. Option lists come from master data
// (see useMasters.js); nothing here is hardcoded except job statuses.
export const JOB_STATUSES = ['draft', 'published', 'archived']

export const STATUS_STYLES = {
    draft: 'bg-gray-200 text-gray-700',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-amber-100 text-amber-800',
}

// Master reference fields on a job -> master type (URL name)
export const JOB_MASTER_FIELDS = {
    categoryId: 'categories', employmentTypeId: 'employment-types', workplaceTypeId: 'workplace-types',
    experienceLevelId: 'experience-levels', departmentId: 'departments', industryId: 'industries',
    currencyId: 'currencies', salaryPeriodId: 'salary-periods', clientId: 'clients',
    skillIds: 'skills', locationIds: 'locations',
}

// Legacy text shown when a job has no master link yet
export const LEGACY_TEXT = {
    categoryId: 'category', employmentTypeId: 'employmentType', workplaceTypeId: 'workplaceType',
    experienceLevelId: (j) => j.experienceLevel || j.level, departmentId: 'department', industryId: 'industry',
    currencyId: 'currency', salaryPeriodId: 'salaryPeriod', clientId: 'clientName',
    skillIds: (j) => (j.skills || []).join(', '), locationIds: 'location',
}

// Fields the form edits, with their empty values
export const EMPTY_JOB = {
    title: '', referenceId: '', departmentId: '', clientId: '', industryId: '', recruiterOwner: '', categoryId: '',
    description: '', responsibilities: '', qualifications: '', skillIds: [],
    experienceLevelId: '', experienceMin: '', experienceMax: '', vacancies: '1',
    employmentTypeId: '', workplaceTypeId: '', locationIds: [],
    salaryMin: '', salaryMax: '', currencyId: '', salaryPeriodId: '', salaryNegotiable: false, salaryUndisclosed: false,
    applicationDeadline: '', requiredDocuments: '', applicationInstructions: '', screeningQuestions: [],
    status: 'draft', featured: false, publishAt: '', expiresAt: '', internalNotes: '',
}

const toDateInput = (d) => {
    if (!d) return ''
    const date = new Date(d)
    return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

// Backend job document -> form state (strings for inputs, YYYY-MM-DD for dates)
export const jobToForm = (job) => {
    const form = { ...EMPTY_JOB }
    for (const key of Object.keys(EMPTY_JOB)) {
        const v = job?.[key]
        if (v === undefined || v === null) {
            form[key] = Array.isArray(EMPTY_JOB[key]) ? [] : (typeof EMPTY_JOB[key] === 'boolean' ? false : '')
            continue
        }
        if (['applicationDeadline', 'publishAt', 'expiresAt'].includes(key)) form[key] = toDateInput(v)
        else if (Array.isArray(v)) form[key] = v.map(x => (typeof x === 'object' && x?._id ? String(x._id) : x))
        else if (typeof v === 'number') form[key] = String(v)
        else if (typeof v === 'object' && v._id) form[key] = String(v._id)
        else form[key] = v
    }
    if (!job?.status) form.status = job?.visible === false ? 'draft' : 'published'
    return form
}

// Legacy labels for reference fields that are not linked yet (shown as hints)
export const legacyLabels = (job) => {
    const out = {}
    for (const [field, src] of Object.entries(LEGACY_TEXT)) {
        const linked = Array.isArray(job?.[field]) ? job[field].length > 0 : !!job?.[field]
        if (linked) continue
        const text = typeof src === 'function' ? src(job || {}) : job?.[src]
        if (text && !/^not specified$/i.test(String(text))) out[field] = String(text)
    }
    return out
}

const same = (a, b) => (Array.isArray(a) || Array.isArray(b))
    ? JSON.stringify(a || []) === JSON.stringify(b || [])
    : String(a ?? '') === String(b ?? '')

// Only the fields that differ from the loaded values (PATCH payload)
export const diffForm = (initial, current) => {
    const out = {}
    for (const key of Object.keys(EMPTY_JOB)) {
        if (!same(initial[key], current[key])) out[key] = current[key]
    }
    return out
}

// Form state -> create payload (drop empty optional values)
export const formToPayload = (form) => {
    const out = {}
    for (const [k, v] of Object.entries(form)) {
        if (v === '' || (Array.isArray(v) && v.length === 0)) continue
        out[k] = v
    }
    return out
}

// Legacy text -> active master match (case-insensitive name, slug/key or city).
// Returns { field: id | [ids] } for fields that are still empty in the form.
const norm = (s) => String(s ?? '').trim().toLowerCase()
const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const matchLegacyToMasters = (form, legacy, itemsFor, suggested = {}) => {
    const out = {}
    for (const [field, text] of Object.entries(legacy || {})) {
        const multi = Array.isArray(EMPTY_JOB[field])
        if (multi ? (form[field] || []).length : form[field]) continue
        const items = (itemsFor(field) || []).filter(m => m.active !== false)
        const values = field === 'skillIds' ? String(text).split(',') : [String(text).replace(/\s*\((hybrid|on-?site)\)\s*$/i, '')]
        const ids = []
        for (const v of values.map(norm).filter(Boolean)) {
            const hits = items.filter(m => [m.name, m.code, m.key, m.slug, m.city].some(x => x && (norm(x) === v || slug(x) === slug(v))))
            if (hits.length === 1) ids.push(String(hits[0]._id))
        }
        // Fall back to the server's suggestion if it is among the active options
        const sug = [].concat(suggested?.[field] || []).map(String).filter(id => items.some(m => String(m._id) === id))
        const pickIds = ids.length ? ids : sug
        if (pickIds.length) out[field] = multi ? [...new Set(pickIds)] : pickIds[0]
    }
    return out
}
