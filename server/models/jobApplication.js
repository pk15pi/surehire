import mongoose from "mongoose";

const JobApplicationSchema = new mongoose.Schema({
    userId: { type: String, ref: 'User', required: true },
    // null for jobs created by SureHire admins (not owned by a recruiter company)
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true },
    status: { type: String, default: 'Pending'},
    date: {type: Number, required:true},
    // Answers to the job's screening questions (question text copied at apply time)
    screeningAnswers: {
        type: [{ _id: false, question: { type: String, maxlength: 500 }, answer: { type: String, maxlength: 2000 } }],
        default: undefined,
    },
})

// One application per user per job (guards double-submit races)
JobApplicationSchema.index({ jobId: 1, userId: 1 }, { unique: true })

const JobApplication = mongoose.model('JobApplication', JobApplicationSchema)

export default JobApplication