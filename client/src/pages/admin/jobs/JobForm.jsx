import React, { useContext, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import RichTextEditor from './RichTextEditor'
import TagInput from './TagInput'
import { AppContext } from '../../../context/AppContext'
import { JOB_MASTER_FIELDS, diffForm, matchLegacyToMasters } from '../../../admin/jobOptions'
import { useAdminMasters } from '../../../admin/useMasters'
import { MasterMultiSelect, MasterSelect } from '../ui/MasterSelect'
import { validateJobForm } from './jobValidation'

const MASTER_TYPES = [...new Set(Object.values(JOB_MASTER_FIELDS))]

const inputClass = (err) => `w-full px-3 py-2 border-2 rounded bg-white disabled:bg-gray-100 disabled:text-gray-400 ${err ? 'border-red-400' : 'border-gray-300'}`

const Field = ({ id, label, required, error, hint, children, className = '' }) => (
    <div className={className}>
        <label htmlFor={id} className='block text-sm font-medium mb-1'>
            {label}{required && <span className='text-red-600 ml-0.5' aria-hidden='true'>*</span>}
        </label>
        {children}
        {hint && !error && <p className='text-xs text-gray-500 mt-1'>{hint}</p>}
        {error && <p id={`${id}-error`} className='text-xs text-red-600 mt-1' role='alert'>{error}</p>}
    </div>
)

const Group = ({ title, children }) => (
    <fieldset className='bg-white border border-gray-200 rounded-lg shadow-sm p-5'>
        <legend className='px-2 text-base font-semibold text-gray-800'>{title}</legend>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>{children}</div>
    </fieldset>
)

/**
 * Shared create/edit form.
 *  initial     form state (from EMPTY_JOB or jobToForm)
 *  mode        'create' | 'edit'
 *  onSubmit    async (form, changes) => { errors?: object } | void
 *  onCancel    () => void
 *  submitting  disables the form while a request is in flight
 *  serverErrors field errors returned by the API
 */
const JobForm = ({ initial, mode, onSubmit, onCancel, submitting, serverErrors, legacyLocation, legacy = {}, suggested, onDirtyChange }) => {
    const { backendUrl } = useContext(AppContext)
    const masters = useAdminMasters(backendUrl, MASTER_TYPES)
    const items = (field) => masters.data[JOB_MASTER_FIELDS[field]] || []
    const [form, setForm] = useState(initial)
    const [errors, setErrors] = useState({})

    // Preselect masters that match legacy text once options have loaded. Not saved
    // until the admin clicks Save (the fields show as changed and are hinted).
    const [matched, setMatched] = useState(null)
    if (matched === null && mode === 'edit' && !masters.loading && Object.keys(masters.data).length) {
        const found = matchLegacyToMasters(form, legacy, items, suggested)
        setMatched(found)
        if (Object.keys(found).length) setForm(f => ({ ...f, ...found }))
    }

    // Merge server-side field errors into the inline errors (input is preserved).
    // Adjusting state during render when the prop changes (no effect needed).
    const [seenServerErrors, setSeenServerErrors] = useState(serverErrors)
    if (serverErrors !== seenServerErrors) {
        setSeenServerErrors(serverErrors)
        if (serverErrors) setErrors(serverErrors)
    }

    const changes = useMemo(() => diffForm(initial, form), [initial, form])
    const dirty = Object.keys(changes).length > 0
    useEffect(() => { onDirtyChange?.(dirty) }, [dirty, onDirtyChange])

    // Warn before closing/reloading the tab with unsaved changes
    useEffect(() => {
        if (!dirty || submitting) return
        const handler = (e) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', handler)
        return () => window.removeEventListener('beforeunload', handler)
    }, [dirty, submitting])

    const set = (key) => (eOrValue) => {
        const value = eOrValue?.target ? (eOrValue.target.type === 'checkbox' ? eOrValue.target.checked : eOrValue.target.value) : eOrValue
        setForm(f => ({ ...f, [key]: value }))
        if (errors[key]) setErrors(prev => { const next = { ...prev }; delete next[key]; return next })
    }

    const submit = async (e) => {
        e.preventDefault()
        if (submitting) return
        const found = validateJobForm(form, { legacyLocation, isRemote: remote, isCreate: mode === 'create' })
        setErrors(found)
        if (Object.keys(found).length) {
            const first = document.getElementById(`job-${Object.keys(found)[0]}`)
            first?.focus?.()
            first?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
            return
        }
        if (mode === 'edit' && !dirty) return
        await onSubmit(form, changes)
    }

    const cancel = () => {
        if (dirty && !window.confirm('Discard unsaved changes?')) return
        onCancel()
    }

    const workplace = items('workplaceTypeId').find(w => String(w._id) === String(form.workplaceTypeId))
    const remote = /^remote$/i.test(workplace?.name || '')
    const undisclosed = form.salaryUndisclosed
    const err = (k) => errors[k]
    const aria = (k) => ({ id: `job-${k}`, 'aria-invalid': err(k) ? true : undefined, 'aria-describedby': err(k) ? `job-${k}-error` : undefined })

    // Master select / multi-select wired to a form field
    const pick = (field, { required, placeholder, multi } = {}) => {
        const common = {
            id: `job-${field}`, items: items(field), type: JOB_MASTER_FIELDS[field], value: form[field], onChange: set(field),
            className: inputClass(err(field)), invalid: !!err(field), describedBy: err(field) ? `job-${field}-error` : undefined,
            placeholder: placeholder || (required ? 'Select...' : 'Not specified'),
        }
        return multi ? <MasterMultiSelect {...common} /> : <MasterSelect {...common} />
    }
    const legacyHint = (field) => !legacy[field] ? undefined
        : matched?.[field] && JSON.stringify(form[field]) === JSON.stringify(matched[field]) ? `Matched from legacy text "${legacy[field]}" - save to link it`
        : `Current (not linked to master data): ${legacy[field]}`

    return (
        <form onSubmit={submit} noValidate className='flex flex-col gap-6'>
            {masters.error && (
                <div className='bg-amber-50 border border-amber-200 text-amber-800 rounded px-4 py-3 text-sm flex justify-between' role='alert'>
                    <span>{masters.error === 'auth' ? 'Your session expired. Please log in again.' : 'Could not load master data options.'}</span>
                    <button type='button' onClick={masters.refresh} className='underline'>Retry</button>
                </div>
            )}
            {masters.loading && !Object.keys(masters.data).length && <p className='text-sm text-gray-500'>Loading options...</p>}
            {Object.keys(errors).length > 0 && (
                <div className='bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm' role='alert'>
                    Please fix the highlighted fields.
                </div>
            )}
            <fieldset disabled={submitting} className='flex flex-col gap-6'>
                <Group title='Basic information'>
                    <Field id='job-title' label='Job title' required error={err('title')} className='md:col-span-2'>
                        <input {...aria('title')} value={form.title} onChange={set('title')} maxLength={200} className={inputClass(err('title'))} />
                    </Field>
                    <Field id='job-referenceId' label='Reference ID' error={err('referenceId')} hint={mode === 'create' ? 'Leave blank to auto-generate (SH-JOB-YYMMDD-XXXX)' : undefined}>
                        <input {...aria('referenceId')} value={form.referenceId} onChange={set('referenceId')} placeholder='SH-JOB-261013-AB12' className={`${inputClass(err('referenceId'))} font-mono uppercase`} />
                    </Field>
                    <Field id='job-categoryId' label='Category' required error={err('categoryId')} hint={legacyHint('categoryId')}>
                        {pick('categoryId', { required: true })}
                    </Field>
                    <Field id='job-clientId' label='Client / hiring organisation' error={err('clientId')} hint={legacyHint('clientId') || 'Shown publicly unless the client is confidential'}>
                        {pick('clientId')}
                    </Field>
                    <Field id='job-departmentId' label='Department' error={err('departmentId')} hint={legacyHint('departmentId')}>
                        {pick('departmentId')}
                    </Field>
                    <Field id='job-industryId' label='Industry' error={err('industryId')} hint={legacyHint('industryId')}>
                        {pick('industryId')}
                    </Field>
                    <Field id='job-employmentTypeId' label='Employment type' required error={err('employmentTypeId')} hint={legacyHint('employmentTypeId')}>
                        {pick('employmentTypeId', { required: true })}
                    </Field>
                    <Field id='job-experienceLevelId' label='Experience level' error={err('experienceLevelId')} hint={legacyHint('experienceLevelId')}>
                        {pick('experienceLevelId')}
                    </Field>
                    <div className='grid grid-cols-3 gap-3 md:col-span-2'>
                        <Field id='job-experienceMin' label='Min experience (yrs)' error={err('experienceMin')}>
                            <input {...aria('experienceMin')} type='number' min='0' max='60' value={form.experienceMin} onChange={set('experienceMin')} className={inputClass(err('experienceMin'))} />
                        </Field>
                        <Field id='job-experienceMax' label='Max experience (yrs)' error={err('experienceMax')}>
                            <input {...aria('experienceMax')} type='number' min='0' max='60' value={form.experienceMax} onChange={set('experienceMax')} className={inputClass(err('experienceMax'))} />
                        </Field>
                        <Field id='job-vacancies' label='Vacancies' error={err('vacancies')}>
                            <input {...aria('vacancies')} type='number' min='1' step='1' value={form.vacancies} onChange={set('vacancies')} className={inputClass(err('vacancies'))} />
                        </Field>
                    </div>
                    <Field id='job-description' label='Job description' required error={err('description')} className='md:col-span-2'>
                        <RichTextEditor id='job-description' value={initial.description} onChange={set('description')} invalid={!!err('description')} />
                    </Field>
                    <Field id='job-responsibilities' label='Responsibilities' error={err('responsibilities')} className='md:col-span-2'>
                        <RichTextEditor id='job-responsibilities' value={initial.responsibilities} onChange={set('responsibilities')} invalid={!!err('responsibilities')} />
                    </Field>
                    <Field id='job-qualifications' label='Qualifications' error={err('qualifications')} className='md:col-span-2'>
                        <RichTextEditor id='job-qualifications' value={initial.qualifications} onChange={set('qualifications')} invalid={!!err('qualifications')} />
                    </Field>
                    <Field id='job-skillIds' label='Skills' error={err('skillIds')} hint={legacyHint('skillIds')} className='md:col-span-2'>
                        {pick('skillIds', { multi: true, placeholder: 'Add a skill...' })}
                    </Field>
                </Group>

                <Group title='Location & compensation'>
                    <Field id='job-workplaceTypeId' label='Workplace type' required error={err('workplaceTypeId')} hint={legacyHint('workplaceTypeId')}>
                        {pick('workplaceTypeId', { required: true })}
                    </Field>
                    <Field id='job-locationIds' label='Locations' required={!remote && !legacyLocation} error={err('locationIds')} className='md:col-span-2'
                        hint={legacyLocation && form.locationIds.length && matched?.locationIds ? legacyHint('locationIds') : legacyLocation && !form.locationIds.length ? `Current location (not linked): ${legacyLocation}` : (remote ? 'Optional for remote jobs' : 'The first location is the primary one')}>
                        {pick('locationIds', { multi: true, placeholder: 'Add a location...' })}
                    </Field>
                    <div className='md:col-span-2 flex flex-wrap gap-6 text-sm'>
                        <label className='flex items-center gap-2'><input type='checkbox' checked={form.salaryUndisclosed} onChange={set('salaryUndisclosed')} className='scale-125' /> Salary not disclosed</label>
                        <label className='flex items-center gap-2'><input type='checkbox' checked={form.salaryNegotiable} onChange={set('salaryNegotiable')} className='scale-125' /> Negotiable</label>
                    </div>
                    <div className='grid grid-cols-2 gap-3'>
                        <Field id='job-salaryMin' label='Min salary' error={err('salaryMin')}>
                            <input {...aria('salaryMin')} type='number' min='0' value={form.salaryMin} onChange={set('salaryMin')} disabled={undisclosed} className={inputClass(err('salaryMin'))} />
                        </Field>
                        <Field id='job-salaryMax' label='Max salary' error={err('salaryMax')}>
                            <input {...aria('salaryMax')} type='number' min='0' value={form.salaryMax} onChange={set('salaryMax')} disabled={undisclosed} className={inputClass(err('salaryMax'))} />
                        </Field>
                    </div>
                    <div className='grid grid-cols-2 gap-3'>
                        <Field id='job-currencyId' label='Currency' error={err('currencyId')} hint={legacyHint('currencyId')}>
                            <MasterSelect id='job-currencyId' items={items('currencyId')} type='currencies' value={form.currencyId} onChange={set('currencyId')} disabled={undisclosed} placeholder='Default (INR)' className={inputClass(err('currencyId'))} />
                        </Field>
                        <Field id='job-salaryPeriodId' label='Period' error={err('salaryPeriodId')} hint={legacyHint('salaryPeriodId')}>
                            <MasterSelect id='job-salaryPeriodId' items={items('salaryPeriodId')} type='salary-periods' value={form.salaryPeriodId} onChange={set('salaryPeriodId')} disabled={undisclosed} className={inputClass(err('salaryPeriodId'))} />
                        </Field>
                    </div>
                </Group>

                <Group title='Recruitment'>
                    <Field id='job-recruiterOwner' label='Recruiter / owner' error={err('recruiterOwner')} hint='Internal; not shown publicly'>
                        <input {...aria('recruiterOwner')} value={form.recruiterOwner} onChange={set('recruiterOwner')} maxLength={150} className={inputClass(err('recruiterOwner'))} />
                    </Field>
                    <Field id='job-applicationDeadline' label='Application deadline' error={err('applicationDeadline')}>
                        <input {...aria('applicationDeadline')} type='date' value={form.applicationDeadline} onChange={set('applicationDeadline')} className={inputClass(err('applicationDeadline'))} />
                    </Field>
                    <Field id='job-requiredDocuments' label='Required documents' error={err('requiredDocuments')} className='md:col-span-2'>
                        <input {...aria('requiredDocuments')} value={form.requiredDocuments} onChange={set('requiredDocuments')} maxLength={2000} placeholder='e.g. Updated CV, degree certificates' className={inputClass(err('requiredDocuments'))} />
                    </Field>
                    <Field id='job-applicationInstructions' label='Application instructions' error={err('applicationInstructions')} className='md:col-span-2'>
                        <textarea {...aria('applicationInstructions')} rows={3} value={form.applicationInstructions} onChange={set('applicationInstructions')} maxLength={5000} className={inputClass(err('applicationInstructions'))} />
                    </Field>
                    <Field id='job-screeningQuestions' label='Screening questions' error={err('screeningQuestions')} hint='Press Enter to add each question' className='md:col-span-2'>
                        <TagInput id='job-screeningQuestions' value={form.screeningQuestions} onChange={set('screeningQuestions')} placeholder='e.g. What is your notice period?' maxItems={30} maxLength={500} allowComma={false} invalid={!!err('screeningQuestions')} />
                    </Field>
                </Group>

                <Group title='Publication'>
                    {mode === 'create' ? (
                        <Field id='job-status' label='Status' error={err('status')}>
                            <select {...aria('status')} value={form.status} onChange={set('status')} className={inputClass(err('status'))}>
                                <option value='draft'>Draft (not public)</option>
                                <option value='published'>Published</option>
                            </select>
                        </Field>
                    ) : (
                        <div className='text-sm text-gray-600'>
                            <p className='font-medium mb-1'>Status</p>
                            <p className='capitalize'>{initial.status}</p>
                            <p className='text-xs text-gray-500 mt-1'>Use Publish / Unpublish / Archive on the job page.</p>
                        </div>
                    )}
                    <div className='flex items-end'>
                        <label className='flex items-center gap-2 text-sm'><input type='checkbox' checked={form.featured} onChange={set('featured')} className='scale-125' /> Featured job</label>
                    </div>
                    <Field id='job-publishAt' label='Publish from' error={err('publishAt')} hint='Optional: hidden publicly until this date'>
                        <input {...aria('publishAt')} type='date' value={form.publishAt} onChange={set('publishAt')} className={inputClass(err('publishAt'))} />
                    </Field>
                    <Field id='job-expiresAt' label='Expires on' error={err('expiresAt')} hint='Optional: hidden publicly from this date'>
                        <input {...aria('expiresAt')} type='date' value={form.expiresAt} onChange={set('expiresAt')} className={inputClass(err('expiresAt'))} />
                    </Field>
                    <Field id='job-internalNotes' label='Internal notes' error={err('internalNotes')} hint='Visible to admins only' className='md:col-span-2'>
                        <textarea {...aria('internalNotes')} rows={3} value={form.internalNotes} onChange={set('internalNotes')} maxLength={10000} className={inputClass(err('internalNotes'))} />
                    </Field>
                </Group>
            </fieldset>

            <p className='text-xs text-gray-500'>Missing an option? Add it under <Link to='/admin/master' className='text-blue-600 hover:underline'>Master data</Link> (options are never created from this form).</p>
            <div className='flex flex-wrap gap-3 justify-end sticky bottom-0 bg-gray-50/95 py-3 border-t'>
                <button type='button' onClick={cancel} disabled={submitting} className='border border-gray-300 rounded px-5 py-2 text-sm hover:bg-gray-100 disabled:opacity-50'>Cancel</button>
                <button type='submit' disabled={submitting || (mode === 'edit' && !dirty)} className='bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-6 py-2 text-sm'>
                    {submitting ? 'Saving...' : mode === 'create' ? 'Create job' : 'Save changes'}
                </button>
            </div>
        </form>
    )
}

export default JobForm
