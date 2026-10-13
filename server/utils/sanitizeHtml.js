import sanitizeHtmlLib from 'sanitize-html'

// Allowlist matching what the Quill "snow" toolbar can produce. Scripts, styles,
// event handlers, iframes and javascript: URLs are all stripped.
const OPTIONS = {
    allowedTags: ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'blockquote', 'pre', 'code',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'span', 'sub', 'sup', 'hr'],
    allowedAttributes: {
        a: ['href', 'target', 'rel'],
        '*': ['class'],
        li: ['data-list', 'class'],
        pre: ['spellcheck', 'class'],
    },
    allowedClasses: { '*': [/^ql-[a-z0-9-]+$/] },
    allowedSchemes: ['http', 'https', 'mailto', 'tel'],
    allowProtocolRelative: false,
    transformTags: {
        a: sanitizeHtmlLib.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }, true),
    },
}

export const sanitizeHtml = (html) => sanitizeHtmlLib(String(html ?? ''), OPTIONS).trim()

// True when the HTML has no visible text (e.g. Quill's empty "<p><br></p>")
export const isHtmlEmpty = (html) => sanitizeHtmlLib(String(html ?? ''), { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;|\s/g, '') === ''

export default sanitizeHtml
