import mongoose from 'mongoose'

// Single-use opaque tokens (email verification links, password reset). Stored as keyed hashes.
const authTokenSchema = new mongoose.Schema({
    type: { type: String, enum: ['email_verify', 'password_reset'], required: true },
    tokenHash: { type: String, required: true, unique: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Company', required: true },
    usedAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
}, { timestamps: true })

authTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 86400 })

export default mongoose.models.AuthToken || mongoose.model('AuthToken', authTokenSchema)
