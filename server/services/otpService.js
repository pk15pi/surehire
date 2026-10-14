// OTP lifecycle: issue (cooldown + hourly cap per destination), verify (attempt limit,
// constant-time compare, atomic single use). Codes are bound to purpose + destination.
import crypto from 'crypto'
import AuthCode from '../models/AuthCode.js'
import { authConfig } from '../config/authConfig.js'
import { generateOtp, keyedHash, safeEqualHex } from '../utils/authCrypto.js'
import { sendOtp } from './notify.js'

export const destKeyOf = (channel, destination) => keyedHash(`${channel}:${destination}`, 'dest')
const codeHashOf = (purpose, destKey, code) => keyedHash(`${purpose}:${destKey}:${code}`, 'otp')

// deliver=false records a decoy (unknown account) so cooldown/limits look identical
// bind (optional) ties the code to an extra subject, e.g. a company id for phone_verify
const keyFor = (channel, destination, bind) => destKeyOf(channel, bind ? `${bind}|${destination}` : destination)

export const issueOtp = async ({ purpose, channel, destination, companyId = null, deliver, ip, bind }) => {
    const cfg = authConfig()
    const destKey = keyFor(channel, destination, bind)
    const now = Date.now()

    const latest = await AuthCode.findOne({ purpose, destKey }).sort({ createdAt: -1 }).select('createdAt').lean()
    if (latest) {
        const wait = cfg.otpResendCooldownSeconds - Math.floor((now - new Date(latest.createdAt).getTime()) / 1000)
        if (wait > 0) return { status: 'cooldown', retryAfter: wait }
    }
    const sentLastHour = await AuthCode.countDocuments({ purpose, destKey, createdAt: { $gt: new Date(now - 3600_000) } })
    if (sentLastHour >= cfg.otpMaxSendsPerHour) return { status: 'limited', retryAfter: 3600 }

    // Only the newest code for a destination+purpose is ever valid
    await AuthCode.updateMany({ purpose, destKey, consumedAt: null }, { $set: { consumedAt: new Date(now) } })

    const code = deliver ? generateOtp() : crypto.randomBytes(16).toString('hex')
    const doc = await AuthCode.create({
        purpose, channel, destKey, companyId,
        codeHash: codeHashOf(purpose, destKey, code),
        ipKey: ip ? keyedHash(ip, 'ip') : undefined,
        expiresAt: new Date(now + cfg.otpExpirySeconds * 1000),
    })
    if (deliver) {
        try {
            await sendOtp({ channel, to: destination, code, purpose, minutes: Math.round(cfg.otpExpirySeconds / 60) })
        } catch (err) {
            await AuthCode.deleteOne({ _id: doc._id })
            throw err
        }
    }
    return { status: 'sent', cooldown: cfg.otpResendCooldownSeconds }
}

export const verifyOtp = async ({ purpose, channel, destination, code, bind }) => {
    if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return { ok: false }
    const cfg = authConfig()
    const destKey = keyFor(channel, destination, bind)
    const now = new Date()
    // Count the attempt first (atomically) so parallel guesses can't exceed the limit
    const doc = await AuthCode.findOneAndUpdate(
        { purpose, destKey, consumedAt: null, expiresAt: { $gt: now }, attempts: { $lt: cfg.otpMaxAttempts } },
        { $inc: { attempts: 1 } },
        { sort: { createdAt: -1 }, returnDocument: 'after' },
    )
    if (!doc) return { ok: false }
    if (!safeEqualHex(doc.codeHash, codeHashOf(purpose, destKey, code))) return { ok: false }
    const consumed = await AuthCode.findOneAndUpdate({ _id: doc._id, consumedAt: null }, { $set: { consumedAt: now } })
    if (!consumed) return { ok: false }
    return { ok: true, companyId: doc.companyId }
}
