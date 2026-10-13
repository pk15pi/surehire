import React, { useCallback, useContext, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ArrowLeft } from 'lucide-react'
import { AppContext } from '../../../context/AppContext'
import { apiErrorMessage, createAdminJob, isAuthError, updateAdminJob } from '../../../admin/adminApi'
import { EMPTY_JOB, formToPayload, jobToForm } from '../../../admin/jobOptions'
import usePageMeta from '../../../hooks/usePageMeta'
import useAdminAuthError from './useAdminAuthError'
import useAdminJob from './useAdminJob'
import JobForm from './JobForm'
import { JobError, JobLoading, JobNotFound } from './JobPageStates'

// Shared submit handling: maps server field errors back onto the form
const useSubmit = () => {
    const [submitting, setSubmitting] = useState(false)
    const [serverErrors, setServerErrors] = useState(null)
    const onAuthError = useAdminAuthError()

    const run = useCallback(async (request, onSuccess) => {
        setSubmitting(true)
        setServerErrors(null)
        try {
            const { data } = await request()
            onSuccess(data)
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            const fieldErrors = err?.response?.data?.errors
            if (fieldErrors && typeof fieldErrors === 'object') setServerErrors({ ...fieldErrors })
            toast.error(apiErrorMessage(err, 'Could not save the job'))
        } finally {
            setSubmitting(false)
        }
    }, [onAuthError])

    return { submitting, serverErrors, run }
}

const Header = ({ title, backTo }) => (
    <div className='flex items-center gap-3 mb-4'>
        <Link to={backTo} className='text-gray-500 hover:text-blue-600' aria-label='Back'><ArrowLeft size={18} /></Link>
        <h1 className='text-xl font-semibold'>{title}</h1>
    </div>
)

export const AdminJobCreate = () => {
    usePageMeta('Admin - New job', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()
    const { submitting, serverErrors, run } = useSubmit()
    const initial = useMemo(() => ({ ...EMPTY_JOB }), [])

    const onSubmit = (form) => run(
        () => createAdminJob(backendUrl, formToPayload(form)),
        (data) => { toast.success('Job created'); navigate(`/admin/jobs/${data.job._id}`, { replace: true }) },
    )

    return (
        <div className='max-w-5xl'>
            <Header title='New job' backTo='/admin/jobs' />
            <JobForm mode='create' initial={initial} onSubmit={onSubmit} onCancel={() => navigate('/admin/jobs')} submitting={submitting} serverErrors={serverErrors} />
        </div>
    )
}

export const AdminJobEdit = () => {
    const { id } = useParams()
    usePageMeta('Admin - Edit job', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()
    const { job, state, error, reload } = useAdminJob(id)
    const { submitting, serverErrors, run } = useSubmit()
    const initial = useMemo(() => (job ? jobToForm(job) : null), [job])

    if (state === 'loading') return <JobLoading />
    if (state === 'notFound') return <JobNotFound />
    if (state === 'error') return <JobError message={error} onRetry={reload} />

    // PATCH only the fields that changed since the job was loaded
    const onSubmit = (_form, changes) => run(
        () => updateAdminJob(backendUrl, id, changes),
        () => { toast.success('Job updated'); navigate(`/admin/jobs/${id}`, { replace: true }) },
    )

    return (
        <div className='max-w-5xl'>
            <Header title={`Edit: ${job.title}`} backTo={`/admin/jobs/${id}`} />
            <JobForm key={job.updatedAt || job._id} mode='edit' initial={initial} legacyLocation={job.city ? '' : job.location}
                onSubmit={onSubmit} onCancel={() => navigate(`/admin/jobs/${id}`)} submitting={submitting} serverErrors={serverErrors} />
        </div>
    )
}
