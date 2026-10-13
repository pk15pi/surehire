// Option lists shared by enquiry forms. Keep values in sync with server/utils/enquiryUtils.js

export const COUNTRY_CODES = [
    { code: '+91', label: 'India (+91)' },
    { code: '+1', label: 'USA / Canada (+1)' },
    { code: '+44', label: 'United Kingdom (+44)' },
    { code: '+971', label: 'UAE (+971)' },
    { code: '+966', label: 'Saudi Arabia (+966)' },
    { code: '+974', label: 'Qatar (+974)' },
    { code: '+965', label: 'Kuwait (+965)' },
    { code: '+968', label: 'Oman (+968)' },
    { code: '+973', label: 'Bahrain (+973)' },
    { code: '+61', label: 'Australia (+61)' },
    { code: '+64', label: 'New Zealand (+64)' },
    { code: '+65', label: 'Singapore (+65)' },
    { code: '+60', label: 'Malaysia (+60)' },
    { code: '+62', label: 'Indonesia (+62)' },
    { code: '+49', label: 'Germany (+49)' },
    { code: '+33', label: 'France (+33)' },
    { code: '+31', label: 'Netherlands (+31)' },
    { code: '+47', label: 'Norway (+47)' },
    { code: '+46', label: 'Sweden (+46)' },
    { code: '+39', label: 'Italy (+39)' },
    { code: '+34', label: 'Spain (+34)' },
    { code: '+27', label: 'South Africa (+27)' },
    { code: '+234', label: 'Nigeria (+234)' },
    { code: '+254', label: 'Kenya (+254)' },
    { code: '+20', label: 'Egypt (+20)' },
    { code: '+880', label: 'Bangladesh (+880)' },
    { code: '+94', label: 'Sri Lanka (+94)' },
    { code: '+977', label: 'Nepal (+977)' },
    { code: '+92', label: 'Pakistan (+92)' },
    { code: '+81', label: 'Japan (+81)' },
    { code: '+82', label: 'South Korea (+82)' },
    { code: '+86', label: 'China (+86)' },
]

export const I_AM_OPTIONS = [
    { value: 'employer', label: 'Employer / Hiring Manager' },
    { value: 'candidate', label: 'Engineer / Job Seeker' },
    { value: 'partner', label: 'Recruitment / Business Partner' },
    { value: 'other', label: 'Other' },
]

export const PREFERRED_TIME_OPTIONS = [
    { value: 'anytime', label: 'Anytime (business hours)' },
    { value: 'morning', label: 'Morning (9am - 12pm)' },
    { value: 'afternoon', label: 'Afternoon (12pm - 4pm)' },
    { value: 'evening', label: 'Evening (4pm - 7pm)' },
    { value: 'specific', label: 'Pick a specific date & time' },
]

export const INDUSTRIES = [
    { value: 'oil-gas', label: 'Oil & Gas' },
    { value: 'power-energy', label: 'Power & Energy' },
    { value: 'renewables', label: 'Renewables' },
    { value: 'construction-infrastructure', label: 'Construction & Infrastructure' },
    { value: 'manufacturing', label: 'Manufacturing' },
    { value: 'automotive', label: 'Automotive' },
    { value: 'aerospace-defence', label: 'Aerospace & Defence' },
    { value: 'chemicals-process', label: 'Chemicals & Process' },
    { value: 'mining-metals', label: 'Mining & Metals' },
    { value: 'marine-offshore', label: 'Marine & Offshore' },
    { value: 'water-utilities', label: 'Water & Utilities' },
    { value: 'other', label: 'Other' },
]

export const EMPLOYMENT_TYPES = [
    { value: 'full-time', label: 'Full-time / Permanent' },
    { value: 'contract', label: 'Contract' },
    { value: 'contract-to-hire', label: 'Contract-to-hire' },
    { value: 'temporary', label: 'Temporary / Project' },
]

export const URGENCY_OPTIONS = [
    { value: 'immediate', label: 'Immediate' },
    { value: 'within-1-month', label: 'Within 1 month' },
    { value: '1-3-months', label: '1 - 3 months' },
    { value: 'exploring', label: 'Just exploring' },
]

export const MAX_DOC_SIZE = 5 * 1024 * 1024
export const ALLOWED_DOC_EXT = ['.pdf', '.docx']
export const ALLOWED_DOC_MIME = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]

// ---------- client-side validators (server re-validates everything) ----------
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export const isValidPhone = (phone) => /^\d{6,15}$/.test(String(phone || '').replace(/[\s\-().]/g, ''))

export const validateDocFile = (file, { required = false } = {}) => {
    if (!file) return required ? 'Please upload a PDF or DOCX file' : ''
    const name = file.name.toLowerCase()
    const ext = name.slice(name.lastIndexOf('.'))
    if (!ALLOWED_DOC_EXT.includes(ext) || (file.type && !ALLOWED_DOC_MIME.includes(file.type))) {
        return 'Only PDF or DOCX files are allowed'
    }
    if (file.size > MAX_DOC_SIZE) return 'File is too large. Maximum size is 5 MB'
    return ''
}

export const getUserTimezone = () => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch { return 'UTC' }
}

export const getTimezones = () => {
    try {
        if (typeof Intl.supportedValuesOf === 'function') return Intl.supportedValuesOf('timeZone')
    } catch { /* ignore */ }
    return ['UTC', 'Asia/Kolkata', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'Asia/Singapore']
}

export const todayISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Extract a user-friendly error from an axios error / response
export const getApiError = (error) => {
    const data = error?.response?.data
    if (data?.message) return { message: data.message, fieldErrors: data.errors || {} }
    if (error?.code === 'ERR_NETWORK') return { message: 'Network error. Please check your connection and try again.', fieldErrors: {} }
    return { message: error?.message || 'Something went wrong. Please try again.', fieldErrors: {} }
}
