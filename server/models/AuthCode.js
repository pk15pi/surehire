import mongoose from 'mongoose'

// One-time codes. Only keyed hashes are stored (never the code or the raw destination).
const authCodeSchema = new mongoose.Schema({
    purpose: { type: String, enum: ['signup', 'login', 'reset', 'phone_verify'], required: true },
    channel: { type: String, enum: ['email', 'sms'], required: true },
    destKey: { type: String, required: true },          // HMAC of normalized destination
    codeHash: { type: String, required: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', default: null },
    ipKey: { type: String },
    attempts: { type: Number, default: 0 },
    consumedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
}, { timestamps: true })

authCodeSchema.index({ purpose: 1, destKey: 1, createdAt: -1 })
authCodeSchema.index({ ipKey: 1, createdAt: -1 })
// Keep rows for 24h (send-rate accounting), then Mongo removes them
authCodeSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 })

export default mongoose.models.AuthCode || mongoose.model('AuthCode', authCodeSchema)
