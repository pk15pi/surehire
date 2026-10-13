import mongoose from "mongoose";

// Quick enquiry (contact form)
const enquirySchema = new mongoose.Schema({
    referenceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    countryCode: { type: String },
    phone: { type: String },
    iAm: { type: String, enum: ['employer', 'candidate', 'partner', 'other'] },
    subject: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    sourcePage: { type: String, trim: true },
    status: { type: String, enum: ['new', 'in_progress', 'resolved', 'closed'], default: 'new', index: true },
    // Internal admin fields (never set by public forms)
    adminNotes: { type: String, trim: true, maxlength: 5000, default: '' },
    adminUpdatedAt: { type: Date },
    adminUpdatedBy: { type: String },
}, { timestamps: true })

const Enquiry = mongoose.model('Enquiry', enquirySchema)

export default Enquiry
