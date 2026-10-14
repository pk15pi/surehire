import mongoose from "mongoose";
import { commonMasterFields } from "./masterCommon.js";

// One collection for all *simple* lookup lists (name + optional code). They share
// identical shape, so a `type` discriminator avoids eight near-identical collections.
// Lists with their own fields (Location, Client, ExperienceLevel) have dedicated models.
export const MASTER_ITEM_TYPES = ['category', 'employmentType', 'workplaceType', 'industry', 'department', 'currency', 'salaryPeriod', 'skill']

const masterItemSchema = new mongoose.Schema({
    type: { type: String, required: true, enum: MASTER_ITEM_TYPES, index: true },
    ...commonMasterFields,
    // Short machine code, e.g. ISO currency "INR" (required for currencies)
    code: { type: String, trim: true, uppercase: true, maxlength: 20 },
    // Skills may belong to a job category
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterItem', default: null },
}, { timestamps: true })

// Case-insensitive uniqueness per list
masterItemSchema.index({ type: 1, key: 1 }, { unique: true })
masterItemSchema.index({ type: 1, active: 1, displayOrder: 1, name: 1 })

const MasterItem = mongoose.model('MasterItem', masterItemSchema)
export default MasterItem
