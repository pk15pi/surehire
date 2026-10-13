import mongoose from "mongoose";

const callRequestSchema = new mongoose.Schema({
    referenceId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    countryCode: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    iAm: { type: String, enum: ['employer', 'candidate', 'partner', 'other'], required: true },
    preferredTime: { type: String, enum: ['anytime', 'morning', 'afternoon', 'evening', 'specific'], required: true },
    preferredDate: { type: String },      // YYYY-MM-DD (only when preferredTime === 'specific')
    preferredStartTime: { type: String }, // HH:MM
    preferredEndTime: { type: String },   // HH:MM
    timezone: { type: String },           // IANA timezone, e.g. Asia/Kolkata
    description: { type: String, trim: true },
    sourcePage: { type: String, trim: true },
    status: { type: String, enum: ['new', 'scheduled', 'completed', 'cancelled'], default: 'new', index: true },
    // Internal admin fields (never set by public forms)
    adminNotes: { type: String, trim: true, maxlength: 5000, default: '' },
    adminUpdatedAt: { type: Date },
    adminUpdatedBy: { type: String },
}, { timestamps: true })

const CallRequest = mongoose.model('CallRequest', callRequestSchema)

export default CallRequest
