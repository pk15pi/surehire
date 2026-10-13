import path from "path"
import { v2 as cloudinary } from "cloudinary"
import CallRequest from "../models/CallRequest.js"
import Enquiry from "../models/Enquiry.js"
import HireRequest from "../models/HireRequest.js"
import CandidateSubmission from "../models/CandidateSubmission.js"
import { hasValidSignature } from "../config/enquiryUpload.js"
import {
    Validator, sendValidationError, generateReferenceId, isBot, safeBaseName,
    I_AM_OPTIONS, PREFERRED_TIME_OPTIONS, EMPLOYMENT_TYPES, URGENCY_OPTIONS, INDUSTRIES
} from "../utils/enquiryUtils.js"

// Upload a validated document buffer to Cloudinary as a private ("authenticated") raw asset.
// Only the public_id is stored; no public URL is ever returned to the client.
const uploadPrivateDocument = (file, folder, referenceId) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const publicId = `${safeBaseName(file.originalname)}_${referenceId}${ext}`
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
            resource_type: 'raw',
            type: 'authenticated',
            folder,
            public_id: publicId,
            overwrite: false,
        }, (error, result) => {
            if (error) return reject(error)
            resolve({
                publicId: result.public_id,
                resourceType: result.resource_type || 'raw',
                deliveryType: result.type || 'authenticated',
                originalName: String(file.originalname).slice(0, 200),
                mimeType: file.mimetype,
                size: file.size,
            })
        })
        stream.end(file.buffer)
    })
}

const serverError = (res, error, context) => {
    console.error(`[enquiries] ${context}:`, error?.message || error)
    return res.status(500).json({ success: false, message: 'Something went wrong. Please try again.' })
}

const fakeSuccess = (res, prefix) =>
    res.status(201).json({ success: true, message: 'Submitted successfully', referenceId: generateReferenceId(prefix) })

// POST /api/enquiries/call  - Schedule a call
export const createCallRequest = async (req, res) => {
    try {
        if (isBot(req.body)) return fakeSuccess(res, 'CALL')

        const v = new Validator(req.body)
        v.string('name', { required: true, min: 2, max: 100, label: 'Name' })
        v.phone('countryCode', 'phone', { required: true })
        v.email('email', { required: true })
        v.oneOf('iAm', I_AM_OPTIONS, { required: true, label: 'Your role' })
        v.oneOf('preferredTime', PREFERRED_TIME_OPTIONS, { required: true, label: 'Preferred time' })
        if (v.data.preferredTime === 'specific') {
            v.date('preferredDate', { required: true, label: 'Date' })
            v.time('preferredStartTime', { required: true, label: 'Start time' })
            v.time('preferredEndTime', { required: true, label: 'End time' })
            v.timezone('timezone', { required: true })
            if (v.data.preferredStartTime && v.data.preferredEndTime && v.data.preferredEndTime <= v.data.preferredStartTime) {
                v.fail('preferredEndTime', 'End time must be after start time')
            }
        }
        v.string('description', { required: false, max: 2000, label: 'Description' })
        v.string('sourcePage', { required: false, max: 200, label: 'Source page' })

        if (!v.isValid) return sendValidationError(res, v.errors)

        const referenceId = generateReferenceId('CALL')
        await CallRequest.create({ ...v.data, referenceId })

        return res.status(201).json({ success: true, message: 'Call request received. Our team will reach out soon.', referenceId })
    } catch (error) {
        return serverError(res, error, 'createCallRequest')
    }
}

// POST /api/enquiries/quick  - Quick enquiry / contact form
export const createQuickEnquiry = async (req, res) => {
    try {
        if (isBot(req.body)) return fakeSuccess(res, 'ENQ')

        const v = new Validator(req.body)
        v.string('name', { required: true, min: 2, max: 100, label: 'Name' })
        v.email('email', { required: true })
        v.phone('countryCode', 'phone', { required: false })
        v.oneOf('iAm', I_AM_OPTIONS, { required: false, label: 'Your role' })
        v.string('subject', { required: false, max: 150, label: 'Subject' })
        v.string('message', { required: true, min: 10, max: 2000, label: 'Message' })
        v.string('sourcePage', { required: false, max: 200, label: 'Source page' })

        if (!v.isValid) return sendValidationError(res, v.errors)

        const referenceId = generateReferenceId('ENQ')
        await Enquiry.create({ ...v.data, referenceId })

        return res.status(201).json({ success: true, message: 'Thanks! Your enquiry has been received.', referenceId })
    } catch (error) {
        return serverError(res, error, 'createQuickEnquiry')
    }
}

// POST /api/enquiries/hire  - Employer hiring request (optional JD file, field "jdFile")
export const createHireRequest = async (req, res) => {
    try {
        if (isBot(req.body)) return fakeSuccess(res, 'HIRE')

        const v = new Validator(req.body)
        v.string('companyName', { required: true, min: 2, max: 150, label: 'Company name' })
        v.string('contactName', { required: true, min: 2, max: 100, label: 'Contact name' })
        v.string('designation', { required: false, max: 100, label: 'Designation' })
        v.email('email', { required: true })
        v.phone('countryCode', 'phone', { required: true })
        v.string('roleTitle', { required: true, min: 2, max: 150, label: 'Role title' })
        v.oneOf('industry', INDUSTRIES, { required: true, label: 'Industry' })
        v.integer('numberOfPositions', { required: true, min: 1, max: 1000, label: 'Number of positions' })
        v.string('location', { required: true, min: 2, max: 150, label: 'Location' })
        v.string('experience', { required: false, max: 50, label: 'Experience' })
        v.oneOf('employmentType', EMPLOYMENT_TYPES, { required: true, label: 'Employment type' })
        v.oneOf('urgency', URGENCY_OPTIONS, { required: false, label: 'Urgency' })
        v.string('description', { required: false, max: 5000, label: 'Description' })
        v.string('sourcePage', { required: false, max: 200, label: 'Source page' })

        if (req.file && !hasValidSignature(req.file)) {
            v.fail('jdFile', 'The uploaded file does not look like a valid PDF or DOCX')
        }
        if (!v.isValid) return sendValidationError(res, v.errors)

        const referenceId = generateReferenceId('HIRE')

        let jdFile
        if (req.file) {
            try {
                jdFile = await uploadPrivateDocument(req.file, 'surehire/job-descriptions', referenceId)
            } catch (error) {
                return serverError(res, error, 'JD upload')
            }
        }

        await HireRequest.create({ ...v.data, referenceId, ...(jdFile ? { jdFile } : {}) })

        return res.status(201).json({ success: true, message: 'Hiring request received. Our team will contact you shortly.', referenceId })
    } catch (error) {
        return serverError(res, error, 'createHireRequest')
    }
}

// POST /api/enquiries/candidate  - Candidate resume submission (required file, field "resume")
export const createCandidateSubmission = async (req, res) => {
    try {
        if (isBot(req.body)) return fakeSuccess(res, 'CAND')

        const v = new Validator(req.body)
        v.string('fullName', { required: true, min: 2, max: 100, label: 'Full name' })
        v.email('email', { required: true })
        v.phone('countryCode', 'phone', { required: true })
        v.string('currentLocation', { required: true, min: 2, max: 150, label: 'Current location' })
        v.oneOf('industry', INDUSTRIES, { required: true, label: 'Industry' })
        v.string('discipline', { required: true, min: 2, max: 100, label: 'Engineering discipline' })
        v.integer('totalExperience', { required: true, min: 0, max: 60, label: 'Total experience' })
        v.string('currentRole', { required: false, max: 150, label: 'Current role' })
        v.string('noticePeriod', { required: false, max: 50, label: 'Notice period' })
        v.url('linkedinUrl', { required: false, label: 'LinkedIn URL' })
        v.string('message', { required: false, max: 2000, label: 'Message' })
        v.string('sourcePage', { required: false, max: 200, label: 'Source page' })
        v.mustBeTrue('consent', 'Please accept the consent to proceed')

        if (!req.file) {
            v.fail('resume', 'Resume is required (PDF or DOCX, max 5 MB)')
        } else if (!hasValidSignature(req.file)) {
            v.fail('resume', 'The uploaded file does not look like a valid PDF or DOCX')
        }
        if (!v.isValid) return sendValidationError(res, v.errors)

        const referenceId = generateReferenceId('CAND')

        let resume
        try {
            resume = await uploadPrivateDocument(req.file, 'surehire/resumes', referenceId)
        } catch (error) {
            return serverError(res, error, 'resume upload')
        }

        await CandidateSubmission.create({ ...v.data, referenceId, resume })

        return res.status(201).json({ success: true, message: 'Resume submitted successfully. We will be in touch when a matching role opens.', referenceId })
    } catch (error) {
        return serverError(res, error, 'createCandidateSubmission')
    }
}
