import express from 'express'
import { adminLogin, adminMe, getDocumentUrl, listSubmissions, updateSubmission } from '../controllers/adminController.js'
import { archiveJob, createJob, deleteJob, duplicateJob, getJob, listJobs, publishJob, unpublishJob, updateJob } from '../controllers/adminJobController.js'
import { noStore, protectAdmin } from '../middleware/adminAuth.js'
import { adminApiRateLimiter, adminLoginRateLimiter } from '../middleware/rateLimit.js'

const router = express.Router()

router.use(noStore)

// Public (rate-limited) login
router.post('/login', adminLoginRateLimiter, adminLogin)

// Everything below requires a valid admin JWT
router.use(adminApiRateLimiter, protectAdmin)

router.get('/me', adminMe)
router.get('/submissions', listSubmissions)
router.patch('/submissions/:type/:id', updateSubmission)
router.get('/resumes/:id/url', getDocumentUrl)

// Job management
router.get('/jobs', listJobs)
router.post('/jobs', createJob)
router.get('/jobs/:id', getJob)
router.patch('/jobs/:id', updateJob)
router.delete('/jobs/:id', deleteJob)
router.post('/jobs/:id/publish', publishJob)
router.post('/jobs/:id/unpublish', unpublishJob)
router.post('/jobs/:id/archive', archiveJob)
router.post('/jobs/:id/duplicate', duplicateJob)

export default router
