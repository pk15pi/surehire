import mongoose from "mongoose";
import { commonMasterFields } from "./masterCommon.js";

// Hiring organisations SureHire recruits for. Admin-only except id + name of
// non-confidential clients. internalNotes is never selected by default.
const clientSchema = new mongoose.Schema({
    ...commonMasterFields,
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 30 },
    contactPerson: { type: String, trim: true, maxlength: 150 },
    email: { type: String, trim: true, lowercase: true, maxlength: 254 },
    phone: { type: String, trim: true, maxlength: 40 },
    website: { type: String, trim: true, maxlength: 300 },
    industryId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterItem', default: null },
    address: { type: String, trim: true, maxlength: 500 },
    confidential: { type: Boolean, default: false },
    internalNotes: { type: String, trim: true, maxlength: 10000, select: false },
}, { timestamps: true })

clientSchema.index({ key: 1 }, { unique: true })
clientSchema.index({ code: 1 }, { unique: true })

const Client = mongoose.model('Client', clientSchema)
export default Client
