// FormSubmit.co integration for the public enquiry forms (no backend involved).
// Docs: https://formsubmit.co/documentation
//   - AJAX endpoint: POST https://formsubmit.co/ajax/<email>  (Accept: application/json)
//   - Plain fields can be sent as JSON; files must be sent as multipart/form-data (FormData).
//   - Special fields: _subject, _template, _captcha, _honey, _replyto
//   - Combined size of all uploaded files must not exceed 10 MB.

export const DEFAULT_FORMSUBMIT_EMAIL = 'career@surehire.in'
export const FORMSUBMIT_MAX_TOTAL_FILE_SIZE = 10 * 1024 * 1024

const EMAIL_CHECK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

// Destination inbox: VITE_FORMSUBMIT_EMAIL (or a FormSubmit "invisible" random string) overrides the default.
export const getFormSubmitTarget = () => {
    const fromEnv = (import.meta.env.VITE_FORMSUBMIT_EMAIL || '').trim()
    const target = fromEnv || DEFAULT_FORMSUBMIT_EMAIL
    // Accept a real email, or FormSubmit's alphanumeric "invisible email" token
    if (!EMAIL_CHECK.test(target) && !/^[a-zA-Z0-9]{16,}$/.test(target)) return null
    return target
}

export const getFormSubmitUrl = () => {
    const target = getFormSubmitTarget()
    return target ? `https://formsubmit.co/ajax/${encodeURIComponent(target)}` : null
}

// Client-generated reference ID, e.g. CALL-20261011-K7Q2XD (FormSubmit does not return one)
export const generateReferenceId = (prefix = 'ENQ') => {
    const d = new Date()
    const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    let rand = ''
    const bytes = (typeof crypto !== 'undefined' && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(6)) : null
    for (let i = 0; i < 6; i++) rand += alphabet[(bytes ? bytes[i] : Math.floor(Math.random() * 256)) % alphabet.length]
    return `${prefix}-${date}-${rand}`
}

const isFile = (v) => typeof Blob !== 'undefined' && v instanceof Blob

export class FormSubmitError extends Error {
    constructor(message, { isConfig = false } = {}) {
        super(message)
        this.name = 'FormSubmitError'
        this.isConfig = isConfig
    }
}

/**
 * Send a submission to FormSubmit.
 * @param {object} fields  label -> value. Values may be strings/numbers or File objects (attachments).
 * @param {object} meta    { subject, replyTo, honey, template }
 * Uses JSON when there are no files, multipart FormData when there are.
 */
export const sendToFormSubmit = async (fields, { subject, replyTo, honey = '', template = 'table' } = {}) => {
    const url = getFormSubmitUrl()
    if (!url) {
        throw new FormSubmitError('Form email is not configured correctly. Set VITE_FORMSUBMIT_EMAIL in client/.env to a valid address.', { isConfig: true })
    }

    const special = { _subject: subject, _template: template, _captcha: 'false', _honey: honey }
    if (replyTo) special._replyto = replyTo

    const clean = Object.entries(fields).filter(([, v]) => v !== '' && v !== null && v !== undefined)
    const files = clean.filter(([, v]) => isFile(v))
    const totalFileSize = files.reduce((sum, [, f]) => sum + (f.size || 0), 0)
    if (totalFileSize > FORMSUBMIT_MAX_TOTAL_FILE_SIZE) {
        throw new FormSubmitError('Attached files exceed the 10 MB total limit.')
    }

    let body
    const headers = { Accept: 'application/json' }
    if (files.length) {
        body = new FormData()
        clean.forEach(([k, v]) => {
            if (isFile(v)) body.append(k, v, v.name)
            else body.append(k, String(v))
        })
        Object.entries(special).forEach(([k, v]) => body.append(k, v ?? ''))
        // Do not set Content-Type: the browser adds the multipart boundary.
    } else {
        body = JSON.stringify({ ...Object.fromEntries(clean.map(([k, v]) => [k, String(v)])), ...special })
        headers['Content-Type'] = 'application/json'
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), files.length ? 90000 : 30000)
    let res
    try {
        res = await fetch(url, { method: 'POST', headers, body, signal: controller.signal })
    } catch (err) {
        if (err?.name === 'AbortError') throw new FormSubmitError('The request timed out. Please try again.')
        throw new FormSubmitError('Network error. Please check your connection and try again.')
    } finally {
        clearTimeout(timer)
    }

    let data = null
    try { data = await res.json() } catch { /* non-JSON response */ }

    const ok = res.ok && data && (data.success === true || data.success === 'true')
    if (!ok) {
        const msg = data?.message || `Submission failed (HTTP ${res.status}). Please try again.`
        throw new FormSubmitError(msg)
    }
    return data
}

// Helper to turn an option value into its label for readable emails
export const labelFor = (options, value) => options.find(o => o.value === value)?.label || value