import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import * as Sentry from "@sentry/node"
import { clerkMiddleware } from '@clerk/express'
import { clerkWebhooks } from './controllers/webhooks.js'
import companyRoutes from './routes/companyRoutes.js'
import jobRoutes from './routes/jobRoutes.js'
import userRoutes from './routes/userRoutes.js'
import enquiryRoutes from './routes/enquiryRoutes.js'
import adminRoutes from './routes/adminRoutes.js'
import { createPublicMasterRouter } from './routes/masterRoutes.js'

// Browsers may only call the API cross-origin from these sites. Same-origin calls
// (the normal case on surehire.in) don't use CORS at all. Extra origins (e.g. a
// preview URL) can be added with CORS_ORIGINS="https://a.example,https://b.example".
export const DEFAULT_CORS_ORIGINS = ['https://surehire.in', 'https://www.surehire.in', 'http://localhost:5173', 'http://127.0.0.1:5173']
const corsOptions = () => {
    const extra = String(process.env.CORS_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean)
    const allowed = new Set([...DEFAULT_CORS_ORIGINS, ...extra])
    return { origin: (origin, cb) => cb(null, !origin || allowed.has(origin)) }
}

// Builds the Express app without connecting to any external service, so it can
// be imported by server.js (runtime) and by the test suite (in-memory MongoDB).
// `clerk: false` is only used by tests, which have no Clerk keys.
export const createApp = ({ clerk = true } = {}) => {

    // Initialize Express
    const app = express()

    // Trust the first proxy (Vercel / reverse proxy) so rate limiting sees the real client IP
    app.set('trust proxy', 1)

    // Middlewares
    app.use(helmet())
    app.use(cors(corsOptions()))
    // Clerk/Svix signatures are computed over the exact raw body, so the webhook
    // must be registered before express.json() re-serialises anything.
    app.post('/webhooks', express.raw({ type: '*/*', limit: '1mb' }), clerkWebhooks)
    app.use(express.json({ limit: '100kb' }))
    if (clerk) app.use(clerkMiddleware())

    // Routes
    app.get('/',(req,res) => res.send("API Working"))
    app.use('/api/company', companyRoutes)
    app.use('/api/jobs', jobRoutes)
    app.use('/api/users', userRoutes)
    app.use('/api/enquiries', enquiryRoutes)
    app.use('/api/master', createPublicMasterRouter())
    app.use('/api/admin', adminRoutes)

    Sentry.setupExpressErrorHandler(app);

    return app
}

export default createApp
