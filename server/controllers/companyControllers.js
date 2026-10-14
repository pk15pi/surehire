import Company from "../models/Company.js";
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import generateToken from "../utils/generateToken.js";
import Job from "../models/Job.js";
import JobApplication from "../models/jobApplication.js";
import mongoose from "mongoose";
import { sanitizeHtml, isHtmlEmpty } from "../utils/sanitizeHtml.js";
import MasterItem from "../models/MasterItem.js";
import Location from "../models/Location.js";
import ExperienceLevel from "../models/ExperienceLevel.js";
import { escapeRegex, normalizeKey } from "../utils/normalize.js";
import { normalizePhone } from "../utils/authCrypto.js";
import { verifyOtp } from "../services/otpService.js";
import { emailConfigured, sendEmail } from "../services/notify.js";
import { isSuspended, publicCompany, sendVerificationEmail, sessionFor } from "./companyAuthController.js";

// Recruiter jobs still send plain text (category / location / level). Link them to
// matching ACTIVE master records when one exists; never create masters, and keep
// accepting unknown text for compatibility.
const linkRecruiterMasters = async ({ category, location, level }) => {
    const refs = {}
    const [cat, loc, lvl] = await Promise.all([
        category ? MasterItem.findOne({ type: 'category', key: normalizeKey(category), active: true }).select('_id').lean() : null,
        location ? Location.findOne({ active: true, $or: [{ key: normalizeKey(location) }, { city: new RegExp(`^${escapeRegex(String(location).trim())}$`, 'i') }] }).select('_id').lean() : null,
        level ? ExperienceLevel.findOne({ key: normalizeKey(level), active: true }).select('_id').lean() : null,
    ])
    if (cat) refs.categoryId = cat._id
    if (loc) refs.locationIds = [loc._id]
    if (lvl) refs.experienceLevelId = lvl._id
    return refs
}


// Register a New Company
// Requires: name, email, password, logo, mobile + the signup OTP sent to that mobile.
// The account starts with emailVerified=false and gets a single-use confirmation link.
// Privileged fields in the body (role, status, emailVerified, tokenVersion...) are ignored.
// Duplicate emails get the same response as new ones (no enumeration); the owner is notified.
export const registerCompany = async (req, res) => {

    const body = req.body || {}
    // Only accept plain strings (blocks {"$ne": ...} style NoSQL operator injection)
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 200) : ''
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase().slice(0, 254) : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const phone = normalizePhone(body.phone)
    const phoneCode = typeof body.phoneCode === 'string' ? body.phoneCode.trim() : ''

    const imageFile = req.file;

    if (!name || !email || !password || !imageFile || !body.phone || !phoneCode) {
        return res.json({success:false, message: "Missing Details!"})
        
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        return res.json({ success: false, message: 'Please enter a valid email address' })
    }
    if (!phone) {
        return res.json({ success: false, message: 'Please enter a valid mobile number' })
    }
    if (password.length < 8 || password.length > 128) {
        return res.json({ success: false, message: 'Password must be 8 to 128 characters' })
    }
    if (!emailConfigured()) {
        return res.status(503).json({ success: false, message: 'Registration is temporarily unavailable. Please try again later.' })
    }
    const accepted = { success: true, verificationRequired: true, message: 'Almost done! Check your email for a link to confirm your account.' }
    try {

        const otp = await verifyOtp({ purpose: 'signup', channel: 'sms', destination: phone, code: phoneCode })
        if (!otp.ok) {
            return res.json({ success: false, message: 'Invalid or expired mobile code' })
        }

        const companyExists = await Company.findOne({ email })

        if (companyExists){
            sendEmail({
                to: companyExists.email,
                subject: 'SureHire sign-up attempt',
                text: 'Someone tried to create a SureHire recruiter account with this email address. You already have an account; use "Forgot password" if you cannot log in. If this was not you, no action is needed.',
            }).catch(() => {})
            return res.json(accepted)
        }
        if (await Company.exists({ phone })) {
            return res.json({ success: false, message: 'Invalid or expired mobile code' })
        }

        const salt = await bcrypt.genSalt(10)
        const hashPassword = await bcrypt.hash(password, salt)

        const imageUpload = await cloudinary.uploader.upload(imageFile.path)

        const company = await Company.create({
            name,
            email,
            password: hashPassword,
            image: imageUpload.secure_url,
            phone,
            phoneVerified: true,
            emailVerified: false,
            status: 'active',
            tokenVersion: 0,
        })
        try {
            await sendVerificationEmail(company)
        } catch {
            return res.json({ ...accepted, message: 'Account created, but the confirmation email could not be sent. Use "Resend confirmation email" in a few minutes.' })
        }
        res.json(accepted)

    } catch (error) {
        console.error('[company] register:', error?.name || 'error')
        res.json({success:false, message: 'Registration failed. Please try again.'})
    }
}

// Dummy hash so unknown accounts take as long as wrong passwords (timing-based enumeration)
const DUMMY_HASH = bcrypt.hashSync(`dummy-${Math.random()}`, 10)

// Company Login (email or mobile + password)
// Body: {email, password} (original contract) or {identifier, password}.
// Same generic message for unknown account and wrong password (no account enumeration,
// no internal error text). Rate limited per IP in companyRoutes.
export const loginCompany = async (req, res) => {

    const rawId = typeof req.body?.identifier === 'string' ? req.body.identifier : req.body?.email
    const identifier = typeof rawId === 'string' ? rawId.trim().slice(0, 254) : ''
    const password = typeof req.body?.password === 'string' ? req.body.password.slice(0, 256) : ''

    if (!identifier || !password) {
        return res.json({ success: false, message: 'Email and password are required' })
    }

    try {

        let company = null
        if (identifier.includes('@')) {
            // Accounts were registered with the email as typed; match exactly first, then lower-cased
            company = await Company.findOne({ email: identifier }) || await Company.findOne({ email: identifier.toLowerCase() })
        } else {
            const phone = normalizePhone(identifier)
            company = phone ? await Company.findOne({ phone, phoneVerified: true }) : null
        }

        const ok = await bcrypt.compare(password, company ? company.password : DUMMY_HASH)

        if (ok && company) {
            if (isSuspended(company)) {
                return res.json({ success: false, message: 'Your account is suspended. Please contact support.' })
            }
            if (company.emailVerified === false) {
                return res.json({ success: false, verificationRequired: true, message: 'Please confirm your email address first. Check your inbox for the link.' })
            }
            res.json({
                success: true,
                company: publicCompany(company),
                token: sessionFor(company)
            })
        }
        else {
            res.json({success:false, message:'Invalid email or password'})
        }

    } catch (error) {
        console.error('[company] login:', error?.name || 'error')
        res.json({ success: false, message: 'Invalid email or password' })
    }
}

// Get company data
export const getCompanyData = async (req, res) => {

    try {
        
        const company = req.company

        res.json({success:true, company})

    } catch (error) {
        
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })

    }

}

// Post a new Job
export const postJob = async (req, res) => {

    const { title, description, location, salary, level, category } = req.body || {}

    const companyId = req.company._id

    try {

        // Description is rich text from Quill: strip anything outside the allowlist (XSS)
        const cleanDescription = typeof description === 'string' ? sanitizeHtml(description) : ''
        if (typeof title !== 'string' || !title.trim()) {
            return res.json({ success: false, message: 'Job title is required' })
        }
        if (!cleanDescription || isHtmlEmpty(cleanDescription)) {
            return res.json({ success: false, message: 'Job description is required' })
        }
        const optStr = v => v === undefined || v === null || (typeof v === 'string' && v.length <= 100)
        if (title.trim().length > 200 || !optStr(location) || !optStr(level) || !optStr(category)) {
            return res.json({ success: false, message: 'Invalid job details' })
        }
        const salaryNum = Number(salary)
        if (!Number.isFinite(salaryNum) || salaryNum < 0) {
            return res.json({ success: false, message: 'Salary must be a positive number' })
        }

        const newJob = new Job({
            title: title.trim(),
            description: cleanDescription,
            location,
            salary: salaryNum,
            companyId,
            date: Date.now(),
            level,
            category,
            status: 'published',
            visible: true,
            ...(await linkRecruiterMasters({ category, location, level })),
        })

        await newJob.save()

        res.json({success:true, message: 'Job added', newJob})

    } catch (error) {
        
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })

    }
    

}

// Get company Job Applicants
export const getCompanyJobApplicants = async (req, res ) => {

    try {
        
        const companyId = req.company._id

        // find job application for the user and populate related data
        const applications = await JobApplication.find({companyId})
        .populate('userId', 'name image resume')
        .populate('jobId', 'title location category level salary')
        .exec()

        return res.json({success:true, applications})

    } catch (error) {
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
    }

}

// Get company posted jobs
export const getCompanyPostedJobs = async (req, res) => {

    try {
        
        const companyId = req.company._id

        const jobs = await Job.find({companyId}).lean()

        // Adding No. of applicants info in data (single aggregation instead of one query per job)
        const counts = jobs.length ? await JobApplication.aggregate([
            { $match: { jobId: { $in: jobs.map(j => j._id) } } },
            { $group: { _id: '$jobId', count: { $sum: 1 } } },
        ]) : []
        const countMap = new Map(counts.map(c => [String(c._id), c.count]))
        const jobsData = jobs.map(job => ({ ...job, applicants: countMap.get(String(job._id)) || 0 }))

        res.json({success:true, jobsData})

    } catch (error) {
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
    }

}

// Change Job Application Status
export const changeJobApplicationStatus = async (req, res) =>{
    
    try {
        
        const {id, status} = req.body || {}

        if (!mongoose.isValidObjectId(id)) {
            return res.json({ success: false, message: 'Invalid application id' })
        }
        if (!['Pending', 'Accepted', 'Rejected'].includes(status)) {
            return res.json({ success: false, message: 'Invalid status' })
        }

        // Only the company that owns the application may change it
        const application = await JobApplication.findOneAndUpdate(
            { _id: id, companyId: req.company._id },
            { $set: { status } },
        )

        if (!application) {
            return res.json({ success: false, message: 'Application not found' })
        }

        res.json({success:true, message:'Status Changed'})

    } catch (error) {

        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
        
    }

}

// Change Job Visiblity
export const changeVisiblity = async (req, res) => {
    try {
        
        const {id} = req.body || {}

        const companyId = req.company._id

        if (!mongoose.isValidObjectId(id)) {
            return res.json({ success: false, message: 'Invalid job id' })
        }

        const job = await Job.findById(id)

        if (!job || !job.companyId || companyId.toString() !== job.companyId.toString()) {
            return res.json({ success: false, message: 'Job not found' })
        }
        if (job.status === 'archived') {
            return res.json({ success: false, message: 'This job has been archived by an administrator' })
        }

        job.visible = !job.visible
        // Keep the newer status field consistent with the legacy visibility toggle
        job.status = job.visible ? 'published' : 'draft'

        await job.save()

        res.json({success:true, job})

    } catch (error) {
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}
