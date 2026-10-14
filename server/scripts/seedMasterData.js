// ---------------------------------------------------------------------------
// Seed the initial master data (categories, employment/workplace types,
// currencies, salary periods, experience levels). Idempotent: only missing
// values are inserted; existing records are never changed.
//
//   node scripts/seedMasterData.js            # dry run: lists what would be added
//   node scripts/seedMasterData.js --apply    # inserts the missing values
//
// Uses MONGODB_URI from server/.env and the 'job-portal' database
// (override the db name with MIGRATE_DB_NAME).
// ---------------------------------------------------------------------------
import 'dotenv/config'
import mongoose from 'mongoose'
import { seedMasterData } from '../master/seed.js'

const apply = process.argv.includes('--apply')
const dbName = process.env.MIGRATE_DB_NAME || 'job-portal'

const run = async () => {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set')
    // No automatic index/collection creation during a dry run (zero writes)
    await mongoose.connect(`${process.env.MONGODB_URI}/${dbName}`, { autoIndex: apply, autoCreate: apply })
    console.log(`[seed] db '${dbName}' (${apply ? 'APPLY' : 'DRY RUN'})`)
    const { created, existing } = await seedMasterData({ dryRun: !apply, log: console.log })
    if (apply) await Promise.all(Object.values(mongoose.models).map(m => m.createIndexes().catch(e => console.warn(`[seed] index warning ${m.modelName}:`, e.message))))
    console.log(`[seed] ${apply ? 'created' : 'would create'} ${created}, already present ${existing}`)
}

run()
    .catch(err => { console.error('[seed] failed:', err.message); process.exitCode = 1 })
    .finally(() => mongoose.disconnect())
