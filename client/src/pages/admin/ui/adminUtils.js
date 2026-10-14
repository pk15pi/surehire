// Non-component helpers shared by admin pages
export const selectClass = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white'
export const inputClass = (err) => `w-full px-3 py-2 border-2 rounded bg-white disabled:bg-gray-100 disabled:text-gray-400 ${err ? 'border-red-400' : 'border-gray-300'}`

// URL search-param helpers for list pages
export const useListParams = (params, setParams, keys) => {
    const values = Object.fromEntries(keys.map(k => [k, params.get(k) || '']))
    const update = (changes) => {
        const next = new URLSearchParams(params)
        for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k) }
        if (!('page' in changes)) next.delete('page')
        setParams(next)
    }
    return [values, update]
}

export const formatDateTime = (d) => {
    if (!d) return '-'
    const date = new Date(d)
    return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
