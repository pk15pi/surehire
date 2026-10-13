import mongoose from "mongoose"
import Job, { PUBLIC_EXCLUDE, publicJobFilter } from "../models/Job.js"

const COMPANY_PUBLIC = 'name image'

// Strip values that must not be shown publicly
export const toPublicJob = (job) => {
    const out = { ...job, status: 'published' }
    if (out.salaryUndisclosed) { delete out.salary; delete out.salaryMin; delete out.salaryMax }
    return out
}

// Get all publicly visible jobs (published / legacy-visible, within publish window)
export const getJobs = async (req, res) => {
    try {
        const jobs = await Job.find(publicJobFilter())
            .select(PUBLIC_EXCLUDE)
            .populate({ path: "companyId", select: COMPANY_PUBLIC })
            .lean()

        res.json({ success: true, jobs: jobs.map(toPublicJob) })

    } catch (error) {
        console.error('[jobs] getJobs:', error?.message || error)
        res.status(500).json({ success: false, message: 'Could not load jobs' })
    }
}

// Get a single public job by ID (404 for drafts, archived, scheduled or expired jobs)
export const getJobById = async (req, res) => {
    try {
        const { id } = req.params
        if (!mongoose.isValidObjectId(id)) {
            return res.status(404).json({ success: false, message: 'Job not found' })
        }

        const job = await Job.findOne({ _id: id, ...publicJobFilter() })
            .select(PUBLIC_EXCLUDE)
            .populate({ path: 'companyId', select: COMPANY_PUBLIC })
            .lean()

        if (!job) {
            return res.status(404).json({ success: false, message: 'Job not found' })
        }

        res.json({ success: true, job: toPublicJob(job) })

    } catch (error) {
        console.error('[jobs] getJobById:', error?.message || error)
        res.status(500).json({ success: false, message: 'Could not load job' })
    }
}
