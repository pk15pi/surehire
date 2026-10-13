import express from 'express'
import { createCallRequest, createCandidateSubmission, createHireRequest, createQuickEnquiry } from '../controllers/enquiryController.js'
import { singleDocUpload } from '../config/enquiryUpload.js'
import { enquiryRateLimiter } from '../middleware/rateLimit.js'

const router = express.Router()

// Public, write-only endpoints (no list/get routes are exposed publicly)
router.use(enquiryRateLimiter)

// Schedule a call
router.post('/call', createCallRequest)

// Quick enquiry
router.post('/quick', createQuickEnquiry)

// Hire engineers request (optional JD file)
router.post('/hire', singleDocUpload('jdFile'), createHireRequest)

// Candidate resume submission (resume required)
router.post('/candidate', singleDocUpload('resume'), createCandidateSubmission)

export default router
