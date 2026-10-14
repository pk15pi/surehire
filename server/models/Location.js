import mongoose from "mongoose";
import { commonMasterFields } from "./masterCommon.js";

// key = normalised "city|state|country" (or the name when no city), unique
const locationSchema = new mongoose.Schema({
    ...commonMasterFields,
    city: { type: String, trim: true, maxlength: 100 },
    state: { type: String, trim: true, maxlength: 100 },
    country: { type: String, trim: true, maxlength: 100 },
    postalCode: { type: String, trim: true, maxlength: 20 },
    address: { type: String, trim: true, maxlength: 500 },
}, { timestamps: true })

locationSchema.index({ key: 1 }, { unique: true })

const Location = mongoose.model('Location', locationSchema)
export default Location
