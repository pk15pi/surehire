// Vercel serverless entry for the combined (client + server) deployment.
// All /api/* and /webhooks requests are rewritten here by the root vercel.json.
// The Express app itself lives in server/app.js (no listen(), no DB connect).
import '../server/config/instrument.js'
import connectDB from '../server/config/db.js'
import connectCloudinary from '../server/config/cloudinary.js'
import { createApp } from '../server/app.js'

const app = createApp()

let ready = null
const init = () => {
    if (!ready) {
        ready = Promise.all([connectDB(), connectCloudinary()]).catch((err) => { ready = null; throw err })
    }
    return ready
}

export default async function handler(req, res) {
    try {
        await init()
    } catch (err) {
        console.error('[api] startup failed:', err?.message || err)
        res.statusCode = 503
        res.setHeader('Content-Type', 'application/json')
        return res.end(JSON.stringify({ success: false, message: 'Service temporarily unavailable' }))
    }
    return app(req, res)
}
