import express from 'express'
import { changeJobApplicationStatus, changeVisiblity, getCompanyData, getCompanyJobApplicants, getCompanyPostedJobs, loginCompany, postJob, registerCompany } from '../controllers/companyControllers.js'
import { loginWithOtp, requestOtp, resendVerification, resetPassword, verifyEmail, verifyResetOtp } from '../controllers/companyAuthController.js'
import { getPhone, sendPhoneCode, verifyPhoneCode } from '../controllers/companyPhoneController.js'
import { imageUpload, single } from '../config/multer.js'
import { companyAuthRateLimiter, otpSendRateLimiter, otpVerifyRateLimiter } from '../middleware/rateLimit.js'
import { protectCompany } from '../middleware/authMiddleware.js'

const router = express.Router()

// Recruiter self sign-up is off unless ALLOW_RECRUITER_SIGNUP=true (checked before any upload)
const signupEnabled = (req, res, next) => process.env.ALLOW_RECRUITER_SIGNUP === 'true'
    ? next() : res.status(403).json({ success: false, message: 'Registration is not available' })

// Register a company
router.post('/register', signupEnabled, companyAuthRateLimiter, single(imageUpload, 'image'), registerCompany)

// Company login (email or mobile + password)
router.post('/login', companyAuthRateLimiter, loginCompany)

// One-time codes (login / reset / signup mobile check) and passwordless login
router.post('/auth/otp/request', otpSendRateLimiter, requestOtp)
router.post('/auth/otp/login', otpVerifyRateLimiter, loginWithOtp)

// Forgot password: request code (purpose=reset) -> verify -> set new password
router.post('/auth/password/verify-otp', otpVerifyRateLimiter, verifyResetOtp)
router.post('/auth/password/reset', otpVerifyRateLimiter, resetPassword)

// Email confirmation link
router.post('/auth/verify-email', otpVerifyRateLimiter, verifyEmail)
router.post('/auth/verify-email/resend', otpSendRateLimiter, resendVerification)

// Account mobile number (authenticated): add/change -> OTP -> verified
router.get('/phone', protectCompany, getPhone)
router.post('/phone/send-code', protectCompany, otpSendRateLimiter, sendPhoneCode)
router.post('/phone/verify', protectCompany, otpVerifyRateLimiter, verifyPhoneCode)

// get company data
router.get('/company', protectCompany, getCompanyData)

// post a job
router.post('/post-job', protectCompany, postJob)

// get applicants data of a company
router.get('/applicants', protectCompany, getCompanyJobApplicants)

// get company job list
router.get('/list-job', protectCompany, getCompanyPostedJobs)

// change application status
router.post('/change-status', protectCompany, changeJobApplicationStatus)

// change application visiblity
router.post('/change-visiblity', protectCompany, changeVisiblity)

export default router
