import mongoose from "mongoose";

// Recruiter / company accounts. New auth fields are optional so existing documents keep
// working unchanged: a missing emailVerified / status / tokenVersion is treated as a
// verified, active account with session version 0 (see utils/companyAuth.js).
const companySchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    image: { type: String, required: true },
    password: { type: String, required: true },
    phone: { type: String, unique: true, sparse: true },      // E.164, e.g. +919876543210
    phoneVerified: { type: Boolean },
    emailVerified: { type: Boolean },
    status: { type: String, enum: ['active', 'suspended'] },
    tokenVersion: { type: Number },
    passwordChangedAt: { type: Date },
})

const Company = mongoose.model('Company', companySchema)

export default Company
