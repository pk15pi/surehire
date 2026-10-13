import crypto from 'crypto'

// ---------- Shared option lists (keep in sync with client/src/components/forms/formOptions.js) ----------
export const I_AM_OPTIONS = ['employer', 'candidate', 'partner', 'other']
export const PREFERRED_TIME_OPTIONS = ['anytime', 'morning', 'afternoon', 'evening', 'specific']
export const EMPLOYMENT_TYPES = ['full-time', 'contract', 'contract-to-hire', 'temporary']
export const URGENCY_OPTIONS = ['immediate', 'within-1-month', '1-3-months', 'exploring']
export const INDUSTRIES = [
    'oil-gas', 'power-energy', 'renewables', 'construction-infrastructure', 'manufacturing',
    'automotive', 'aerospace-defence', 'chemicals-process', 'mining-metals', 'marine-offshore',
    'water-utilities', 'other'
]

// ---------- Reference ID ----------
// e.g. CALL-261011-7K3QZP
export const generateReferenceId = (prefix) => {
    const d = new Date()
    const datePart = String(d.getUTCFullYear()).slice(2) +
        String(d.getUTCMonth() + 1).padStart(2, '0') +
        String(d.getUTCDate()).padStart(2, '0')
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    const bytes = crypto.randomBytes(6)
    let rand = ''
    for (const b of bytes) rand += alphabet[b % alphabet.length]
    return `${prefix}-${datePart}-${rand}`
}

// ---------- Validation helpers ----------
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const COUNTRY_CODE_RE = /^\+\d{1,4}$/
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

// Simple validator that collects field errors
export class Validator {
    constructor(body) {
        this.body = body || {}
        this.errors = {}
        this.data = {}
    }

    raw(field) {
        const v = this.body[field]
        if (v === undefined || v === null) return ''
        if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null
        return String(v).trim()
    }

    fail(field, message) {
        if (!this.errors[field]) this.errors[field] = message
    }

    string(field, { required = false, min = 0, max = 200, label = field } = {}) {
        const v = this.raw(field)
        if (v === null) return this.fail(field, `${label} is invalid`)
        if (!v) {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        if (v.length < min) return this.fail(field, `${label} must be at least ${min} characters`)
        if (v.length > max) return this.fail(field, `${label} must be at most ${max} characters`)
        this.data[field] = v
    }

    email(field, { required = true, label = 'Email' } = {}) {
        const v = this.raw(field)
        if (v === null) return this.fail(field, `${label} is invalid`)
        if (!v) {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        if (v.length > 254 || !EMAIL_RE.test(v)) return this.fail(field, `Please enter a valid email address`)
        this.data[field] = v.toLowerCase()
    }

    phone(codeField, phoneField, { required = true } = {}) {
        const code = this.raw(codeField)
        const phone = this.raw(phoneField)
        if (code === null || phone === null) return this.fail(phoneField, 'Phone number is invalid')
        if (!phone) {
            if (required) this.fail(phoneField, 'Phone number is required')
            return
        }
        if (!code || !COUNTRY_CODE_RE.test(code)) return this.fail(codeField, 'Please select a valid country code')
        const digits = phone.replace(/[\s\-().]/g, '')
        if (!/^\d{6,15}$/.test(digits)) return this.fail(phoneField, 'Phone number must be 6-15 digits')
        this.data[codeField] = code
        this.data[phoneField] = digits
    }

    oneOf(field, options, { required = true, label = field } = {}) {
        const v = this.raw(field)
        if (v === null) return this.fail(field, `${label} is invalid`)
        if (!v) {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        if (!options.includes(v)) return this.fail(field, `Please select a valid ${label.toLowerCase()}`)
        this.data[field] = v
    }

    integer(field, { required = false, min = 0, max = 1000, label = field } = {}) {
        const v = this.raw(field)
        if (v === null) return this.fail(field, `${label} is invalid`)
        if (v === '') {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        const n = Number(v)
        if (!Number.isFinite(n) || n < min || n > max) return this.fail(field, `${label} must be between ${min} and ${max}`)
        this.data[field] = n
    }

    url(field, { required = false, label = field } = {}) {
        const v = this.raw(field)
        if (v === null) return this.fail(field, `${label} is invalid`)
        if (!v) {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        try {
            const u = new URL(v)
            if (!['http:', 'https:'].includes(u.protocol) || v.length > 300) throw new Error()
            this.data[field] = v
        } catch {
            this.fail(field, `${label} must be a valid http(s) URL`)
        }
    }

    date(field, { required = true, label = 'Date', notPast = true } = {}) {
        const v = this.raw(field)
        if (v === null || (v && !DATE_RE.test(v))) return this.fail(field, `${label} is invalid`)
        if (!v) {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        const d = new Date(`${v}T00:00:00Z`)
        if (Number.isNaN(d.getTime())) return this.fail(field, `${label} is invalid`)
        if (notPast) {
            // allow one day of leeway for timezone differences
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
            yesterday.setUTCHours(0, 0, 0, 0)
            if (d < yesterday) return this.fail(field, `${label} cannot be in the past`)
            const maxDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
            if (d > maxDate) return this.fail(field, `${label} must be within the next year`)
        }
        this.data[field] = v
    }

    time(field, { required = true, label = 'Time' } = {}) {
        const v = this.raw(field)
        if (v === null || (v && !TIME_RE.test(v))) return this.fail(field, `${label} must be in HH:MM format`)
        if (!v) {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        this.data[field] = v
    }

    timezone(field, { required = true, label = 'Timezone' } = {}) {
        const v = this.raw(field)
        if (v === null) return this.fail(field, `${label} is invalid`)
        if (!v) {
            if (required) this.fail(field, `${label} is required`)
            return
        }
        try {
            if (v.length > 64) throw new Error()
            new Intl.DateTimeFormat('en-US', { timeZone: v })
            this.data[field] = v
        } catch {
            this.fail(field, `${label} is invalid`)
        }
    }

    mustBeTrue(field, message) {
        const v = this.raw(field)
        if (!['true', 'on', '1', 'yes'].includes(String(v).toLowerCase())) return this.fail(field, message)
        this.data[field] = true
    }

    get isValid() {
        return Object.keys(this.errors).length === 0
    }
}

// Standard validation failure response
export const sendValidationError = (res, errors) => {
    const first = Object.values(errors)[0]
    return res.status(400).json({ success: false, message: first || 'Invalid input', errors })
}

// Honeypot: real users never fill the hidden "website" field
export const isBot = (body) => {
    const hp = body?.website
    return typeof hp === 'string' && hp.trim().length > 0
}

// Make a filename safe for storage identifiers
export const safeBaseName = (name = 'file') => {
    const base = String(name).replace(/\.[^.]+$/, '')
    const cleaned = base.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
    return (cleaned || 'file').slice(0, 60)
}
