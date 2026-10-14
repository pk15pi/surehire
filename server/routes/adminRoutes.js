import express from 'express'
import { adminLogin, adminMe, getDocumentUrl, getOverview, listSubmissions, updateSubmission } from '../controllers/adminController.js'
import { archiveJob, createJob, deleteJob, duplicateJob, getJob, listJobs, publishJob, unpublishJob, updateJob } from '../controllers/adminJobController.js'
import { getCandidate, getDashboard, listApplications, listAuditLogs, listCandidates, updateApplicationStatus } from '../controllers/adminModulesController.js'
import { createCompany, listCompanies, updateCompany } from '../controllers/adminCompanyController.js'
import { createAdminMasterRouter } from './masterRoutes.js'
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

router.get('/overview', getOverview)

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

// Dashboard, people and audit
router.get('/dashboard', getDashboard)
router.get('/candidates', listCandidates)
router.get('/candidates/:id', getCandidate)
// Job applications (all jobs, including admin-posted ones): search, filters, audited status changes
router.get('/applications', listApplications)
router.patch('/applications/:id', updateApplicationStatus)
router.get('/audit-logs', listAuditLogs)

// Recruiter / company accounts (created without a password; audited)
router.get('/companies', listCompanies)
router.post('/companies', createCompany)
router.patch('/companies/:id', updateCompany)

// Master data (generic CRUD for every list in master/registry.js)
router.use('/master', createAdminMasterRouter())

export default router
