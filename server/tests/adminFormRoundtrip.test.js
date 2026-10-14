// Verifies the admin edit form contract end-to-end: the client's jobToForm()
// prefill + diffForm() PATCH payload against the real API on an in-memory DB.
// Skipped automatically if the client folder is not next to the server.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// URLs (not paths) so dynamic import() also works on Windows
const clientOptions = new URL('../../client/src/admin/jobOptions.js', import.meta.url)
const clientValidation = new URL('../../client/src/pages/admin/jobs/jobValidation.js', import.meta.url)
const hasClient = existsSync(fileURLToPath(clientOptions)) && existsSync(fileURLToPath(clientValidation))

process.env.ADMIN_EMAILS = 'admin@test.local'
process.env.ADMIN_PASSWORD = 'test-password-123456'
process.env.ADMIN_JWT_SECRET = 'test-admin-secret-'.padEnd(48, 'x')
process.env.JWT_SECRET = 'test-recruiter-secret-'.padEnd(48, 'y')
delete process.env.ADMIN_PASSWORD_HASH

let mongod, mongoose, request, app, token, opts, validate, M

before(async () => {
    if (!hasClient) return
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    mongoose = (await import('mongoose')).default
    request = (await import('supertest')).default
    const { createApp } = await import('../app.js')
    opts = await import(clientOptions.href)
    validate = (await import(clientValidation.href)).validateJobForm
    mongod = await MongoMemoryServer.create()
    await mongoose.connect(mongod.getUri(), { dbName: 'surehire-form-test' })
    await Promise.all(Object.values(mongoose.models).map(m => m.init()))
    M = await (await import('./fixtures.js')).seedTestMasters()
    app = createApp({ clerk: false })
    token = (await request(app).post('/api/admin/login').send({ email: 'admin@test.local', password: 'test-password-123456' })).body.token
})

after(async () => {
    if (!hasClient) return
    await mongoose.connection.dropDatabase().catch(() => {})
    await mongoose.disconnect()
    await mongod?.stop()
})

test('create form payload -> GET -> prefill -> PATCH only changed fields', { skip: !hasClient && 'client folder not found' }, async () => {
    const auth = (r) => r.set('Authorization', `Bearer ${token}`)
    const form = {
        ...opts.EMPTY_JOB, title: 'QA Engineer', description: '<p>Test things</p>', locationIds: [M.location.Chennai],
        categoryId: M.category.Engineering, employmentTypeId: M.employmentType['Full-time'], workplaceTypeId: M.workplaceType['On-site'],
        skillIds: [M.skill.Selenium], salaryMin: '500000', salaryMax: '900000', applicationDeadline: '2026-12-31', internalNotes: 'secret',
    }
    assert.ok(validate({ ...form, categoryId: '' }, { isCreate: true }).categoryId, 'client requires category on create')
    assert.ok(validate({ ...form, locationIds: [] }, { isCreate: true }).locationIds, 'client requires a location for on-site')
    assert.deepEqual(validate({ ...form, locationIds: [] }, { isCreate: true, isRemote: true }), {}, 'remote needs no location')
    assert.deepEqual(validate(form, { isCreate: true }), {}, 'client validation passes')
    const created = await auth(request(app).post('/api/admin/jobs')).send(opts.formToPayload(form))
    assert.equal(created.status, 201, JSON.stringify(created.body))

    const got = await auth(request(app).get(`/api/admin/jobs/${created.body.job._id}`))
    const initial = opts.jobToForm(got.body.job)
    // prefill shape: strings for inputs, YYYY-MM-DD for dates, arrays for tags
    assert.equal(initial.title, 'QA Engineer')
    assert.equal(initial.salaryMin, '500000')
    assert.equal(initial.vacancies, '1')
    assert.equal(initial.applicationDeadline, '2026-12-31')
    assert.deepEqual(initial.skillIds, [M.skill.Selenium])
    assert.deepEqual(initial.locationIds, [M.location.Chennai])
    assert.equal(initial.categoryId, M.category.Engineering)
    // only the default currency (no currencyId sent) remains as a legacy hint
    assert.deepEqual(opts.legacyLabels(got.body.job), { currencyId: 'INR' }, 'linked refs -> no legacy hints')
    assert.equal(initial.internalNotes, 'secret')
    assert.equal(initial.referenceId, created.body.job.referenceId)
    assert.deepEqual(opts.diffForm(initial, { ...initial }), {}, 'no changes -> empty diff')

    const edited = { ...initial, salaryMax: '950000', skillIds: [M.skill.Selenium, M.skill.Cypress] }
    const changes = opts.diffForm(initial, edited)
    assert.deepEqual(changes, { salaryMax: '950000', skillIds: [M.skill.Selenium, M.skill.Cypress] })
    const res = await auth(request(app).patch(`/api/admin/jobs/${created.body.job._id}`)).send(changes)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.job.salaryMax, 950000)
    assert.equal(res.body.job.internalNotes, 'secret')
    assert.equal(res.body.job.city, 'Chennai')
    assert.deepEqual(res.body.job.skills, ['Selenium', 'Cypress'])
    assert.equal(String(res.body.job.categoryId), M.category.Engineering, 'unrelated refs preserved')

    // server validation errors map to form field names
    const bad = await auth(request(app).patch(`/api/admin/jobs/${created.body.job._id}`)).send({ salaryMin: '2000000' })
    assert.equal(bad.status, 400)
    assert.ok(Object.keys(bad.body.errors).every(k => k in opts.EMPTY_JOB), 'error keys are form fields')
})

test('legacy job prefills from level/location and saves without requiring a city', { skip: !hasClient && 'client folder not found' }, async () => {
    const auth = (r) => r.set('Authorization', `Bearer ${token}`)
    const { insertedId } = await mongoose.connection.collection('jobs').insertOne({
        title: 'Old job', description: '<p>x</p>', location: 'Hyderabad', category: 'Programming', level: 'Intermediate level', salary: 70000, date: Date.now(), visible: true, companyId: new mongoose.Types.ObjectId(),
    })
    const got = await auth(request(app).get(`/api/admin/jobs/${insertedId}`))
    const initial = opts.jobToForm(got.body.job)
    assert.equal(initial.experienceLevelId, '')
    assert.equal(opts.legacyLabels(got.body.job).experienceLevelId, 'Intermediate level', 'legacy level shown as a hint')
    assert.equal(opts.legacyLabels(got.body.job).categoryId, 'Programming')
    assert.equal(initial.status, 'published')
    assert.deepEqual(validate({ ...initial }, { legacyLocation: got.body.job.location }), {})
    const changes = opts.diffForm(initial, { ...initial, title: 'Old job (updated)' })
    const res = await auth(request(app).patch(`/api/admin/jobs/${insertedId}`)).send(changes)
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.job.location, 'Hyderabad')
    assert.equal(res.body.job.salary, 70000)
    assert.equal(res.body.job.category, 'Programming', 'legacy text untouched')
})
