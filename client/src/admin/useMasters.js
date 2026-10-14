import { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { listMaster } from './adminApi'

// ---------------------------------------------------------------------------
// Cached master-data hooks. One in-memory cache per page load, shared by all
// components; entries expire after TTL and can be refreshed explicitly
// (e.g. after editing master data).
// ---------------------------------------------------------------------------
const TTL = 5 * 60 * 1000
const cache = new Map() // key -> { at, items?, promise? }
const listeners = new Set()

const fetchCached = (key, loader, force) => {
    const hit = cache.get(key)
    if (!force && hit?.items && Date.now() - hit.at < TTL) return Promise.resolve(hit.items)
    if (!force && hit?.promise) return hit.promise
    const promise = loader().then(items => {
        cache.set(key, { at: Date.now(), items })
        return items
    }).catch(err => { cache.delete(key); throw err })
    cache.set(key, { ...(hit || {}), promise })
    return promise
}

// Drop cached admin + public lists for a type (call after create/update/delete)
export const invalidateMasters = (type) => {
    for (const key of [...cache.keys()]) if (!type || key.endsWith(`:${type}`)) cache.delete(key)
    listeners.forEach(fn => fn(type))
}

const useMasterLists = (types, keyPrefix, loaderFor) => {
    const typesKey = types.join(',')
    const [state, setState] = useState({ data: {}, loading: true, error: '' })
    const [version, setVersion] = useState(0)

    const load = useCallback(async (force = false) => {
        setState(s => ({ ...s, loading: true, error: '' }))
        try {
            const list = typesKey ? typesKey.split(',') : []
            const results = await Promise.all(list.map(t => fetchCached(`${keyPrefix}:${t}`, () => loaderFor(t), force)))
            setState({ data: Object.fromEntries(list.map((t, i) => [t, results[i]])), loading: false, error: '' })
        } catch (err) {
            setState(s => ({ ...s, loading: false, error: err?.response?.status === 401 ? 'auth' : 'Could not load options' }))
        }
    }, [typesKey, keyPrefix, loaderFor])

    useEffect(() => { load() }, [load, version])
    useEffect(() => {
        const fn = (type) => { if (!type || typesKey.split(',').includes(type)) setVersion(v => v + 1) }
        listeners.add(fn)
        return () => listeners.delete(fn)
    }, [typesKey])

    return { ...state, refresh: () => load(true) }
}

/** Admin: all records incl. inactive (so current inactive values can be shown). */
export const useAdminMasters = (backendUrl, types) => {
    const loader = useCallback(async (t) => (await listMaster(backendUrl, t, { includeInactive: 'true', limit: 500, sort: 'displayOrder' })).data.items, [backendUrl])
    return useMasterLists(types, `admin:${backendUrl}`, loader)
}

/** Public: active records only, safe fields. */
export const usePublicMasters = (backendUrl, types) => {
    const loader = useCallback(async (t) => (await axios.get(`${backendUrl}/api/master/${encodeURIComponent(t)}`)).data.items, [backendUrl])
    return useMasterLists(types, `public:${backendUrl}`, loader)
}

// Display label for a master record
export const masterLabel = (m, type) => {
    if (!m) return ''
    if (type === 'currencies' && m.code) return m.code === m.name ? m.code : `${m.code} - ${m.name}`
    if (m.city) return [m.city, m.state, m.country].filter(Boolean).join(', ')
    return m.name
}
