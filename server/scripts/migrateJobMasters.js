// ---------------------------------------------------------------------------
// Link existing jobs to master data (categories, types, locations, ...).
//
//   node scripts/migrateJobMasters.js           # DRY RUN (default): read-only mapping report
//   node scripts/migrateJobMasters.js --apply   # create missing masters + link jobs
//
// Safe & idempotent: only empty job reference fields are filled; legacy text is
// kept; ambiguous/unmapped values are reported and left alone; job and
// application counts are checked before/after. Run seedMasterData.js first and
// take a backup (mongodump) before --apply.
//
// In dry-run mode every driver write method is disabled, so the script cannot
// modify the database even by accident (no index creation either).
// Env: MONGODB_URI (server/.env), MIGRATE_DB_NAME (default 'job-portal').
// ---------------------------------------------------------------------------
import 'dotenv/config'
import mongoose from 'mongoose'
import { formatReport, runJobMasterMigration } from '../master/migrateJobMasters.js'

const apply = process.argv.includes('--apply')
const asJson = process.argv.includes('--json')
const dbName = process.env.MIGRATE_DB_NAME || 'job-portal'

const WRITE_METHODS = ['insertOne', 'insertMany', 'updateOne', 'updateMany', 'replaceOne', 'deleteOne', 'deleteMany', 'bulkWrite',
    'findOneAndUpdate', 'findOneAndReplace', 'findOneAndDelete', 'createIndex', 'createIndexes', 'dropIndex', 'dropIndexes', 'drop', 'rename']

// Make any write attempt throw (defence in depth for the dry run)
const blockWrites = () => {
    const proto = mongoose.mongo.Collection.prototype
    for (const m of WRITE_METHODS) {
        if (typeof proto[m] === 'function') proto[m] = function blocked() { throw new Error(`[dry-run] blocked write: ${m}`) }
    }
    const dbProto = mongoose.mongo.Db.prototype
    for (const m of ['createCollection', 'dropCollection', 'dropDatabase', 'renameCollection']) {
        if (typeof dbProto[m] === 'function') dbProto[m] = function blocked() { throw new Error(`[dry-run] blocked write: ${m}`) }
    }
}

const run = async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')
    if (!apply) blockWrites()
    await mongoose.connect(`${process.env.MONGODB_URI}/${dbName}`, { autoIndex: false, autoCreate: false })
    console.log(`[migrateJobMasters] db '${dbName}' (${apply ? 'APPLY' : 'DRY RUN - read only'})`)
    const result = await runJobMasterMigration({ apply, log: console.log })
    if (asJson) {
        console.log(JSON.stringify({ ...result, rows: result.rows.map(({ rule, loc, jobIds, masterId, ...r }) => r) }, null, 2))
    } else {
        console.log(formatReport(result))
    }
    if (!apply) console.log('\nDry run only - nothing was written. Re-run with --apply after taking a backup.')
}

run()
    .catch(err => { console.error('[migrateJobMasters] failed:', err.message); process.exitCode = 1 })
    .finally(() => mongoose.disconnect())
