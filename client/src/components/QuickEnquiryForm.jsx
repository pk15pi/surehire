import React from 'react'
import { useLocation } from 'react-router-dom'
import useEnquiryForm from './forms/useEnquiryForm'
import { labelFor } from './forms/formSubmit'
import { TextInput, TextArea, SelectInput, PhoneInput, Honeypot, SuccessPanel, ErrorBanner, SubmitButton, SendViaChoice, WhatsAppConfirmDialog } from './forms/FormFields'
import { I_AM_OPTIONS, EMAIL_RE, isValidPhone } from './forms/formOptions'

const initialValues = { name: '', email: '', countryCode: '+91', phone: '', iAm: '', subject: '', message: '', website: '' }

const phoneOf = (v) => (v.phone.trim() ? `${v.countryCode} ${v.phone.trim()}` : '')

const validate = (v) => {
    const e = {}
    if (!v.name.trim() || v.name.trim().length < 2) e.name = 'Please enter your name'
    if (!v.email.trim()) e.email = 'Email is required'
    else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address'
    if (!v.countryCode) e.countryCode = 'Please select a country code'
    if (!v.phone.trim()) e.phone = 'Contact number is required'
    else if (!isValidPhone(v.phone)) e.phone = 'Phone number must be 6-15 digits'
    if (v.message.trim().length < 10) e.message = 'Message must be at least 10 characters'
    return e
}

const QuickEnquiryForm = ({ title = 'Quick Enquiry', subtitle = "Have a question? Send us a message and we'll get back to you." }) => {
    const location = useLocation()
    const { values, errors, submitting, submitError, result, handleChange, submit, reset, sendVia, setSendVia, waConfirm } = useEnquiryForm({
        initialValues,
        validate,
        referencePrefix: 'ENQ',
        formTitle: 'Quick Enquiry',
        subject: (v, ref) => `Quick Enquiry${v.subject.trim() ? ': ' + v.subject.trim() : ''} from ${v.name.trim()} [${ref}]`,
        successMessage: "Thanks for reaching out! We've received your enquiry and will get back to you shortly.",
        buildFields: (v) => ({
            'Form': 'Quick Enquiry',
            'Name': v.name.trim(),
            'email': v.email.trim(),
            'Phone': phoneOf(v),
            'I Am a': v.iAm ? labelFor(I_AM_OPTIONS, v.iAm) : '',
            'Subject': v.subject.trim(),
            'Message': v.message.trim(),
            'Source Page': location.pathname,
        }),
    })

    return (
        <div className='bg-white border border-gray-200 rounded-xl shadow-sm p-6'>
            {result ? (
                <SuccessPanel title={result.channel === 'whatsapp' ? 'WhatsApp opened!' : undefined} message={result.message} referenceId={result.referenceId} onReset={reset} resetLabel='Send another enquiry' />
            ) : (
                <form onSubmit={submit} noValidate className='relative flex flex-col gap-4'>
                    <div>
                        <h3 className='text-xl font-semibold'>{title}</h3>
                        {subtitle && <p className='text-sm text-gray-600 mt-1'>{subtitle}</p>}
                    </div>
                    <Honeypot value={values.website} onChange={handleChange} />
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <TextInput label='Name' name='name' value={values.name} onChange={handleChange} error={errors.name} required maxLength={100} autoComplete='name' disabled={submitting} />
                        <TextInput label='Email' name='email' type='email' value={values.email} onChange={handleChange} error={errors.email} required maxLength={254} autoComplete='email' disabled={submitting} />
                        <PhoneInput label='Contact Number' required codeValue={values.countryCode} phoneValue={values.phone} onChange={handleChange} error={errors.phone || errors.countryCode} disabled={submitting} />
                        <SelectInput label='I Am a' name='iAm' value={values.iAm} onChange={handleChange} error={errors.iAm} options={I_AM_OPTIONS} placeholder='Select (optional)' disabled={submitting} />
                    </div>
                    <TextInput label='Subject' name='subject' value={values.subject} onChange={handleChange} error={errors.subject} maxLength={150} disabled={submitting} />
                    <TextArea label='Message' name='message' value={values.message} onChange={handleChange} error={errors.message} required maxLength={2000} disabled={submitting} />
                    <SendViaChoice value={sendVia} onChange={setSendVia} disabled={submitting} />
                    <ErrorBanner message={submitError} onRetry={Object.values(errors).some(Boolean) ? null : submit} disabled={submitting} />
                    <div><SubmitButton submitting={submitting}>{sendVia === 'whatsapp' ? 'Continue on WhatsApp' : 'Send Enquiry'}</SubmitButton></div>
                </form>
            )}
            <WhatsAppConfirmDialog {...waConfirm} />
        </div>
    )
}

export default QuickEnquiryForm
