import mongoose from "mongoose";
import { storedFileSchema } from "./HireRequest.js";

const candidateSubmissionSchema = new mongoose.Schema({
    referenceId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    countryCode: { type: String, required: true },
    phone: { type: String, required: true },
    currentLocation: { type: String, required: true, trim: true },
    industry: { type: String, required: true },
    discipline: { type: String, required: true, trim: true },   // e.g. Mechanical, Electrical, Civil
    totalExperience: { type: Number, required: true, min: 0 },
    currentRole: { type: String, trim: true },
    noticePeriod: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    message: { type: String, trim: true },
    resume: { type: storedFileSchema, required: true },
    consent: { type: Boolean, required: true },
    sourcePage: { type: String, trim: true },
    status: { type: String, enum: ['new', 'reviewing', 'shortlisted', 'rejected', 'placed'], default: 'new', index: true },
    // Internal admin fields (never set by public forms)
    adminNotes: { type: String, trim: true, maxlength: 5000, default: '' },
    adminUpdatedAt: { type: Date },
    adminUpdatedBy: { type: String },
}, { timestamps: true })

const CandidateSubmission = mongoose.model('CandidateSubmission', candidateSubmissionSchema)

export default CandidateSubmission
