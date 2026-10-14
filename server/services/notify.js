// Modular notification service: email (SMTP via nodemailer) + SMS provider adapters.
// Driven entirely by env vars. Missing credentials => NotificationError (never fake success).
// The "memory" transport (captures messages in-process) is only usable when NODE_ENV=test.
import nodemailer from 'nodemailer'
import { isProduction, isTest } from '../config/authConfig.js'

export class NotificationError extends Error {
    constructor(message, code = 'DELIVERY_FAILED') { super(message); this.code = code }
}

// ---- test outbox (NODE_ENV=test only) --------------------------------------
export const testOutbox = []
const memoryAllowed = () => isTest() && !isProduction()

// ---- email -----------------------------------------------------------------
const emailMode = () => (process.env.EMAIL_TRANSPORT || 'smtp').toLowerCase()

export const emailConfigured = () => {
    if (emailMode() === 'memory') return memoryAllowed()
    return Boolean(process.env.EMAIL_HOST && process.env.EMAIL_HOST_USER && process.env.EMAIL_HOST_PASSWORD && process.env.DEFAULT_FROM_EMAIL)
}

let smtp = null, smtpKey = ''
const smtpTransport = () => {
    const key = [process.env.EMAIL_HOST, process.env.EMAIL_PORT, process.env.EMAIL_HOST_USER].join('|')
    if (!smtp || key !== smtpKey) {
        const port = parseInt(process.env.EMAIL_PORT || '587', 10)
        smtp = nodemailer.createTransport({
            host: process.env.EMAIL_HOST, port,
            secure: process.env.EMAIL_USE_SSL ? process.env.EMAIL_USE_SSL === 'true' : port === 465,
            auth: { user: process.env.EMAIL_HOST_USER, pass: process.env.EMAIL_HOST_PASSWORD },
        })
        smtpKey = key
    }
    return smtp
}

export const sendEmail = async ({ to, subject, text, html }) => {
    if (!emailConfigured()) throw new NotificationError('Email delivery is not configured', 'NOT_CONFIGURED')
    if (emailMode() === 'memory') { testOutbox.push({ channel: 'email', to, subject, text }); return { ok: true } }
    try {
        await smtpTransport().sendMail({ from: process.env.DEFAULT_FROM_EMAIL, to, subject, text, html })
        return { ok: true }
    } catch (err) {
        // Log the failure class only (no recipient, no body, no codes)
        console.error('[notify] email send failed:', err?.code || 'error')
        throw new NotificationError('Email could not be sent')
    }
}

// ---- SMS adapters ----------------------------------------------------------
const smsProvider = () => (process.env.SMS_PROVIDER || '').toLowerCase()

const adapters = {
    // MSG91 Flow API (DLT-approved template must contain an ##otp## style variable named "otp")
    msg91: {
        configured: () => Boolean(process.env.SMS_API_KEY && process.env.SMS_SENDER_ID && process.env.MSG91_TEMPLATE_ID),
        send: async ({ to, code }) => {
            const r = await fetch('https://control.msg91.com/api/v5/flow', {
                method: 'POST',
                headers: { authkey: process.env.SMS_API_KEY, 'content-type': 'application/json' },
                body: JSON.stringify({ template_id: process.env.MSG91_TEMPLATE_ID, sender: process.env.SMS_SENDER_ID, short_url: '0', recipients: [{ mobiles: to.replace(/^\+/, ''), otp: code }] }),
            })
            if (!r.ok) throw new NotificationError('SMS could not be sent')
        },
    },
    // Twilio Messages API. SMS_API_KEY = "ACCOUNT_SID:AUTH_TOKEN", SMS_SENDER_ID = from number / messaging service SID
    twilio: {
        configured: () => Boolean(process.env.SMS_API_KEY?.includes(':') && process.env.SMS_SENDER_ID),
        send: async ({ to, text }) => {
            const [sid, tok] = process.env.SMS_API_KEY.split(':')
            const from = process.env.SMS_SENDER_ID
            const body = new URLSearchParams({ To: to, Body: text, ...(from.startsWith('MG') ? { MessagingServiceSid: from } : { From: from }) })
            const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
                method: 'POST', body,
                headers: { authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64') },
            })
            if (!r.ok) throw new NotificationError('SMS could not be sent')
        },
    },
    memory: {
        configured: memoryAllowed,
        send: async ({ to, text, code }) => { testOutbox.push({ channel: 'sms', to, text, code }) },
    },
}

export const smsConfigured = () => Boolean(adapters[smsProvider()]?.configured())

export const sendSms = async ({ to, text, code }) => {
    const adapter = adapters[smsProvider()]
    if (!adapter || !adapter.configured()) throw new NotificationError('SMS delivery is not configured', 'NOT_CONFIGURED')
    try { await adapter.send({ to, text, code }); return { ok: true } }
    catch (err) {
        console.error('[notify] sms send failed:', err?.code || 'error')
        throw err instanceof NotificationError ? err : new NotificationError('SMS could not be sent')
    }
}

export const channelConfigured = (channel) => channel === 'email' ? emailConfigured() : channel === 'sms' ? smsConfigured() : false

// ---- message templates -----------------------------------------------------
const PURPOSE_TEXT = { signup: 'verify your mobile number', login: 'sign in', reset: 'reset your password', phone_verify: 'verify your mobile number' }

export const sendOtp = async ({ channel, to, code, purpose, minutes }) => {
    const text = `${code} is your SureHire code to ${PURPOSE_TEXT[purpose]}. It expires in ${minutes} minutes. Do not share it with anyone.`
    if (channel === 'sms') return sendSms({ to, text, code })
    return sendEmail({ to, subject: `Your SureHire code: ${code}`, text: `${text}\n\nIf you did not request this, you can ignore this email.` })
}
