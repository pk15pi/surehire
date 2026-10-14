// Normalised keys used for case-insensitive uniqueness of master data
export const normalizeText = (s) => String(s ?? '').normalize('NFKC').trim().replace(/\s+/g, ' ')
export const normalizeKey = (s) => normalizeText(s).toLowerCase()
export const slugify = (s) => normalizeKey(s).replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120)
export const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
