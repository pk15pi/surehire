// Only allow same-site relative paths ("/dashboard", "/jobs?x=1"). Rejects absolute URLs,
// protocol-relative ("//evil.com"), backslash tricks and javascript: URLs (open-redirect guard).
export const safeRedirect = (target, fallback = '/') => {
    if (typeof target !== 'string' || !target) return fallback
    let t = target.trim()
    try { t = decodeURIComponent(t) } catch { return fallback }
    if (!t.startsWith('/') || t.startsWith('//') || t.includes('\\') || [...t].some(ch => ch.charCodeAt(0) < 32)) return fallback
    try {
        const u = new URL(t, window.location.origin)
        return u.origin === window.location.origin ? u.pathname + u.search + u.hash : fallback
    } catch { return fallback }
}
