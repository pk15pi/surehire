// Client-side defence in depth for rich-text job content. The server already
// sanitizes descriptions on save; this strips anything outside a small allowlist
// before it reaches dangerouslySetInnerHTML (covers legacy, unsanitized records).
const ALLOWED_TAGS = new Set(['P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE', 'BLOCKQUOTE', 'PRE', 'CODE',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'A', 'SPAN', 'SUB', 'SUP', 'HR'])
const ALLOWED_ATTRS = { A: ['href', 'target', 'rel'], LI: ['data-list'], '*': ['class'] }
const DROP_WITH_CONTENT = new Set(['SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED', 'TEMPLATE', 'NOSCRIPT', 'SVG', 'MATH'])
const SAFE_URL = /^(https?:|mailto:|tel:)/i

const clean = (node) => {
    for (const child of [...node.childNodes]) {
        if (child.nodeType === 8) { child.remove(); continue } // comments
        if (child.nodeType !== 1) continue
        const tag = child.tagName
        if (DROP_WITH_CONTENT.has(tag)) { child.remove(); continue }
        clean(child)
        if (!ALLOWED_TAGS.has(tag)) { child.replaceWith(...child.childNodes); continue }
        const allowed = [...(ALLOWED_ATTRS[tag] || []), ...ALLOWED_ATTRS['*']]
        for (const attr of [...child.attributes]) {
            if (!allowed.includes(attr.name)) child.removeAttribute(attr.name)
        }
        if (child.className && !/^(ql-[a-z0-9-]+\s*)+$/.test(child.className)) child.removeAttribute('class')
        if (tag === 'A') {
            const href = (child.getAttribute('href') || '').trim()
            if (!SAFE_URL.test(href)) child.removeAttribute('href')
            child.setAttribute('rel', 'noopener noreferrer nofollow')
        }
    }
}

export const sanitizeHtml = (html) => {
    if (!html) return ''
    if (typeof window === 'undefined' || !window.DOMParser) return String(html).replace(/<[^>]*>/g, '')
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html')
    const root = doc.body.firstChild
    clean(root)
    return root.innerHTML
}

// Plain-text excerpt (used by job cards instead of slicing raw HTML)
export const htmlToText = (html, max = 150) => {
    if (!html) return ''
    let text
    if (typeof window !== 'undefined' && window.DOMParser) {
        text = new DOMParser().parseFromString(String(html), 'text/html').body.textContent || ''
    } else {
        text = String(html).replace(/<[^>]*>/g, ' ')
    }
    text = text.replace(/\s+/g, ' ').trim()
    return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text
}

export default sanitizeHtml
