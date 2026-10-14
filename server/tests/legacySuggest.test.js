// GET /api/admin/jobs/:id suggests master ids for unlinked legacy text (read-only)
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startTestApp, seedTestMasters } from './fixtures.js'
import Job from '../models/Job.js'

let t, M
before(async () => { t = await startTestApp('surehire-legacy-suggest-test'); M = await seedTestMasters() })
after(async () => { await t?.stop() })

test('legacy text is matched case-insensitively but never written', async () => {
    const job = await Job.create({ title: 'Data Analyst', description: '<p>x</p>', category: 'programming', level: 'Beginner Level',
        location: 'Pune', salary: 0, date: Date.now(), status: 'published', visible: true })
    const r = await t.admin(t.request(t.app).get(`/api/admin/jobs/${job._id}`))
    assert.equal(r.status, 200)
    const s = r.body.suggestedMasters
    assert.ok(s.categoryId, 'category suggested')
    assert.ok(s.experienceLevelId, 'level suggested')
    assert.equal(s.locationIds?.length, 1)
    const fresh = await Job.findById(job._id).lean()
    assert.equal(fresh.categoryId, undefined)
    assert.equal(fresh.experienceLevelId, undefined)
    assert.ok(!fresh.locationIds?.length)
})
