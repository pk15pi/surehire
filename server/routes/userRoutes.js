import express from 'express';
import { applyForJob, getUserData, getUserJobApplications, updateUserResume } from '../controllers/userControllers.js';
import { resumeUpload, single } from '../config/multer.js';

const router = express.Router()

// Every candidate route needs a signed-in Clerk user
const requireUser = (req, res, next) => {
    let userId = null
    try { userId = typeof req.auth === 'function' ? req.auth()?.userId : null } catch { userId = null }
    if (!userId) return res.status(401).json({ success: false, message: 'Please log in to continue' })
    req.userId = userId
    next()
}

router.use(requireUser)

// Get user data
router.get('/user', getUserData)

// Apply for a job
router.post('/apply', applyForJob)

// Get applied jobs data
router.get('/applications', getUserJobApplications)

// update user profile (resume)
router.post('/update-resume', single(resumeUpload, 'resume'), updateUserResume)

export default router;
