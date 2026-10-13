import React, { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import useEnquiryForm from './forms/useEnquiryForm'
import { labelFor } from './forms/formSubmit'
import { TextInput, TextArea, SelectInput, PhoneInput, Honeypot, SuccessPanel, ErrorBanner, SubmitButton, Field, SendViaChoice, WhatsAppConfirmDialog, WhatsAppFileNote } from './forms/FormFields'
import { INDUSTRIES, EMAIL_RE, isValidPhone, validateDocFile } from './forms/formOptions'

const initialValues = {
    fullName: '', email: '', countryCode: '+91', phone: '', currentLocation: '', industry: '',
    discipline: '', totalExperience: '', currentRole: '', noticePeriod: '', linkedinUrl: '',
    message: '', resume: null, consent: false, website: '',
}

const validate = (v, channel = 'email') => {
    const e = {}
    if (v.fullName.trim().length < 2) e.fullName = 'Full name is required'
    if (!v.email.trim()) e.email = 'Email is required'
    else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address'
    if (!v.countryCode) e.countryCode = 'Please select a country code'
    if (!v.phone.trim()) e.phone = 'Phone number is required'
    else if (!isValidPhone(v.phone)) e.phone = 'Phone number must be 6-15 digits'
    if (v.currentLocation.trim().length < 2) e.currentLocation = 'Current location is required'
    if (!v.industry) e.industry = 'Please select an industry'
    if (v.discipline.trim().length < 2) e.discipline = 'Engineering discipline is required'
    const exp = Number(v.totalExperience)
    if (v.totalExperience === '' || !Number.isFinite(exp) || exp < 0 || exp > 60) e.totalExperience = 'Enter years of experience (0-60)'
    if (v.linkedinUrl.trim() && !/^https?:\/\/\S+$/i.test(v.linkedinUrl.trim())) e.linkedinUrl = 'Enter a valid URL starting with http(s)://'
    const fileErr = validateDocFile(v.resume, { required: channel === 'email' })
    if (fileErr) e.resume = fileErr
    if (!v.consent) e.consent = 'Please accept the consent to proceed'
    return e
}

const CandidateSubmissionForm = () => {
    const location = useLocation()
    const fileRef = useRef(null)
    const { values, errors, submitting, submitError, result, handleChange, setField, submit, reset, sendVia, setSendVia, waConfirm } = useEnquiryForm({
        initialValues,
        validate,
        referencePrefix: 'CAND',
        formTitle: 'Candidate Submission',
        subject: (v, ref) => `Candidate Resume: ${v.fullName.trim()} (${v.discipline.trim()}) [${ref}]`,
        successMessage: "Thanks! We've received your resume and will contact you when a matching opportunity comes up.",
        buildFields: (v, _ref, channel) => ({
            'Form': 'Candidate Submission',
            'Full Name': v.fullName.trim(),
            'email': v.email.trim(),
            'Phone': `${v.countryCode} ${v.phone.trim()}`,
            'Current Location': v.currentLocation.trim(),
            'Industry': labelFor(INDUSTRIES, v.industry),
            'Engineering Discipline': v.discipline.trim(),
            'Total Experience (years)': v.totalExperience,
            'Current Role': v.currentRole.trim(),
            'Notice Period': v.noticePeriod.trim(),
            'LinkedIn Profile': v.linkedinUrl.trim(),
            'Message': v.message.trim(),
            'Consent': v.consent ? 'Yes - consented to storage and contact' : 'No',
            'Source Page': location.pathname,
            // Resume -> sent as a FormSubmit attachment (multipart)
            'attachment': channel === 'whatsapp' ? null : v.resume,
            ...(channel === 'whatsapp' ? { 'Resume': 'please attach in WhatsApp chat' } : {}),
        }),
    })

    const onReset = () => { reset(); if (fileRef.current) fileRef.current.value = '' }

    return (
        <div className='bg-white border border-gray-200 rounded-xl shadow-sm p-6'>
            {result ? (
                <SuccessPanel title={result.channel === 'whatsapp' ? 'WhatsApp opened!' : 'Resume submitted!'} message={result.message} referenceId={result.referenceId} onReset={onReset} resetLabel='Submit another resume' />
            ) : (
                <form onSubmit={submit} noValidate className='relative flex flex-col gap-5'>
                    <Honeypot value={values.website} onChange={handleChange} />
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <TextInput label='Full Name' name='fullName' value={values.fullName} onChange={handleChange} error={errors.fullName} required maxLength={100} autoComplete='name' disabled={submitting} />
                        <TextInput label='Email' name='email' type='email' value={values.email} onChange={handleChange} error={errors.email} required maxLength={254} autoComplete='email' disabled={submitting} />
                        <div className='md:col-span-2'>
                            <PhoneInput codeValue={values.countryCode} phoneValue={values.phone} onChange={handleChange} error={errors.phone || errors.countryCode} required disabled={submitting} />
                        </div>
                        <TextInput label='Current Location' name='currentLocation' value={values.currentLocation} onChange={handleChange} error={errors.currentLocation} required maxLength={150} disabled={submitting} />
                        <SelectInput label='Industry' name='industry' value={values.industry} onChange={handleChange} error={errors.industry} required options={INDUSTRIES} disabled={submitting} />
                        <TextInput label='Engineering Discipline' name='discipline' value={values.discipline} onChange={handleChange} error={errors.discipline} required maxLength={100} placeholder='e.g. Mechanical, Electrical, Civil' disabled={submitting} />
                        <TextInput label='Total Experience (years)' name='totalExperience' type='number' min={0} max={60} value={values.totalExperience} onChange={handleChange} error={errors.totalExperience} required disabled={submitting} />
                        <TextInput label='Current Role' name='currentRole' value={values.currentRole} onChange={handleChange} error={errors.currentRole} maxLength={150} disabled={submitting} />
                        <TextInput label='Notice Period' name='noticePeriod' value={values.noticePeriod} onChange={handleChange} error={errors.noticePeriod} maxLength={50} placeholder='e.g. 30 days' disabled={submitting} />
                        <div className='md:col-span-2'>
                            <TextInput label='LinkedIn Profile' name='linkedinUrl' type='url' value={values.linkedinUrl} onChange={handleChange} error={errors.linkedinUrl} maxLength={300} placeholder='https://www.linkedin.com/in/...' disabled={submitting} />
                        </div>
                    </div>

                    <TextArea label='Message' name='message' value={values.message} onChange={handleChange} error={errors.message} maxLength={2000}
                        placeholder='Preferred roles, locations, or anything else we should know' disabled={submitting} />

                    <Field label='Resume' required={sendVia === 'email'} error={errors.resume} hint='PDF or DOCX, max 5 MB'>
                        <input ref={fileRef} type='file' accept='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                            disabled={submitting} onChange={(e) => setField('resume', e.target.files?.[0] || null)}
                            className='text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700' />
                    </Field>
                    {sendVia === 'whatsapp' && <WhatsAppFileNote fileLabel='resume' />}

                    <Field error={errors.consent}>
                        <label className='flex items-start gap-2 text-sm text-gray-700'>
                            <input type='checkbox' name='consent' checked={values.consent} onChange={handleChange} disabled={submitting} className='mt-1' />
                            <span>I consent to SureHire storing my details and resume and contacting me about relevant opportunities. <span className='text-red-500'>*</span></span>
                        </label>
                    </Field>

                    <SendViaChoice value={sendVia} onChange={setSendVia} disabled={submitting} />
                    <ErrorBanner message={submitError} onRetry={Object.values(errors).some(Boolean) ? null : submit} disabled={submitting} />
                    <div><SubmitButton submitting={submitting}>{sendVia === 'whatsapp' ? 'Continue on WhatsApp' : 'Submit Resume'}</SubmitButton></div>
                </form>
            )}
            <WhatsAppConfirmDialog {...waConfirm} />
        </div>
    )
}

export default CandidateSubmissionForm
