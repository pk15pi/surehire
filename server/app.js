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
    app.use(cors())
    app.use(express.json({ limit: '100kb' }))
    if (clerk) app.use(clerkMiddleware())

    // Routes
    app.get('/',(req,res) => res.send("API Working"))
    app.post('/webhooks',clerkWebhooks)
    app.use('/api/company', companyRoutes)
    app.use('/api/jobs', jobRoutes)
    app.use('/api/users', userRoutes)
    app.use('/api/enquiries', enquiryRoutes)
    app.use('/api/admin', adminRoutes)

    Sentry.setupExpressErrorHandler(app);

    return app
}

export default createApp
