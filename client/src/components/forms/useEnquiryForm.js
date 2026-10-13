import { useRef, useState } from 'react'
import { sendToFormSubmit, generateReferenceId, FormSubmitError } from './formSubmit'
import { buildWhatsAppMessage, isMobileDevice } from './whatsapp'
import { WHATSAPP_NUMBER } from '../assistant/config'

/**
 * Shared state + submit logic for public enquiry forms, delivered via FormSubmit.co (no backend).
 * - validate(values) -> { field: message }
 * - buildFields(values, referenceId) -> { 'Readable Label': value | File }
 * - referencePrefix: e.g. 'CALL' -> CALL-20261011-AB12CD
 * - subject: string or (values, referenceId) => string
 * - successMessage: text shown after a successful submission
 * - honeypotField: name of the hidden honeypot input in values (sent as FormSubmit _honey)
 * - formTitle: heading used in the WhatsApp message
 * validate / buildFields also receive the channel ('email' | 'whatsapp') as an extra argument.
 * WhatsApp: opens wa.me with a prefilled message (desktop users confirm first via waConfirm).
 */
const useEnquiryForm = ({
    initialValues, validate, buildFields, referencePrefix = 'ENQ', subject = 'New enquiry',
    successMessage = "Thanks! We've received your submission and will get back to you shortly.",
    honeypotField = 'website', formTitle = 'Enquiry',
}) => {
    const [sendVia, setSendViaState] = useState('email') // 'email' | 'whatsapp'
    const [waPending, setWaPending] = useState(null) // { url, referenceId } awaiting desktop confirmation
    const [values, setValues] = useState(initialValues)
    const [errors, setErrors] = useState({})
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [result, setResult] = useState(null) // { referenceId, message }
    const inFlight = useRef(false)

    const handleChange = (e) => {
        const { name, type, checked, value } = e.target
        setValues(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    }

    const setField = (name, value) => {
        setValues(prev => ({ ...prev, [name]: value }))
        if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    }

    const setSendVia = (channel) => {
        setSendViaState(channel === 'whatsapp' ? 'whatsapp' : 'email')
        setErrors({})
        setSubmitError('')
    }

    const waSuccess = (referenceId) => ({
        referenceId, channel: 'whatsapp',
        message: 'WhatsApp has been opened with your details. Please press Send in WhatsApp to complete your submission.',
    })

    const openWhatsApp = (url, referenceId) => {
        const win = window.open(url, '_blank', 'noopener,noreferrer')
        if (win) win.opener = null
        setResult(waSuccess(referenceId))
    }

    const submitWhatsApp = () => {
        inFlight.current = true
        setSubmitting(true)
        setSubmitError('')
        const referenceId = generateReferenceId(referencePrefix)
        try {
            if (String(values[honeypotField] || '')) { setResult(waSuccess(referenceId)); return }
            const fields = buildFields(values, referenceId, 'whatsapp')
            const { url } = buildWhatsAppMessage({ title: formTitle, referenceId, fields, number: WHATSAPP_NUMBER })
            if (isMobileDevice()) openWhatsApp(url, referenceId)
            else { setWaPending({ url, referenceId }); return } // keep guard until the user answers
        } catch {
            setSubmitError('Could not open WhatsApp. Please try again or choose Email.')
        }
        inFlight.current = false
        setSubmitting(false)
    }

    const finishPending = (proceed) => {
        const pending = waPending
        setWaPending(null)
        if (proceed && pending) openWhatsApp(pending.url, pending.referenceId)
        inFlight.current = false
        setSubmitting(false)
    }

    const waConfirm = {
        open: !!waPending,
        onContinue: () => finishPending(true),
        onCancel: () => finishPending(false),
    }

    const submit = async (e) => {
        if (e?.preventDefault) e.preventDefault()
        if (inFlight.current) return // prevent double submit

        const clientErrors = validate(values, sendVia)
        const hasErrors = Object.values(clientErrors).some(Boolean)
        setErrors(clientErrors)
        if (hasErrors) {
            setSubmitError('Please fix the highlighted fields.')
            return
        }

        if (sendVia === 'whatsapp') { submitWhatsApp(); return }

        inFlight.current = true
        setSubmitting(true)
        setSubmitError('')
        const referenceId = generateReferenceId(referencePrefix)
        try {
            const honey = String(values[honeypotField] || '')
            if (honey) {
                // Bot filled the hidden field: pretend success, send nothing.
                setResult({ referenceId, message: successMessage })
                return
            }
            const fields = { 'Reference ID': referenceId, ...buildFields(values, referenceId, 'email') }
            const subj = typeof subject === 'function' ? subject(values, referenceId) : `${subject} [${referenceId}]`
            await sendToFormSubmit(fields, { subject: subj, replyTo: values.email?.trim(), honey })
            setResult({ referenceId, message: successMessage, channel: 'email' })
        } catch (error) {
            setSubmitError(error instanceof FormSubmitError ? error.message : 'Something went wrong. Please try again.')
        } finally {
            inFlight.current = false
            setSubmitting(false)
        }
    }

    const reset = () => {
        setValues(initialValues)
        setErrors({})
        setSubmitError('')
        setResult(null)
        setSendViaState('email')
        setWaPending(null)
    }

    return { values, errors, submitting, submitError, result, handleChange, setField, submit, reset, sendVia, setSendVia, waConfirm }
}

export default useEnquiryForm