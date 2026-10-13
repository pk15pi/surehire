import mongoose from "mongoose";

const JobApplicationSchema = new mongoose.Schema({
    userId: { type: String, ref: 'User', required: true },
    // null for jobs created by SureHire admins (not owned by a recruiter company)
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { type: String, default: 'Pending'},
    date: {type: Number, required:true}
})

const JobApplication = mongoose.model('JobApplication', JobApplicationSchema)

export default JobApplication