import mongoose from "mongoose";

// ---------------------------------------------------------------------------
// Job model. Original fields (title, description, location, category, level,
// salary, date, visible, companyId) are kept so legacy documents and the
// recruiter flow keep working. Everything added later is optional / defaulted,
// so documents created before this change load and validate unchanged.
// ---------------------------------------------------------------------------

export const JOB_STATUSES = ['draft', 'published', 'archived']
export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Contract-to-hire', 'Project-based']
export const WORKPLACE_TYPES = ['On-site', 'Remote', 'Hybrid']
export const SALARY_PERIODS = ['Hourly', 'Daily', 'Monthly', 'Annual']
export const EXPERIENCE_LEVELS = ['Beginner level', 'Intermediate level', 'Senior level', 'Lead', 'Executive']
export const REFERENCE_ID_REGEX = /^SH-JOB-\d{6}-[A-Z0-9]{4,8}$/

// SH-JOB-YYMMDD-XXXX (X = unambiguous base32-ish chars)
const REF_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
export const generateReferenceId = (date = new Date()) => {
    const yy = String(date.getUTCFullYear()).slice(2)
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(date.getUTCDate()).padStart(2, '0')
    let suffix = ''
    for (let i = 0; i < 4; i++) suffix += REF_CHARS[Math.floor(Math.random() * REF_CHARS.length)]
    return `SH-JOB-${yy}${mm}${dd}-${suffix}`
}

// Derive the legacy `location` string from the structured fields
export const buildLocation = ({ workplaceType, city, state, country } = {}) => {
    const place = [city, state, country].map(s => (s || '').trim()).filter(Boolean).join(', ')
    if (workplaceType === 'Remote') return place ? `Remote (${place})` : 'Remote'
    if (workplaceType === 'Hybrid' && place) return `${place} (Hybrid)`
    return place
}

const str = (max) => ({ type: String, trim: true, maxlength: max })

const jobSchema = new mongoose.Schema({
    // --- legacy / core ---
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 50000 },
    location: { type: String, required: true, trim: true, maxlength: 300 },
    category: { type: String, required: true, trim: true, maxlength: 100 },
    level: { type: String, required: true, trim: true, maxlength: 100 },
    salary: { type: Number, required: true, min: 0 },
    date: { type: Number, required: true },
    visible: { type: Boolean, default: true },
    // Optional: admin-created jobs are not tied to a recruiter company
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },

    // --- identification ---
    referenceId: { type: String, trim: true, unique: true, sparse: true, match: [REFERENCE_ID_REGEX, 'Invalid reference ID format'] },
    department: str(150),
    clientName: str(200),
    recruiterOwner: str(150),

    // --- role details ---
    responsibilities: str(20000),
    qualifications: str(20000),
    skills: { type: [{ type: String, trim: true, maxlength: 60 }], default: undefined },
    experienceLevel: { type: String, trim: true, maxlength: 100 },
    experienceMin: { type: Number, min: 0, max: 60 },
    experienceMax: { type: Number, min: 0, max: 60 },
    vacancies: { type: Number, min: 1, max: 10000 },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES },
    workplaceType: { type: String, enum: WORKPLACE_TYPES },

    // --- location ---
    country: str(100),
    state: str(100),
    city: str(100),
    address: str(500),

    // --- compensation ---
    salaryMin: { type: Number, min: 0 },
    salaryMax: { type: Number, min: 0 },
    currency: { type: String, trim: true, uppercase: true, match: [/^[A-Z]{3}$/, 'Currency must be a 3-letter code'], default: 'INR' },
    salaryPeriod: { type: String, enum: SALARY_PERIODS },
    salaryNegotiable: { type: Boolean, default: false },
    salaryUndisclosed: { type: Boolean, default: false },

    // --- recruitment ---
    applicationDeadline: { type: Date },
    requiredDocuments: str(2000),
    applicationInstructions: str(5000),
    screeningQuestions: { type: [{ type: String, trim: true, maxlength: 500 }], default: undefined },

    // --- publication ---
    // No schema default: a missing status on a legacy document means "derive from visible".
    status: { type: String, enum: JOB_STATUSES },
    featured: { type: Boolean, default: false },
    publishAt: { type: Date },
    expiresAt: { type: Date },

    // --- internal (never returned publicly) ---
    internalNotes: { type: String, maxlength: 10000, select: false },
    createdBy: { type: String, select: false },
    updatedBy: { type: String, select: false },
}, { timestamps: true })

// Cross-field rules (also enforced by the controllers with friendlier messages)
jobSchema.pre('validate', function () {
    if (this.experienceMin != null && this.experienceMax != null && this.experienceMin > this.experienceMax) {
        this.invalidate('experienceMax', 'Maximum experience must be greater than or equal to minimum experience')
    }
    if (this.salaryMin != null && this.salaryMax != null && this.salaryMin > this.salaryMax) {
        this.invalidate('salaryMax', 'Maximum salary must be greater than or equal to minimum salary')
    }
    if (this.publishAt && this.expiresAt && this.expiresAt <= this.publishAt) {
        this.invalidate('expiresAt', 'Expiry must be after the publish date')
    }
})

jobSchema.index({ status: 1, createdAt: -1 })
jobSchema.index({ visible: 1 })

// Effective status for documents that predate the `status` field
export const effectiveStatus = (job) => job.status || (job.visible === false ? 'draft' : 'published')

// Mongo filter for "publicly visible right now". Legacy docs (no status) are public when visible.
export const publicJobFilter = (now = new Date()) => ({
    $and: [
        { $or: [{ status: 'published' }, { status: { $exists: false }, visible: { $ne: false } }, { status: null, visible: { $ne: false } }] },
        { visible: { $ne: false } },
        { $or: [{ publishAt: { $exists: false } }, { publishAt: null }, { publishAt: { $lte: now } }] },
        { $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: now } }] },
    ],
})

// Fields never sent to anonymous visitors
export const PUBLIC_EXCLUDE = '-internalNotes -createdBy -updatedBy -recruiterOwner -__v'

const Job = mongoose.model('Job', jobSchema)

export default Job
