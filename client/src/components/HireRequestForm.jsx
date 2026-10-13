import React, { useRef } from 'react'
import { useLocation } from 'react-router-dom'
import useEnquiryForm from './forms/useEnquiryForm'
import { labelFor } from './forms/formSubmit'
import { TextInput, TextArea, SelectInput, PhoneInput, Honeypot, SuccessPanel, ErrorBanner, SubmitButton, Field, SendViaChoice, WhatsAppConfirmDialog, WhatsAppFileNote } from './forms/FormFields'
import { INDUSTRIES, EMPLOYMENT_TYPES, URGENCY_OPTIONS, EMAIL_RE, isValidPhone, validateDocFile } from './forms/formOptions'

const initialValues = {
    companyName: '', contactName: '', designation: '', email: '', countryCode: '+91', phone: '',
    roleTitle: '', industry: '', numberOfPositions: '1', location: '', experience: '',
    employmentType: '', urgency: '', description: '', jdFile: null, website: '',
}

const validate = (v) => {
    const e = {}
    if (v.companyName.trim().length < 2) e.companyName = 'Company name is required'
    if (v.contactName.trim().length < 2) e.contactName = 'Contact name is required'
    if (!v.email.trim()) e.email = 'Email is required'
    else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address'
    if (!v.countryCode) e.countryCode = 'Please select a country code'
    if (!v.phone.trim()) e.phone = 'Phone number is required'
    else if (!isValidPhone(v.phone)) e.phone = 'Phone number must be 6-15 digits'
    if (v.roleTitle.trim().length < 2) e.roleTitle = 'Role title is required'
    if (!v.industry) e.industry = 'Please select an industry'
    const n = Number(v.numberOfPositions)
    if (!Number.isInteger(n) || n < 1 || n > 1000) e.numberOfPositions = 'Enter a number between 1 and 1000'
    if (v.location.trim().length < 2) e.location = 'Location is required'
    if (!v.employmentType) e.employmentType = 'Please select an employment type'
    const fileErr = validateDocFile(v.jdFile)
    if (fileErr) e.jdFile = fileErr
    return e
}

const HireRequestForm = () => {
    const location = useLocation()
    const fileRef = useRef(null)
    const { values, errors, submitting, submitError, result, handleChange, setField, submit, reset, sendVia, setSendVia, waConfirm } = useEnquiryForm({
        initialValues,
        validate,
        referencePrefix: 'HIRE',
        formTitle: 'Hire Request',
        subject: (v, ref) => `Hiring Request: ${v.roleTitle.trim()} at ${v.companyName.trim()} [${ref}]`,
        successMessage: "Thanks! We've received your hiring requirement. Our team will reach out shortly.",
        buildFields: (v, _ref, channel) => ({
            'Form': 'Hire Request',
            'Company Name': v.companyName.trim(),
            'Contact Person': v.contactName.trim(),
            'Designation': v.designation.trim(),
            'email': v.email.trim(),
            'Phone': `${v.countryCode} ${v.phone.trim()}`,
            'Role / Position Title': v.roleTitle.trim(),
            'Industry': labelFor(INDUSTRIES, v.industry),
            'Number of Positions': v.numberOfPositions,
            'Job Location': v.location.trim(),
            'Experience Required': v.experience.trim(),
            'Employment Type': labelFor(EMPLOYMENT_TYPES, v.employmentType),
            'Urgency': v.urgency ? labelFor(URGENCY_OPTIONS, v.urgency) : '',
            'Additional Details': v.description.trim(),
            'Source Page': location.pathname,
            // Optional JD file -> sent as a FormSubmit attachment (multipart)
            'attachment': channel === 'whatsapp' ? null : (v.jdFile || null),
            ...(channel === 'whatsapp' && v.jdFile ? { 'Job Description': 'please attach in WhatsApp chat' } : {}),
        }),
    })

    const onReset = () => { reset(); if (fileRef.current) fileRef.current.value = '' }

    return (
        <div className='bg-white border border-gray-200 rounded-xl shadow-sm p-6'>
            {result ? (
                <SuccessPanel title={result.channel === 'whatsapp' ? 'WhatsApp opened!' : 'Hiring request received!'} message={result.message} referenceId={result.referenceId} onReset={onReset} resetLabel='Submit another requirement' />
            ) : (
                <form onSubmit={submit} noValidate className='relative flex flex-col gap-5'>
                    <Honeypot value={values.website} onChange={handleChange} />

                    <h3 className='font-semibold text-gray-800 border-b pb-2'>Company & Contact</h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <TextInput label='Company Name' name='companyName' value={values.companyName} onChange={handleChange} error={errors.companyName} required maxLength={150} disabled={submitting} />
                        <TextInput label='Contact Person' name='contactName' value={values.contactName} onChange={handleChange} error={errors.contactName} required maxLength={100} disabled={submitting} />
                        <TextInput label='Designation' name='designation' value={values.designation} onChange={handleChange} error={errors.designation} maxLength={100} disabled={submitting} />
                        <TextInput label='Work Email' name='email' type='email' value={values.email} onChange={handleChange} error={errors.email} required maxLength={254} disabled={submitting} />
                        <div className='md:col-span-2'>
                            <PhoneInput codeValue={values.countryCode} phoneValue={values.phone} onChange={handleChange} error={errors.phone || errors.countryCode} required disabled={submitting} />
                        </div>
                    </div>

                    <h3 className='font-semibold text-gray-800 border-b pb-2'>Requirement</h3>
                    <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <TextInput label='Role / Position Title' name='roleTitle' value={values.roleTitle} onChange={handleChange} error={errors.roleTitle} required maxLength={150} placeholder='e.g. Senior Piping Engineer' disabled={submitting} />
                        <SelectInput label='Industry' name='industry' value={values.industry} onChange={handleChange} error={errors.industry} required options={INDUSTRIES} disabled={submitting} />
                        <TextInput label='Number of Positions' name='numberOfPositions' type='number' min={1} max={1000} value={values.numberOfPositions} onChange={handleChange} error={errors.numberOfPositions} required disabled={submitting} />
                        <TextInput label='Job Location' name='location' value={values.location} onChange={handleChange} error={errors.location} required maxLength={150} placeholder='City, Country / Site' disabled={submitting} />
                        <TextInput label='Experience Required' name='experience' value={values.experience} onChange={handleChange} error={errors.experience} maxLength={50} placeholder='e.g. 5-8 years' disabled={submitting} />
                        <SelectInput label='Employment Type' name='employmentType' value={values.employmentType} onChange={handleChange} error={errors.employmentType} required options={EMPLOYMENT_TYPES} disabled={submitting} />
                        <SelectInput label='Urgency' name='urgency' value={values.urgency} onChange={handleChange} error={errors.urgency} options={URGENCY_OPTIONS} placeholder='Select (optional)' disabled={submitting} />
                    </div>

                    <TextArea label='Additional Details' name='description' value={values.description} onChange={handleChange} error={errors.description} maxLength={5000} rows={5}
                        placeholder='Key skills, certifications, project details, compensation range, etc.' disabled={submitting} />

                    <Field label='Job Description (optional)' error={errors.jdFile} hint='PDF or DOCX, max 5 MB'>
                        <input ref={fileRef} type='file' accept='.pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                            disabled={submitting} onChange={(e) => setField('jdFile', e.target.files?.[0] || null)}
                            className='text-sm file:mr-3 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700' />
                    </Field>
                    {sendVia === 'whatsapp' && <WhatsAppFileNote fileLabel='job description file' />}

                    <SendViaChoice value={sendVia} onChange={setSendVia} disabled={submitting} />
                    <ErrorBanner message={submitError} onRetry={Object.values(errors).some(Boolean) ? null : submit} disabled={submitting} />
                    <div><SubmitButton submitting={submitting}>{sendVia === 'whatsapp' ? 'Continue on WhatsApp' : 'Submit Requirement'}</SubmitButton></div>
                </form>
            )}
            <WhatsAppConfirmDialog {...waConfirm} />
        </div>
    )
}

export default HireRequestForm
