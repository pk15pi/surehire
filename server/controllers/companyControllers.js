import Company from "../models/Company.js";
import bcrypt from 'bcrypt';
import { v2 as cloudinary } from 'cloudinary';
import generateToken from "../utils/generateToken.js";
import Job from "../models/Job.js";
import JobApplication from "../models/jobApplication.js";
import mongoose from "mongoose";
import { sanitizeHtml, isHtmlEmpty } from "../utils/sanitizeHtml.js";


// Register a New Company
export const registerCompany = async (req, res) => {

    const {name, email, password} = req.body

    const imageFile = req.file;

    if (!name || !email || !password || !imageFile) {
        return res.json({success:false, message: "Missing Details!"})
        
    }
    try {
        
        const companyExists = await Company.findOne({email})

        if (companyExists){
            return res.json({success:false, message: "Company already registered"})
        }

        const salt = await bcrypt.genSalt(10)
        const hashPassword = await bcrypt.hash(password, salt)

        const imageUpload = await cloudinary.uploader.upload(imageFile.path)

        const company = await Company.create({
            name,
            email,
            password: hashPassword,
            image: imageUpload.secure_url
        })
        res.json({
            success: true,
            company: {
                _id: company._id,
                name: company.name,
                email: company.email,
                image: company.image
            },
            token: generateToken(company._id)
        })

    } catch (error) {
        res.json({success:false, message: error.message})
    }
}

// Company Login
export const loginCompany = async (req, res) => {

    const { email, password } = req.body

    try {
        
        const company = await Company.findOne({email})

        if (await bcrypt.compare(password, company.password)) {
            
            res.json({
                success: true,
                company:{
                    _id: company._id,
                    name: company.name,
                    email: company.email,
                    image: company.image
                },
                token: generateToken(company._id)
            })
        }
        else {
            res.json({success:false, message:'Invalid email or password'})
        }

    } catch (error) {
        res.json({
            success:false,
            message: error.message
        })
    }
}

// Get company data
export const getCompanyData = async (req, res) => {

    try {
        
        const company = req.company

        res.json({success:true, company})

    } catch (error) {
        
        res.json({success:false, message: error.message})

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
        })

        await newJob.save()

        res.json({success:true, message: 'Job added', newJob})

    } catch (error) {
        
        res.json({success:false, message: error.message})

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
        res.json({success:false, message:error.message})
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
        res.json({success:false, message:error.message})
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

        res.json({success:false, message:error.message })
        
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
        res.json({success:false, message:error.message})
    }
}
