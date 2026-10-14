import AuditLog from '../models/AuditLog.js'

const SENSITIVE = /pass|secret|token|hash|notes|key$|^key|cookie|authorization/i

// Strip sensitive keys and cap size so metadata can never leak secrets
const safeMeta = (meta) => {
    if (!meta || typeof meta !== 'object') return undefined
    const out = {}
    for (const [k, v] of Object.entries(meta)) {
        if (SENSITIVE.test(k)) continue
        if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) out[k] = typeof v === 'string' ? v.slice(0, 200) : v
    }
    return Object.keys(out).length ? out : undefined
}

// Fire-and-forget: an audit failure must never break the admin action itself
export const recordAudit = async (req, { action, entityType, entityId, entityLabel, changes, meta }) => {
    try {
        await AuditLog.create({
            actor: req?.admin?.email || 'system',
            action, entityType,
            entityId: entityId ? String(entityId) : undefined,
            entityLabel: entityLabel ? String(entityLabel).slice(0, 200) : undefined,
            changes: Array.isArray(changes) && changes.length ? [...new Set(changes)].filter(c => !SENSITIVE.test(c) || c === 'internalNotes').slice(0, 60) : undefined,
            meta: safeMeta(meta),
        })
    } catch (err) {
        console.error('[audit] failed to record:', err?.message || err)
    }
}
