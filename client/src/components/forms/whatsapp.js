// WhatsApp "click to chat" helpers for the public enquiry forms.
// Pure functions (no React / no import.meta) so they are easy to test in Node.

export const WA_MAX_URL_LENGTH = 2000
export const WA_ATTACH_NOTE = 'please attach in WhatsApp chat'
const ELLIPSIS = '…'

const isFileLike = (v) => v && typeof v === 'object' && typeof v.name === 'string' && 'size' in v

// FormSubmit uses lowercase "email" (so it can set reply-to); show it nicely in the chat message.
const displayLabel = (k) => (k === 'email' ? 'Email' : k)

/** Turn the same label -> value map used for email into ordered [label, text] lines. */
export const toEntries = (fields) => Object.entries(fields)
    .filter(([k, v]) => k !== 'Form' && k !== 'Reference ID' && k !== 'attachment' && !isFileLike(v))
    .filter(([, v]) => v !== '' && v !== null && v !== undefined && v !== false)
    .map(([k, v]) => [displayLabel(k), String(v).trim()])
    .filter(([, v]) => v)

const render = (title, referenceId, entries) => {
    const lines = [`*SureHire - ${title}*`, `Reference ID: ${referenceId}`, '']
    entries.forEach(([k, v]) => {
        lines.push(v.includes('\n') ? `*${k}:*\n${v}` : `*${k}:* ${v}`)
    })
    return lines.join('\n')
}

export const buildWhatsAppUrl = (number, text) => `https://wa.me/${String(number).replace(/\D/g, '')}?text=${encodeURIComponent(text)}`

const cut = (s, n) => (s.length <= n ? s : s.slice(0, Math.max(0, n)).trimEnd() + ELLIPSIS)

/**
 * Build the readable WhatsApp message + wa.me URL, truncating the longest values with "…"
 * until the URL fits in maxLength characters.
 */
export const buildWhatsAppMessage = ({ title, referenceId, fields, number, maxLength = WA_MAX_URL_LENGTH }) => {
    let entries = toEntries(fields)
    let text = render(title, referenceId, entries)
    let url = buildWhatsAppUrl(number, text)
    let guard = 0
    while (url.length > maxLength && guard++ < 50) {
        // shorten the currently longest value (descriptions, messages, ...)
        let idx = 0
        entries.forEach(([, v], i) => { if (v.length > entries[idx][1].length) idx = i })
        const original = entries[idx][1].replace(new RegExp(ELLIPSIS + '$'), '')
        if (original.length <= 20) break
        // binary search the longest prefix that fits
        let lo = 0, hi = original.length - 1, best = 0
        while (lo <= hi) {
            const mid = (lo + hi) >> 1
            const trial = entries.map((e, i) => (i === idx ? [e[0], cut(original, mid)] : e))
            if (buildWhatsAppUrl(number, render(title, referenceId, trial)).length <= maxLength) { best = mid; lo = mid + 1 } else hi = mid - 1
        }
        const keep = Math.max(best, 20)
        entries = entries.map((e, i) => (i === idx ? [e[0], cut(original, keep)] : e))
        text = render(title, referenceId, entries)
        url = buildWhatsAppUrl(number, text)
        if (best >= 20) break
    }
    return { text, url }
}

/** Desktop = not a phone/tablet: no mobile UA and a fine primary pointer. */
export const isMobileDevice = () => {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent || ''
    if (navigator.userAgentData?.mobile) return true
    if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|Opera Mini|BlackBerry/i.test(ua)) return true
    // iPadOS reports as Mac; detect via touch + coarse pointer
    if (typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches && navigator.maxTouchPoints > 1) return true
    return false
}
