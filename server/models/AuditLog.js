import mongoose from "mongoose";

// Append-only record of admin changes. Stores field NAMES that changed, never values
// of sensitive fields (passwords, tokens, notes, etc.).
const auditLogSchema = new mongoose.Schema({
    actor: { type: String, required: true, lowercase: true, trim: true },
    action: { type: String, required: true, trim: true, maxlength: 60 },
    entityType: { type: String, required: true, trim: true, maxlength: 60 },
    entityId: { type: String, trim: true, maxlength: 100 },
    entityLabel: { type: String, trim: true, maxlength: 200 },
    changes: { type: [String], default: undefined },
    meta: { type: mongoose.Schema.Types.Mixed },
}, { timestamps: { createdAt: true, updatedAt: false } })

auditLogSchema.index({ createdAt: -1 })
auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 })

const AuditLog = mongoose.model('AuditLog', auditLogSchema)
export default AuditLog
