import Job from '../models/Job.js'
import JobApplication from '../models/jobApplication.js'
import MasterItem from '../models/MasterItem.js'
import Location from '../models/Location.js'
import Client from '../models/Client.js'
import ExperienceLevel from '../models/ExperienceLevel.js'
import { MASTER_TYPES } from './registry.js'
import { normalizeKey, normalizeText, slugify } from '../utils/normalize.js'
import { SEED, SEED_EXPERIENCE_LEVELS } from './seed.js'

// Values that seedMasterData.js provides (so the report can say so)
const SEEDED = new Set([
    ...Object.entries(SEED).flatMap(([type, vals]) => vals.map(v => `${type}|${normalizeKey(typeof v === 'string' ? v : v.code)}`)),
    ...Object.entries(SEED).flatMap(([type, vals]) => vals.map(v => `${type}|${normalizeKey(typeof v === 'string' ? v : v.name)}`)),
    ...SEED_EXPERIENCE_LEVELS.map(l => `level|${normalizeKey(l.name)}`),
])

// ---------------------------------------------------------------------------
// Link existing jobs to master data based on their legacy text values.
// - Dry run (default) only READS and returns a mapping report.
// - apply: creates missing masters for unambiguous values and fills ONLY the
//   job reference fields that are still empty. Legacy text is never changed,
//   jobs/applications are never created or deleted. Re-running is a no-op.
// ---------------------------------------------------------------------------

const PLACEHOLDERS = new Set(['', 'not specified', 'n/a', 'na', 'none', '-'])
const MULTI_SEPARATORS = /\s\/\s|\/|;|\||\s&\s|\sor\s|\sand\s/i

// One rule per legacy text field
const RULES = [
    { field: 'category', idField: 'categoryId', model: MasterItem, itemType: 'category' },
    { field: 'employmentType', idField: 'employmentTypeId', model: MasterItem, itemType: 'employmentType' },
    { field: 'workplaceType', idField: 'workplaceTypeId', model: MasterItem, itemType: 'workplaceType' },
    { field: 'salaryPeriod', idField: 'salaryPeriodId', model: MasterItem, itemType: 'salaryPeriod' },
    { field: 'currency', idField: 'currencyId', model: MasterItem, itemType: 'currency', byCode: true },
    { field: 'department', idField: 'departmentId', model: MasterItem, itemType: 'department' },
    { field: 'experienceLevel', idField: 'experienceLevelId', model: ExperienceLevel, fallbackField: 'level' },
    { field: 'clientName', idField: 'clientId', model: Client },
    { field: 'skills', idField: 'skillIds', model: MasterItem, itemType: 'skill', array: true },
    { field: 'location', idField: 'locationIds', model: Location, location: true, array: true },
]

const valuesOf = (job, rule) => {
    if (rule.array && !rule.location) return (job[rule.field] || []).map(normalizeText).filter(Boolean)
    const v = normalizeText(job[rule.field] || (rule.fallbackField ? job[rule.fallbackField] : '') || '')
    return v ? [v] : []
}

// Parse a legacy location string into its parts (or flag it)
const parseLocation = (text, workplaceType) => {
    if (/^remote\b/i.test(text) || /^remote$/i.test(workplaceType || '')) return { skip: 'remote (handled by workplace type)' }
    const clean = text.replace(/\s*\((hybrid|on-?site)\)\s*$/i, '').trim()
    if (MULTI_SEPARATORS.test(clean)) return { ambiguous: 'contains several places' }
    const parts = clean.split(',').map(s => s.trim()).filter(Boolean)
    if (!parts.length) return { skip: 'empty' }
    const city = parts[0]
    const country = parts.length > 1 ? parts[parts.length - 1] : ''
    const state = parts.length > 2 ? parts.slice(1, -1).join(', ') : ''
    return { name: clean, city, state, country }
}

const keyFor = (rule, value, loc) => {
    if (rule.location) return MASTER_TYPES.locations.keyOf({ name: loc.name, city: loc.city, state: loc.state, country: loc.country })
    return normalizeKey(value)
}

// Finds candidate masters for a value; >1 candidate = ambiguous
const findCandidates = async (rule, value, loc) => {
    const base = rule.itemType ? { type: rule.itemType } : {}
    if (rule.byCode) return rule.model.find({ ...base, $or: [{ code: value.toUpperCase() }, { key: normalizeKey(value) }] }).select('name active code').lean()
    if (rule.location) {
        const exact = await rule.model.find({ key: keyFor(rule, value, loc) }).select('name active city').lean()
        if (exact.length || loc.state || loc.country) return exact
        // Bare city name: match any location in that city (several = ambiguous)
        return rule.model.find({ city: new RegExp(`^${loc.city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }).select('name active city').lean()
    }
    return rule.model.find({ ...base, key: normalizeKey(value) }).select('name active').lean()
}

/**
 * Read-only: suggested master ids for one job's still-unlinked legacy text
 * (exactly one ACTIVE match by normalized name/key). Nothing is written; the
 * admin form preselects these and the admin must save to persist them.
 */
export const suggestJobMasters = async (job) => {
    const out = {}
    for (const rule of RULES) {
        const already = rule.array ? (job[rule.idField] || []).length > 0 : !!job[rule.idField]
        if (already) continue
        const ids = []
        for (const value of valuesOf(job, rule)) {
            if (PLACEHOLDERS.has(normalizeKey(value))) continue
            const loc = rule.location ? parseLocation(value, job.workplaceType) : null
            if (loc?.skip || loc?.ambiguous) continue
            const active = (await findCandidates(rule, value, loc)).filter(c => c.active !== false)
            if (active.length === 1) ids.push(String(active[0]._id))
        }
        if (ids.length) out[rule.idField] = rule.array ? [...new Set(ids)] : ids[0]
    }
    return out
}

/** Builds the mapping report (read-only). */
export const planJobMasterMigration = async () => {
    const jobs = await Job.find({}).select('category employmentType workplaceType salaryPeriod currency department experienceLevel level clientName skills location ' +
        RULES.map(r => r.idField).join(' ')).lean()
    const groups = new Map() // `${field}|${key}` -> row
    for (const job of jobs) {
        for (const rule of RULES) {
            const already = rule.array ? (job[rule.idField] || []).length > 0 : !!job[rule.idField]
            for (const value of valuesOf(job, rule)) {
                if (PLACEHOLDERS.has(normalizeKey(value))) continue
                const loc = rule.location ? parseLocation(value, job.workplaceType) : null
                const gk = `${rule.field}|${normalizeKey(value)}`
                let row = groups.get(gk)
                if (!row) {
                    row = { field: rule.field, idField: rule.idField, value, count: 0, linked: 0, jobIds: [], rule, loc }
                    groups.set(gk, row)
                }
                row.count++
                if (already) row.linked++
                else row.jobIds.push(job._id)
            }
        }
    }
    const rows = []
    for (const row of groups.values()) {
        const { rule, loc } = row
        let proposed, action, ambiguous = false, reason = ''
        if (loc?.skip) { action = 'skip'; proposed = '-'; reason = loc.skip }
        else if (loc?.ambiguous) { action = 'unmapped'; proposed = '-'; ambiguous = true; reason = loc.ambiguous }
        else {
            const candidates = await findCandidates(rule, row.value, loc)
            if (candidates.length > 1) { action = 'unmapped'; ambiguous = true; proposed = candidates.map(c => c.name).join(' | '); reason = 'matches several masters' }
            else if (candidates.length === 1) { action = 'link'; proposed = candidates[0].name + (candidates[0].active ? '' : ' (inactive)'); row.masterId = candidates[0]._id }
            else {
                action = 'create'; proposed = rule.location ? loc.name : (rule.byCode ? row.value.toUpperCase() : row.value)
                if (SEEDED.has(`${rule.itemType || (rule.model === ExperienceLevel ? 'level' : '-')}|${normalizeKey(row.value)}`)) reason = 'provided by seedMasterData (run seed first)'
            }
        }
        rows.push({ ...row, proposed, action, ambiguous, reason })
    }
    rows.sort((a, b) => a.field.localeCompare(b.field) || b.count - a.count)
    return { jobCount: jobs.length, rows }
}

const uniqueClientCode = async (name) => {
    const base = (slugify(name).replace(/-/g, '').toUpperCase() || 'CLIENT').slice(0, 20)
    for (let i = 0; i < 100; i++) {
        const code = i ? `${base}${i + 1}` : base
        if (!(await Client.exists({ code }))) return code
    }
    throw new Error(`Could not allocate a client code for ${name}`)
}

const createMaster = async (row) => {
    const { rule, loc } = row
    const meta = { active: true, createdBy: 'migration', updatedBy: 'migration' }
    if (rule.location) return (await Location.create({ ...meta, name: loc.name, city: loc.city, state: loc.state, country: loc.country, key: keyFor(rule, row.value, loc) }))._id
    if (rule.model === Client) return (await Client.create({ ...meta, name: row.value, key: normalizeKey(row.value), code: await uniqueClientCode(row.value) }))._id
    if (rule.model === ExperienceLevel) return (await ExperienceLevel.create({ ...meta, name: row.value, key: normalizeKey(row.value) }))._id
    const doc = { ...meta, type: rule.itemType, name: rule.byCode ? row.value.toUpperCase() : row.value, key: normalizeKey(row.value) }
    if (rule.byCode) doc.code = row.value.toUpperCase()
    return (await MasterItem.create(doc))._id
}

/**
 * @param {{ apply?: boolean, log?: Function }} opts
 * @returns report with rows, counts before/after and per-field link totals
 */
export const runJobMasterMigration = async ({ apply = false, log = () => {} } = {}) => {
    const before = { jobs: await Job.countDocuments(), applications: await JobApplication.countDocuments() }
    const plan = await planJobMasterMigration()
    const result = { apply, before, after: null, jobCount: plan.jobCount, rows: plan.rows, created: 0, jobsUpdated: 0 }
    if (!apply) return result

    // Resolve a master id for every linkable row (creating missing ones)
    for (const row of plan.rows) {
        if (row.action === 'create') { row.masterId = await createMaster(row); result.created++; log(`  created ${row.field} master "${row.proposed}"`) }
    }
    // Fill only empty reference fields, job by job (arrays keep the original order)
    const linkable = plan.rows.filter(r => r.masterId && r.jobIds.length)
    const perJob = new Map()
    for (const row of linkable) {
        for (const id of row.jobIds) {
            const key = String(id)
            const set = perJob.get(key) || {}
            if (row.rule.array) (set[row.idField] ||= []).push(row.masterId)
            else set[row.idField] = row.masterId
            perJob.set(key, set)
        }
    }
    // Split into per-field updates so one already-set field doesn't block the others
    const fieldOps = [...perJob.entries()].flatMap(([id, set]) => Object.entries(set).map(([k, v]) => ({
        updateOne: {
            filter: { _id: id, $or: [{ [k]: { $exists: false } }, { [k]: null }, ...(Array.isArray(v) ? [{ [k]: { $size: 0 } }] : [])] },
            update: { $set: { [k]: v } },
        },
    })))
    if (fieldOps.length) {
        const res = await Job.bulkWrite(fieldOps, { ordered: false })
        result.jobsUpdated = perJob.size
        result.fieldsLinked = res.modifiedCount
    }
    result.after = { jobs: await Job.countDocuments(), applications: await JobApplication.countDocuments() }
    if (result.after.jobs !== before.jobs || result.after.applications !== before.applications) {
        throw new Error(`Count mismatch! before ${JSON.stringify(before)} after ${JSON.stringify(result.after)}`)
    }
    return result
}

// Plain-text table for the CLI
export const formatReport = (result) => {
    const lines = [`Jobs scanned: ${result.jobCount}`, `Counts before: jobs=${result.before.jobs} applications=${result.before.applications}`]
    lines.push('', 'field            | value                          | jobs | linked | action   | proposed master                | ambiguous | note')
    lines.push('-'.repeat(130))
    for (const r of result.rows) {
        lines.push([r.field.padEnd(16), String(r.value).slice(0, 30).padEnd(30), String(r.count).padStart(4), String(r.linked).padStart(6), r.action.padEnd(8),
            String(r.proposed).slice(0, 30).padEnd(30), (r.ambiguous ? 'YES' : 'no').padEnd(9), r.reason].join(' | '))
    }
    if (result.apply) lines.push('', `Masters created: ${result.created}`, `Jobs updated: ${result.jobsUpdated}`, `Counts after: jobs=${result.after.jobs} applications=${result.after.applications}`)
    return lines.join('\n')
}
