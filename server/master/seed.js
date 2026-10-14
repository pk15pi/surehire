import MasterItem from '../models/MasterItem.js'
import ExperienceLevel from '../models/ExperienceLevel.js'
import { normalizeKey } from '../utils/normalize.js'

// Suggested initial master data (matches the values the app used before masters existed)
export const SEED = {
    category: ['Engineering', 'Programming', 'Data Science', 'Designing', 'Networking', 'Management', 'Marketing', 'Cybersecurity', 'Operations', 'Finance', 'Sales', 'Healthcare', 'General'],
    employmentType: ['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship', 'Contract-to-hire', 'Project-based'],
    workplaceType: ['On-site', 'Remote', 'Hybrid'],
    currency: [{ name: 'Indian Rupee', code: 'INR' }, { name: 'US Dollar', code: 'USD' }],
    salaryPeriod: ['Hourly', 'Daily', 'Monthly', 'Annual'],
}
export const SEED_EXPERIENCE_LEVELS = [
    { name: 'Beginner level', minYears: 0, maxYears: 2 },
    { name: 'Intermediate level', minYears: 2, maxYears: 5 },
    { name: 'Senior level', minYears: 5, maxYears: 10 },
    { name: 'Lead', minYears: 8, maxYears: null },
    { name: 'Executive', minYears: 12, maxYears: null },
]

/**
 * Idempotent upsert: inserts missing values only ($setOnInsert). Existing
 * records (including ones an admin renamed/deactivated) are never modified.
 * @returns {{ created: number, existing: number }}
 */
export const seedMasterData = async ({ dryRun = false, log = () => {} } = {}) => {
    let created = 0, existing = 0
    const upsert = async (model, filter, doc) => {
        const found = await model.findOne(filter).select('_id').lean()
        if (found) { existing++; return }
        created++
        log(`  + ${model.modelName}${doc.type ? `:${doc.type}` : ''} ${doc.name}`)
        if (!dryRun) await model.updateOne(filter, { $setOnInsert: { ...doc, active: true, createdBy: 'seed', updatedBy: 'seed' } }, { upsert: true })
    }
    for (const [type, values] of Object.entries(SEED)) {
        for (const [i, v] of values.entries()) {
            const doc = typeof v === 'string' ? { name: v } : v
            const key = normalizeKey(doc.name)
            await upsert(MasterItem, { type, key }, { type, key, displayOrder: i, ...doc })
        }
    }
    for (const [i, lvl] of SEED_EXPERIENCE_LEVELS.entries()) {
        const key = normalizeKey(lvl.name)
        await upsert(ExperienceLevel, { key }, { key, displayOrder: i, ...lvl })
    }
    return { created, existing }
}
