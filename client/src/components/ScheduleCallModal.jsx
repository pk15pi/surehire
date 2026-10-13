import React, { useContext, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { X, PhoneCall } from 'lucide-react'
import { AppContext } from '../context/AppContext'
import useEnquiryForm from './forms/useEnquiryForm'
import { labelFor } from './forms/formSubmit'
import { TextInput, TextArea, SelectInput, PhoneInput, Honeypot, SuccessPanel, ErrorBanner, SubmitButton, Field, SendViaChoice, WhatsAppConfirmDialog } from './forms/FormFields'
import { I_AM_OPTIONS, PREFERRED_TIME_OPTIONS, EMAIL_RE, isValidPhone, getUserTimezone, getTimezones, todayISO } from './forms/formOptions'

const validate = (v) => {
    const e = {}
    if (!v.name.trim() || v.name.trim().length < 2) e.name = 'Please enter your name'
    if (!v.countryCode) e.countryCode = 'Please select a country code'
    if (!v.phone.trim()) e.phone = 'Phone number is required'
    else if (!isValidPhone(v.phone)) e.phone = 'Phone number must be 6-15 digits'
    if (!v.email.trim()) e.email = 'Email is required'
    else if (!EMAIL_RE.test(v.email.trim())) e.email = 'Please enter a valid email address'
    if (!v.iAm) e.iAm = 'Please select an option'
    if (!v.preferredTime) e.preferredTime = 'Please select a preferred time'
    if (v.preferredTime === 'specific') {
        if (!v.preferredDate) e.preferredDate = 'Please pick a date'
        else if (v.preferredDate < todayISO()) e.preferredDate = 'Date cannot be in the past'
        if (!v.preferredStartTime) e.preferredStartTime = 'Start time is required'
        if (!v.preferredEndTime) e.preferredEndTime = 'End time is required'
        if (v.preferredStartTime && v.preferredEndTime && v.preferredEndTime <= v.preferredStartTime) {
            e.preferredEndTime = 'End time must be after start time'
        }
        if (!v.timezone) e.timezone = 'Please select a timezone'
    }
    if (v.description.length > 2000) e.description = 'Description must be at most 2000 characters'
    return e
}

const ScheduleCallModal = () => {
    const { showScheduleCall, setShowScheduleCall } = useContext(AppContext)
    const location = useLocation()
    const timezones = useMemo(() => getTimezones().map(t => ({ value: t, label: t })), [])

    const initialValues = useMemo(() => ({
        name: '', countryCode: '+91', phone: '', email: '', iAm: '', preferredTime: '',
        preferredDate: '', preferredStartTime: '', preferredEndTime: '', timezone: getUserTimezone(),
        description: '', website: '',
    }), [])

    const form = useEnquiryForm({
        initialValues,
        validate,
        referencePrefix: 'CALL',
        formTitle: 'Schedule a Call',
        subject: (v, ref) => `Schedule a Call request from ${v.name.trim()} [${ref}]`,
        successMessage: "Thanks! We've received your call request and will contact you at your preferred time.",
        buildFields: (v) => {
            const fields = {
                'Form': 'Schedule a Call',
                'Name': v.name.trim(),
                'Phone': `${v.countryCode} ${v.phone.trim()}`,
                'email': v.email.trim(),
                'I Am a': labelFor(I_AM_OPTIONS, v.iAm),
                'Preferred Time': labelFor(PREFERRED_TIME_OPTIONS, v.preferredTime),
            }
            if (v.preferredTime === 'specific') {
                fields['Preferred Date'] = v.preferredDate
                fields['Preferred Slot'] = `${v.preferredStartTime} - ${v.preferredEndTime}`
                fields['Timezone'] = v.timezone
            }
            fields['Description'] = v.description.trim()
            fields['Source Page'] = location.pathname
            return fields
        },
    })
    const { values, errors, submitting, submitError, result, handleChange, setField, submit, reset, sendVia, setSendVia, waConfirm } = form

    // Optional preset: setShowScheduleCall({ iAm: 'employer' }) pre-selects "I Am a".
    // Plain setShowScheduleCall(true) (Navbar etc.) behaves exactly as before.
    const presetIAm = showScheduleCall && typeof showScheduleCall === 'object' ? showScheduleCall.iAm : ''
    useEffect(() => {
        if (presetIAm && !values.iAm && !result) setField('iAm', presetIAm)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [presetIAm])

    const close = () => {
        if (submitting) return
        setShowScheduleCall(false)
        if (result) reset()
    }

    // Close on Escape, lock background scroll
    useEffect(() => {
        if (!showScheduleCall) return
        const onKey = (e) => { if (e.key === 'Escape') close() }
        document.addEventListener('keydown', onKey)
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        return () => {
            document.removeEventListener('keydown', onKey)
            document.body.style.overflow = prevOverflow
        }
    })

    if (!showScheduleCall) return null

    return (
        <div className='fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto'
            onMouseDown={(e) => { if (e.target === e.currentTarget) close() }}>
            <div role='dialog' aria-modal='true' aria-labelledby='schedule-call-title'
                className='relative bg-white rounded-xl shadow-xl w-full max-w-xl my-8'>
                <div className='flex items-center justify-between border-b px-6 py-4'>
                    <h2 id='schedule-call-title' className='text-lg font-semibold flex items-center gap-2'>
                        <PhoneCall size={20} className='text-blue-600' /> Schedule a Call
                    </h2>
                    <button onClick={close} aria-label='Close' disabled={submitting} className='text-gray-500 hover:text-gray-800 disabled:opacity-50'>
                        <X size={22} />
                    </button>
                </div>

                {result ? (
                    <SuccessPanel
                        title={result.channel === 'whatsapp' ? 'WhatsApp opened!' : 'Call request received!'}
                        message={result.message}
                        referenceId={result.referenceId}
                        onReset={() => { reset(); setShowScheduleCall(false) }}
                        resetLabel='Close'
                    />
                ) : (
                    <form onSubmit={submit} noValidate className='relative px-6 py-5 flex flex-col gap-4'>
                        <p className='text-sm text-gray-600'>Tell us a little about you and when you'd like us to call. Fields marked <span className='text-red-500'>*</span> are required.</p>

                        <Honeypot value={values.website} onChange={handleChange} />

                        <TextInput label='Full Name' name='name' value={values.name} onChange={handleChange} error={errors.name} required maxLength={100} autoComplete='name' disabled={submitting} />

                        <PhoneInput codeValue={values.countryCode} phoneValue={values.phone} onChange={handleChange}
                            error={errors.phone || errors.countryCode} required disabled={submitting} />

                        <TextInput label='Email' name='email' type='email' value={values.email} onChange={handleChange} error={errors.email} required maxLength={254} autoComplete='email' disabled={submitting} />

                        <SelectInput label='I Am a' name='iAm' value={values.iAm} onChange={handleChange} error={errors.iAm} required options={I_AM_OPTIONS} disabled={submitting} />

                        <Field label='Preferred Time' required error={errors.preferredTime}>
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                                {PREFERRED_TIME_OPTIONS.map(o => (
                                    <label key={o.value} className={`flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer ${values.preferredTime === o.value ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                                        <input type='radio' name='preferredTime' value={o.value} checked={values.preferredTime === o.value}
                                            onChange={handleChange} disabled={submitting} />
                                        {o.label}
                                    </label>
                                ))}
                            </div>
                        </Field>

                        {values.preferredTime === 'specific' && (
                            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4 bg-gray-50 border rounded-md p-4'>
                                <TextInput label='Date' name='preferredDate' type='date' min={todayISO()} value={values.preferredDate} onChange={handleChange} error={errors.preferredDate} required disabled={submitting} />
                                <SelectInput label='Timezone' name='timezone' value={values.timezone} onChange={handleChange} error={errors.timezone} required options={timezones} disabled={submitting} />
                                <TextInput label='Start Time' name='preferredStartTime' type='time' value={values.preferredStartTime} onChange={handleChange} error={errors.preferredStartTime} required disabled={submitting} />
                                <TextInput label='End Time' name='preferredEndTime' type='time' value={values.preferredEndTime} onChange={handleChange} error={errors.preferredEndTime} required disabled={submitting} />
                            </div>
                        )}

                        <TextArea label='Description' name='description' value={values.description} onChange={handleChange} error={errors.description}
                            placeholder='Briefly describe your hiring need or what you would like to discuss' maxLength={2000} disabled={submitting} />

                        <SendViaChoice value={sendVia} onChange={setSendVia} disabled={submitting} />
                        <ErrorBanner message={submitError} onRetry={Object.values(errors).some(Boolean) ? null : submit} disabled={submitting} />

                        <div className='flex justify-end gap-3'>
                            <button type='button' onClick={close} disabled={submitting} className='px-5 py-2.5 rounded-md border border-gray-300 text-gray-700 disabled:opacity-50'>Cancel</button>
                            <SubmitButton submitting={submitting}>{sendVia === 'whatsapp' ? 'Continue on WhatsApp' : 'Request Call'}</SubmitButton>
                        </div>
                    </form>
                )}
                <WhatsAppConfirmDialog {...waConfirm} />
            </div>
        </div>
    )
}

export default ScheduleCallModal
