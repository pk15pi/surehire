import mongoose from "mongoose";
import { commonMasterFields } from "./masterCommon.js";

// displayOrder doubles as the seniority order
const experienceLevelSchema = new mongoose.Schema({
    ...commonMasterFields,
    minYears: { type: Number, min: 0, max: 60, default: null },
    maxYears: { type: Number, min: 0, max: 60, default: null },
}, { timestamps: true })

experienceLevelSchema.index({ key: 1 }, { unique: true })

const ExperienceLevel = mongoose.model('ExperienceLevel', experienceLevelSchema)
export default ExperienceLevel
