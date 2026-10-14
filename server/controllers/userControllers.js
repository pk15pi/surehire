import mongoose from "mongoose"
import Job, { publicJobFilter } from "../models/Job.js"
import JobApplication from "../models/jobApplication.js"
import User from "../models/User.js"
import { v2 as cloudinary } from "cloudinary"

const MAX_ANSWER = 2000


// Get user data
export const getUserData = async(req, res) => {

    const userId = req.userId

    try {
        
        const user = await User.findById(userId)

        if (!user) {
            return res.json({success:false, message: 'User not found'})
        }
        res.json({success:true, user})

    } catch (error) {
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
    }

}


// Apply for a Job
export const applyForJob = async(req, res) => {

    const { jobId, answers } = req.body || {}

    const userId = req.userId

    try {
        
        if (!mongoose.isValidObjectId(jobId)) {
            return res.json({success:false, message:'Job not found'})
        }

        const isAlreadyApplied = await JobApplication.find({jobId,userId})

        if (isAlreadyApplied.length > 0) {
            return res.json({success:false, message: 'Already Applied'})
        }

        // Only currently published jobs accept applications
        const jobData = await Job.findOne({ _id: jobId, ...publicJobFilter() }).select('companyId applicationDeadline screeningQuestions').lean()

        if (!jobData) {
            return res.json({success:false, message:'Job not found'})
        }
        // Deadline is a calendar date: applications stay open until the end of that day (UTC)
        if (jobData.applicationDeadline && new Date(jobData.applicationDeadline).getTime() + 86400000 <= Date.now()) {
            return res.json({success:false, message:'Applications for this job are closed'})
        }

        // Screening questions: one non-empty text answer per question set on the job
        const questions = Array.isArray(jobData.screeningQuestions) ? jobData.screeningQuestions : []
        let screeningAnswers
        if (questions.length) {
            const list = Array.isArray(answers) ? answers : []
            if (list.length !== questions.length || list.some(a => typeof a !== 'string' || !a.trim())) {
                return res.json({ success: false, message: 'Please answer all screening questions' })
            }
            if (list.some(a => a.trim().length > MAX_ANSWER)) {
                return res.json({ success: false, message: `Each answer must be at most ${MAX_ANSWER} characters` })
            }
            screeningAnswers = questions.map((question, i) => ({ question, answer: list[i].trim() }))
        }

        await JobApplication.create({
            companyId: jobData.companyId || null,
            userId,
            jobId,
            date: Date.now(),
            ...(screeningAnswers ? { screeningAnswers } : {}),
        })

        res.json({success:true, message:'Applied Successfully'})

    } catch (error) {
        // Unique {jobId,userId} index: a concurrent duplicate submit lands here
        if (error?.code === 11000) return res.json({ success: false, message: 'Already Applied' })
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
    }

}

// Get user applied applications
export const getUserJobApplications = async(req, res) => {

    try {
        
        const userId = req.userId

        const applications = await JobApplication.find({ userId })
        .populate('companyId', ' name email image')
        .populate('jobId', 'title location category level salary clientName employmentType workplaceType')
        .exec()

        if (!applications) {
            return res.json({ success:false, message:'No job application found for this user.'})
        }

        return res.json({success:true, applications})

    } catch (error) {
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
    }

}

// update user profile (resume)
export const updateUserResume = async(req, res) => {
    try {
        
        const userId = req.userId

        const resumeFile = req.file

        const userData = await User.findById(userId)

        if (!userData) {
            return res.json({ success: false, message: 'User not found' })
        }
        if (!resumeFile) {
            return res.json({ success: false, message: 'Please select a PDF resume' })
        }

        if (resumeFile) {

            const resumeUpload = await cloudinary.uploader.upload(resumeFile.path)
            userData.resume = resumeUpload.secure_url
            
        }

        await userData.save()

        return res.json({success:true, message:'Resume Updated'})

    } catch (error) {
        console.error('[controller]', error?.message || error)
        res.json({ success: false, message: 'Something went wrong. Please try again.' })
    }
}