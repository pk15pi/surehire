// Shared test fixtures: seeds master data in the (in-memory) test DB and
// returns a lookup of ids by name. Never used against a real database.
import MasterItem from '../models/MasterItem.js'
import Location from '../models/Location.js'
import Client from '../models/Client.js'
import ExperienceLevel from '../models/ExperienceLevel.js'
import { seedMasterData } from '../master/seed.js'
import { normalizeKey } from '../utils/normalize.js'

const byName = (docs) => Object.fromEntries(docs.map(d => [d.name, String(d._id)]))

export const seedTestMasters = async () => {
    await seedMasterData()
    const extra = (type, name, more = {}) => MasterItem.create({ type, name, key: normalizeKey(name), ...more })
    await extra('skill', 'AutoCAD'); await extra('skill', 'PDMS'); await extra('skill', 'Selenium'); await extra('skill', 'Cypress')
    await extra('department', 'IT')
    const loc = (name, city, state, country) => Location.create({ name, city, state, country, key: [city, state, country].map(normalizeKey).join('|') })
    await loc('Pune', 'Pune', 'Maharashtra', 'India')
    await loc('Mumbai', 'Mumbai', 'Maharashtra', 'India')
    await loc('Chennai', 'Chennai', 'Tamil Nadu', 'India')
    await Client.create({ name: 'Acme Refineries', key: normalizeKey('Acme Refineries'), code: 'ACME' })
    await Client.create({ name: 'Secret Corp', key: normalizeKey('Secret Corp'), code: 'SECRET', confidential: true })
    return loadIds()
}

export const loadIds = async () => {
    const items = await MasterItem.find().lean()
    const of = (t) => byName(items.filter(i => i.type === t))
    return {
        category: of('category'), employmentType: of('employmentType'), workplaceType: of('workplaceType'),
        salaryPeriod: of('salaryPeriod'), currency: of('currency'), skill: of('skill'), department: of('department'),
        location: byName(await Location.find().lean()), client: byName(await Client.find().lean()),
        level: byName(await ExperienceLevel.find().lean()),
    }
}

export const clearMasters = async () => {
    await Promise.all([MasterItem.deleteMany({}), Location.deleteMany({}), Client.deleteMany({}), ExperienceLevel.deleteMany({})])
}

// Boots the app on a fresh in-memory MongoDB and logs in as admin
export const startTestApp = async (dbName) => {
    process.env.ADMIN_EMAILS = 'admin@test.local'
    process.env.ADMIN_PASSWORD = 'test-password-123456'
    process.env.ADMIN_JWT_SECRET = 'test-admin-secret-'.padEnd(48, 'x')
    process.env.JWT_SECRET = 'test-recruiter-secret-'.padEnd(48, 'y')
    delete process.env.ADMIN_PASSWORD_HASH
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    const mongoose = (await import('mongoose')).default
    const request = (await import('supertest')).default
    const { createApp } = await import('../app.js')
    const mongod = await MongoMemoryServer.create()
    await mongoose.connect(mongod.getUri(), { dbName })
    await Promise.all(Object.values(mongoose.models).map(m => m.init()))
    const app = createApp({ clerk: false })
    const login = await request(app).post('/api/admin/login').send({ email: 'admin@test.local', password: 'test-password-123456' })
    if (login.status !== 200) throw new Error('admin login failed in test setup')
    const token = login.body.token
    return {
        app, request, mongoose, token,
        admin: (r) => r.set('Authorization', `Bearer ${token}`),
        stop: async () => { await mongoose.connection.dropDatabase().catch(() => {}); await mongoose.disconnect(); await mongod.stop() },
    }
}
