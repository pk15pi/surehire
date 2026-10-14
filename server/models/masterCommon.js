// Fields shared by every master-data collection
export const commonMasterFields = {
    name: { type: String, required: true, trim: true, maxlength: 150 },
    key: { type: String, required: true, trim: true, lowercase: true, maxlength: 400 },
    description: { type: String, trim: true, maxlength: 1000 },
    active: { type: Boolean, default: true, index: true },
    displayOrder: { type: Number, default: 0 },
    createdBy: { type: String },
    updatedBy: { type: String },
}
