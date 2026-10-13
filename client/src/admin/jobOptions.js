// Option lists for the admin job form. Keep in sync with server/models/Job.js enums.
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Contract-to-hire', 'Project-based']
export const WORKPLACE_TYPES = ['On-site', 'Remote', 'Hybrid']
export const SALARY_PERIODS = ['Hourly', 'Daily', 'Monthly', 'Annual']
export const JOB_STATUSES = ['draft', 'published', 'archived']
export const EXPERIENCE_LEVELS = ['Beginner level', 'Intermediate level', 'Senior level', 'Lead', 'Executive']
export const JOB_CATEGORIES = ['Engineering', 'Programming', 'Data Science', 'Designing', 'Networking', 'Management', 'Marketing', 'Cybersecurity', 'Operations', 'Finance', 'Sales', 'Healthcare', 'General']

export const STATUS_STYLES = {
    draft: 'bg-gray-200 text-gray-700',
    published: 'bg-green-100 text-green-800',
    archived: 'bg-amber-100 text-amber-800',
}

// Fields the form edits, with their empty values
export const EMPTY_JOB = {
    title: '', referenceId: '', department: '', clientName: '', recruiterOwner: '', category: 'Engineering',
    description: '', responsibilities: '', qualifications: '', skills: [],
    experienceLevel: '', experienceMin: '', experienceMax: '', vacancies: '1',
    employmentType: 'Full-time', workplaceType: 'On-site',
    country: 'India', state: '', city: '', address: '',
    salaryMin: '', salaryMax: '', currency: 'INR', salaryPeriod: 'Annual', salaryNegotiable: false, salaryUndisclosed: false,
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
            // legacy docs: fall back to the original single-value fields
            if (key === 'experienceLevel' && job?.level) form.experienceLevel = job.level
            else form[key] = Array.isArray(EMPTY_JOB[key]) ? [] : (typeof EMPTY_JOB[key] === 'boolean' ? false : '')
            continue
        }
        if (['applicationDeadline', 'publishAt', 'expiresAt'].includes(key)) form[key] = toDateInput(v)
        else if (Array.isArray(v)) form[key] = [...v]
        else if (typeof v === 'number') form[key] = String(v)
        else form[key] = v
    }
    if (!job?.status) form.status = job?.visible === false ? 'draft' : 'published'
    return form
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
