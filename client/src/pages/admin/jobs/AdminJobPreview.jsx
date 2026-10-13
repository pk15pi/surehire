import React from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import usePageMeta from '../../../hooks/usePageMeta'
import useAdminJob from './useAdminJob'
import JobDetails from '../../../components/jobs/JobDetails'
import { JobError, JobLoading, JobNotFound } from './JobPageStates'

// Renders the saved backend data with the same component the public job page uses.
const AdminJobPreview = () => {
    const { id } = useParams()
    usePageMeta('Admin - Job preview', 'SureHire admin', { noIndex: true })
    const { job, state, error, reload } = useAdminJob(id)

    if (state === 'loading') return <JobLoading />
    if (state === 'notFound') return <JobNotFound />
    if (state === 'error') return <JobError message={error} onRetry={reload} />

    // Never show internal-only fields in the preview, exactly like the public API
    const { internalNotes: _n, recruiterOwner: _r, createdBy: _c, updatedBy: _u, ...publicJob } = job
    if (publicJob.salaryUndisclosed) { delete publicJob.salary; delete publicJob.salaryMin; delete publicJob.salaryMax }

    return (
        <div>
            <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
                <div className='flex items-center gap-3'>
                    <Link to={`/admin/jobs/${id}`} className='text-gray-500 hover:text-blue-600' aria-label='Back'><ArrowLeft size={18} /></Link>
                    <h1 className='text-xl font-semibold'>Preview</h1>
                </div>
                <p className={`text-sm rounded px-3 py-1 ${job.status === 'published' ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>
                    {job.status === 'published' ? 'This job is published.' : `This job is ${job.status} and not visible publicly.`}
                </p>
            </div>
            <div className='bg-white rounded-lg p-4 sm:p-6 border border-gray-200'>
                <JobDetails job={publicJob}
                    actions={<button type='button' disabled className='bg-blue-600 p-2.5 px-10 text-white rounded opacity-70 cursor-not-allowed'>Apply Now</button>} />
            </div>
        </div>
    )
}

export default AdminJobPreview
