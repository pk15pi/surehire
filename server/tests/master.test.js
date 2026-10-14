// Master data API: CRUD, validation, duplicates, auth, usage-safe delete,
// pagination, public endpoint. In-memory MongoDB only.
import { test, before, after, beforeEach, describe } from 'node:test'
import assert from 'node:assert/strict'
import { startTestApp, seedTestMasters, clearMasters } from './fixtures.js'
import Job from '../models/Job.js'
import AuditLog from '../models/AuditLog.js'

let t, M
before(async () => { t = await startTestApp('surehire-master-test') })
after(async () => { await t?.stop() })
beforeEach(async () => { await clearMasters(); await Job.deleteMany({}); await AuditLog.deleteMany({}); M = await seedTestMasters() })

const api = (method, path) => t.admin(t.request(t.app)[method](`/api/admin/master${path}`))

describe('master data CRUD', () => {
    test('lists types with counts', async () => {
        const res = await api('get', '')
        assert.equal(res.status, 200)
        const cats = res.body.types.find(x => x.type === 'categories')
        assert.equal(cats.total, 13)
        assert.ok(res.body.types.some(x => x.type === 'clients'))
    })

    test('create, read, update, deactivate, activate, delete + audit', async () => {
        let res = await api('post', '/departments').send({ name: '  Human   Resources ', description: 'HR' })
        assert.equal(res.status, 201, JSON.stringify(res.body))
        const id = res.body.item._id
        assert.equal(res.body.item.name, 'Human Resources')
        assert.equal(res.body.item.active, true)
        res = await api('get', `/departments/${id}`)
        assert.equal(res.body.item.usageCount, 0)
        res = await api('patch', `/departments/${id}`).send({ name: 'People Ops' })
        assert.equal(res.status, 200); assert.equal(res.body.item.name, 'People Ops'); assert.equal(res.body.item.description, 'HR')
        res = await api('post', `/departments/${id}/deactivate`)
        assert.equal(res.body.item.active, false)
        // hidden by default, shown with includeInactive
        assert.ok(!(await api('get', '/departments')).body.items.some(i => i._id === id))
        assert.ok((await api('get', '/departments?includeInactive=true')).body.items.some(i => i._id === id))
        res = await api('post', `/departments/${id}/activate`)
        assert.equal(res.body.item.active, true)
        res = await api('delete', `/departments/${id}`)
        assert.equal(res.status, 200)
        assert.equal((await api('get', `/departments/${id}`)).status, 404)
        await new Promise(r => setTimeout(r, 50))
        const actions = (await AuditLog.find({ entityId: id }).sort({ createdAt: 1 }).lean()).map(a => a.action)
        assert.deepEqual(actions, ['create', 'update', 'deactivate', 'activate', 'delete'])
    })

    test('duplicates (case/space-insensitive) are rejected with 409', async () => {
        let res = await api('post', '/categories').send({ name: 'engineering ' })
        assert.equal(res.status, 409)
        res = await api('post', '/clients').send({ name: 'New Co', code: 'acme' })
        assert.equal(res.status, 409); assert.ok(res.body.errors.code)
        res = await api('post', '/locations').send({ name: 'Pune City', city: 'pune', state: 'Maharashtra', country: 'India' })
        assert.equal(res.status, 409)
        // the same name in a different type is fine
        res = await api('post', '/departments').send({ name: 'Engineering' })
        assert.equal(res.status, 201)
        // renaming onto an existing name
        res = await api('patch', `/categories/${M.category.Finance}`).send({ name: 'Sales' })
        assert.equal(res.status, 409)
    })

    test('invalid input returns 400 with field errors', async () => {
        let res = await api('post', '/categories').send({ name: '' })
        assert.equal(res.status, 400); assert.ok(res.body.errors.name)
        res = await api('post', '/currencies').send({ name: 'Euro', code: 'EURO' })
        assert.equal(res.status, 400); assert.ok(res.body.errors.code)
        res = await api('post', '/experience-levels').send({ name: 'Odd', minYears: 9, maxYears: 2 })
        assert.equal(res.status, 400); assert.ok(res.body.errors.maxYears)
        res = await api('post', '/skills').send({ name: 'Rust', categoryId: '507f1f77bcf86cd799439011' })
        assert.equal(res.status, 400); assert.ok(res.body.errors.categoryId)
        assert.equal((await api('get', '/nope')).status, 404)
        assert.equal((await api('get', '/categories/not-an-id')).status, 400)
    })

    test('401 without an admin token', async () => {
        assert.equal((await t.request(t.app).get('/api/admin/master/categories')).status, 401)
        assert.equal((await t.request(t.app).post('/api/admin/master/categories').send({ name: 'X' })).status, 401)
        assert.equal((await t.request(t.app).delete(`/api/admin/master/categories/${M.category.Finance}`)).status, 401)
    })

    test('delete is blocked (409) while referenced by jobs or other masters; usage counts are reported', async () => {
        await Job.create({ title: 'J', description: '<p>x</p>', category: 'Finance', location: 'Pune', level: 'x', salary: 1, date: Date.now(), categoryId: M.category.Finance, locationIds: [M.location.Pune, M.location.Mumbai] })
        let res = await api('delete', `/categories/${M.category.Finance}`)
        assert.equal(res.status, 409); assert.equal(res.body.usageCount, 1)
        res = await api('delete', `/locations/${M.location.Mumbai}`)
        assert.equal(res.status, 409)
        res = await api('get', '/locations?includeInactive=true')
        assert.equal(res.body.items.find(i => i.name === 'Pune').usageCount, 1)
        assert.equal(res.body.items.find(i => i.name === 'Chennai').usageCount, 0)
        // a category used by a skill
        res = await api('post', '/skills').send({ name: 'Excel', categoryId: M.category.Operations })
        assert.equal(res.status, 201)
        assert.equal((await api('delete', `/categories/${M.category.Operations}`)).status, 409)
        // deactivation is always allowed
        assert.equal((await api('post', `/categories/${M.category.Finance}/deactivate`)).status, 200)
    })

    test('search, pagination and empty lists', async () => {
        let res = await api('get', '/categories?limit=5&page=3&sort=name')
        assert.equal(res.body.total, 13); assert.equal(res.body.pages, 3); assert.equal(res.body.items.length, 3)
        res = await api('get', '/categories?q=data')
        assert.deepEqual(res.body.items.map(i => i.name), ['Data Science'])
        res = await api('get', '/industries')
        assert.equal(res.status, 200); assert.deepEqual(res.body.items, []); assert.equal(res.body.total, 0)
    })

    test('client internal notes are admin-only and confidential clients are not public', async () => {
        const res = await api('post', '/clients').send({ name: 'Globex', code: 'glx', internalNotes: 'pays late', email: 'a@globex.test' })
        assert.equal(res.status, 201, JSON.stringify(res.body))
        assert.equal(res.body.item.code, 'GLX'); assert.equal(res.body.item.internalNotes, 'pays late')
        const pub = await t.request(t.app).get('/api/master/clients')
        assert.equal(pub.status, 200)
        const names = pub.body.items.map(i => i.name)
        assert.ok(names.includes('Globex')); assert.ok(!names.includes('Secret Corp'))
        for (const i of pub.body.items) assert.deepEqual(Object.keys(i).sort(), ['_id', 'name'])
    })
})

describe('public master endpoint', () => {
    test('returns active records with safe fields only', async () => {
        await api('post', `/categories/${M.category.Finance}/deactivate`)
        const res = await t.request(t.app).get('/api/master/categories')
        assert.equal(res.status, 200)
        assert.ok(!res.body.items.some(i => i.name === 'Finance'))
        for (const i of res.body.items) assert.deepEqual(Object.keys(i).sort(), ['_id', 'name'])
        const cur = await t.request(t.app).get('/api/master/currencies')
        assert.deepEqual(cur.body.items.map(i => i.code).sort(), ['INR', 'USD'])
        assert.equal((await t.request(t.app).get('/api/master/bogus')).status, 404)
    })
})
