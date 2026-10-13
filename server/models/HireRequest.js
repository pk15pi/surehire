import mongoose from "mongoose";

const storedFileSchema = new mongoose.Schema({
    publicId: { type: String, required: true },    // Cloudinary public_id (never exposed publicly)
    resourceType: { type: String, default: 'raw' },
    deliveryType: { type: String, default: 'authenticated' },
    originalName: { type: String },
    mimeType: { type: String },
    size: { type: Number },
}, { _id: false })

const hireRequestSchema = new mongoose.Schema({
    referenceId: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true, trim: true },
    contactName: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    countryCode: { type: String, required: true },
    phone: { type: String, required: true },
    roleTitle: { type: String, required: true, trim: true },
    industry: { type: String, required: true },
    numberOfPositions: { type: Number, required: true, min: 1 },
    location: { type: String, required: true, trim: true },
    experience: { type: String, trim: true },
    employmentType: { type: String, enum: ['full-time', 'contract', 'contract-to-hire', 'temporary'], required: true },
    urgency: { type: String, enum: ['immediate', 'within-1-month', '1-3-months', 'exploring'] },
    description: { type: String, trim: true },
    jdFile: { type: storedFileSchema },
    sourcePage: { type: String, trim: true },
    status: { type: String, enum: ['new', 'reviewing', 'in_progress', 'closed'], default: 'new', index: true },
    // Internal admin fields (never set by public forms)
    adminNotes: { type: String, trim: true, maxlength: 5000, default: '' },
    adminUpdatedAt: { type: Date },
    adminUpdatedBy: { type: String },
}, { timestamps: true })

const HireRequest = mongoose.model('HireRequest', hireRequestSchema)

export { storedFileSchema }
export default HireRequest
