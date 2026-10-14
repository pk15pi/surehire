// Display helpers shared by public job pages and the admin panel.
export const companyName = (job) => job?.companyId?.name || job?.clientName || 'SureHire'

const fmt = (n, currency) => {
    if (n === undefined || n === null || n === '') return ''
    const num = Number(n)
    if (!Number.isFinite(num)) return ''
    try {
        return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: currency || 'INR', maximumFractionDigits: 0 }).format(num)
    } catch {
        return `${currency || ''} ${num.toLocaleString()}`.trim()
    }
}

const PERIOD = { Hourly: '/hr', Daily: '/day', Monthly: '/month', Annual: '/year' }

// "₹12,00,000 – ₹18,00,000 /year (Negotiable)" | "Not disclosed" | legacy "CTC: ₹12,00,000"
export const salaryText = (job) => {
    if (!job) return ''
    if (job.salaryUndisclosed) return 'Not disclosed'
    const min = job.salaryMin, max = job.salaryMax
    let text = ''
    if (min != null || max != null) {
        const a = fmt(min, job.currency), b = fmt(max, job.currency)
        text = a && b ? (a === b ? a : `${a} – ${b}`) : (a ? `From ${a}` : `Up to ${b}`)
        if (job.salaryPeriod) text += ` ${PERIOD[job.salaryPeriod] || ''}`.trimEnd()
    } else if (job.salary) {
        text = `CTC: ${fmt(job.salary, "INR")}` // e.g. CTC: ₹12,00,000
    }
    if (job.salaryNegotiable) text = text ? `${text} (Negotiable)` : 'Negotiable'
    return text
}

export const experienceText = (job) => {
    const { experienceMin: a, experienceMax: b } = job || {}
    if (a != null && b != null) return a === b ? `${a} yrs` : `${a}–${b} yrs`
    if (a != null) return `${a}+ yrs`
    if (b != null) return `Up to ${b} yrs`
    return ''
}

export const formatDate = (d, { utc = false } = {}) => {
    if (!d) return ''
    const date = new Date(d)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', ...(utc ? { timeZone: 'UTC' } : {}) })
}

// Posted timestamp: legacy numeric `date` or createdAt
export const postedAt = (job) => job?.date || job?.createdAt
