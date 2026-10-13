import mongoose from "mongoose"
import Job, { publicJobFilter } from "../models/Job.js"
import JobApplication from "../models/jobApplication.js"
import User from "../models/User.js"
import { v2 as cloudinary } from "cloudinary"


// Get user data
export const getUserData = async(req, res) => {

    const {userId} = req.auth()

    try {
        
        const user = await User.findById(userId)

        if (!user) {
            return res.json({success:false, message: 'User not found'})
        }
        res.json({success:true, user})

    } catch (error) {
        res.json({success:false, message: error.message})
    }

}


// Apply for a Job
export const applyForJob = async(req, res) => {

    const { jobId } = req.body

    const {userId} = req.auth()

    try {
        
        if (!mongoose.isValidObjectId(jobId)) {
            return res.json({success:false, message:'Job not found'})
        }

        const isAlreadyApplied = await JobApplication.find({jobId,userId})

        if (isAlreadyApplied.length > 0) {
            return res.json({success:false, message: 'Already Applied'})
        }

        // Only currently published jobs accept applications
        const jobData = await Job.findOne({ _id: jobId, ...publicJobFilter() }).select('companyId applicationDeadline').lean()

        if (!jobData) {
            return res.json({success:false, message:'Job not found'})
        }
        // Deadline is a calendar date: applications stay open until the end of that day (UTC)
        if (jobData.applicationDeadline && new Date(jobData.applicationDeadline).getTime() + 86400000 <= Date.now()) {
            return res.json({success:false, message:'Applications for this job are closed'})
        }

        await JobApplication.create({
            companyId: jobData.companyId || null,
            userId,
            jobId,
            date: Date.now()
        })

        res.json({success:true, message:'Applied Successfully'})

    } catch (error) {
        res.json({success:false, message: error.message})
    }

}

// Get user applied applications
export const getUserJobApplications = async(req, res) => {

    try {
        
        const {userId} = req.auth()

        const applications = await JobApplication.find({ userId })
        .populate('companyId', ' name email image')
        .populate('jobId', 'title location category level salary clientName employmentType workplaceType')
        .exec()

        if (!applications) {
            return res.json({ success:false, message:'No job application found for this user.'})
        }

        return res.json({success:true, applications})

    } catch (error) {
        res.json({success:false, message:error.message})
    }

}

// update user profile (resume)
export const updateUserResume = async(req, res) => {
    try {
        
        const {userId} = req.auth()

        const resumeFile = req.file

        const userData = await User.findById(userId)

        if (resumeFile) {

            const resumeUpload = await cloudinary.uploader.upload(resumeFile.path)
            userData.resume = resumeUpload.secure_url
            
        }

        await userData.save()

        return res.json({success:true, message:'Resume Updated'})

    } catch (error) {
        res.json({success:false, message:error.message})
    }
}