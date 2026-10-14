import { Webhook } from "svix";
import User from "../models/User.js";

const fullName = (data) => [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || 'User'
const primaryEmail = (data) => {
    const list = Array.isArray(data.email_addresses) ? data.email_addresses : []
    const primary = list.find(e => e.id === data.primary_email_address_id) || list[0]
    return primary?.email_address || ''
}

// API controller Function to manage clerk User with database.
// Mounted with express.raw() so the Svix signature is checked against the exact bytes Clerk sent.
export const clerkWebhooks = async (req, res) => {
    const secret = process.env.CLERK_WEBHOOK_SECRET
    if (!secret) {
        console.error('[webhooks] CLERK_WEBHOOK_SECRET is not set')
        return res.status(503).json({ success: false, message: 'Webhooks not configured' })
    }

    const payload = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body || {})

    let event
    try {
        event = new Webhook(secret).verify(payload, {
            "svix-id": req.headers["svix-id"],
            "svix-timestamp": req.headers["svix-timestamp"],
            "svix-signature": req.headers["svix-signature"]
        })
    } catch {
        return res.status(400).json({ success: false, message: 'Invalid webhook signature' })
    }

    try {
        const { data, type } = event || {}

        switch (type) {
            case 'user.created':
            case 'user.updated': {
                // Upsert so retried / out-of-order deliveries don't fail on duplicate _id
                const set = { email: primaryEmail(data), name: fullName(data), image: data.image_url }
                await User.findByIdAndUpdate(
                    data.id,
                    { $set: set, $setOnInsert: { resume: '' } },
                    { upsert: true, runValidators: true }
                )
                break;
            }

            case 'user.deleted': {
                if (data?.id) await User.findByIdAndDelete(data.id)
                break;
            }

            default:
                // Acknowledge events we don't handle so Clerk doesn't keep retrying
                break;
        }

        return res.json({ success: true })

    } catch (error) {
        console.error('[webhooks]', error?.message || error);
        // 500 lets Clerk retry the delivery later
        return res.status(500).json({ success: false, message: 'Webhooks Error' })
    }
}
