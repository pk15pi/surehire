import mongoose from "mongoose";

// Recruiter / company accounts. New auth fields are optional so existing documents keep
// working unchanged: a missing emailVerified / status / tokenVersion is treated as a
// verified, active account with session version 0 (see utils/companyAuth.js).
const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    // Admin-created accounts may have no logo yet
    image: { type: String, required: function () { return !this.createdByAdmin }, default: undefined },
    password: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },      // E.164, e.g. +919876543210
    phoneVerified: { type: Boolean },
    emailVerified: { type: Boolean },
    status: { type: String, enum: ['active', 'suspended'] },
    tokenVersion: { type: Number },
    passwordChangedAt: { type: Date },
    pendingPhone: { type: String },                           // number awaiting OTP verification
    createdByAdmin: { type: Boolean },
})

const Company = mongoose.model('Company', companySchema)

export default Company
