// ---------------------------------------------------------------------------
// One-off, idempotent backfill for jobs created before admin job management.
//
//   node scripts/migrateJobs.js            # dry run (default): prints what would change
//   node scripts/migrateJobs.js --apply    # writes the changes
//
// For every job it only fills fields that are MISSING; existing values are never
// overwritten and nothing is deleted. Safe to run repeatedly. JobApplication
// documents are not touched.
//   - status       : 'published' if visible !== false, otherwise 'draft'
//   - referenceId  : SH-JOB-YYMMDD-XXXX based on the legacy `date` (or _id time)
//   - createdAt    : from legacy `date` (ms) or the ObjectId timestamp
//   - updatedAt    : same as createdAt
//   - experienceLevel : copied from legacy `level`
//   - currency     : 'INR'
//
// Uses MONGODB_URI from server/.env and the same 'job-portal' database as the app.
// Take a backup (mongodump) before running with --apply in production.
// ---------------------------------------------------------------------------
import 'dotenv/config'
import mongoose from 'mongoose'
import Job, { generateReferenceId } from '../models/Job.js'

const apply = process.argv.includes('--apply')
const dbName = process.env.MIGRATE_DB_NAME || 'job-portal'

const run = async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')
    await mongoose.connect(`${process.env.MONGODB_URI}/${dbName}`)
    console.log(`[migrateJobs] connected to db '${dbName}' (${apply ? 'APPLY' : 'DRY RUN'})`)

    const col = Job.collection
    const usedRefs = new Set((await col.distinct('referenceId', { referenceId: { $type: 'string' } })))
    const cursor = col.find({}, { projection: { _id: 1, visible: 1, status: 1, referenceId: 1, date: 1, createdAt: 1, updatedAt: 1, level: 1, experienceLevel: 1, currency: 1 } })

    let scanned = 0, changed = 0
    for await (const job of cursor) {
        scanned++
        const set = {}
        const created = job.createdAt || new Date(typeof job.date === 'number' ? job.date : job._id.getTimestamp())

        if (!job.status) set.status = job.visible === false ? 'draft' : 'published'
        if (!job.referenceId) {
            let ref
            do { ref = generateReferenceId(created) } while (usedRefs.has(ref))
            usedRefs.add(ref)
            set.referenceId = ref
        }
        if (!job.createdAt) set.createdAt = created
        if (!job.updatedAt) set.updatedAt = created
        if (!job.experienceLevel && job.level) set.experienceLevel = job.level
        if (!job.currency) set.currency = 'INR'

        if (!Object.keys(set).length) continue
        changed++
        console.log(`  ${job._id}: ${JSON.stringify(set)}`)
        // Raw collection update so mongoose timestamps don't override createdAt/updatedAt
        if (apply) await col.updateOne({ _id: job._id }, { $set: set })
    }

    if (apply) await Job.createIndexes().catch(e => console.warn('[migrateJobs] index creation warning:', e.message))
    console.log(`[migrateJobs] scanned ${scanned}, ${apply ? 'updated' : 'would update'} ${changed}`)
}

run()
    .catch(err => { console.error('[migrateJobs] failed:', err.message); process.exitCode = 1 })
    .finally(() => mongoose.disconnect())
