import React, { useContext, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Archive, Copy, Eye, EyeOff, Pencil, Send, Trash2 } from 'lucide-react'
import { AppContext } from '../../../context/AppContext'
import usePageMeta from '../../../hooks/usePageMeta'
import useAdminJob from './useAdminJob'
import JobStatusBadge from './JobStatusBadge'
import { runJobAction } from './jobActions'
import { JobError, JobLoading, JobNotFound } from './JobPageStates'
import { sanitizeHtml } from '../../../utils/sanitizeHtml'
import { companyName, experienceText, formatDate, salaryText } from '../../../utils/jobFormat'

const Row = ({ label, children }) => (children || children === 0) ? (
    <div>
        <dt className='text-xs text-gray-500'>{label}</dt>
        <dd className='text-gray-900 whitespace-pre-wrap break-words'>{children}</dd>
    </div>
) : null

const Btn = ({ onClick, children, danger, primary, disabled, title }) => (
    <button type='button' onClick={onClick} disabled={disabled} title={title}
        className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm disabled:opacity-50 ${primary ? 'bg-blue-600 hover:bg-blue-700 text-white' : danger ? 'border border-red-300 text-red-700 hover:bg-red-50' : 'border border-gray-300 hover:bg-gray-100'}`}>
        {children}
    </button>
)

const AdminJobView = () => {
    const { id } = useParams()
    usePageMeta('Admin - Job', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()
    const { job, setJob, state, error, reload, onAuthError } = useAdminJob(id)
    const [busy, setBusy] = useState(false)

    if (state === 'loading') return <JobLoading />
    if (state === 'notFound') return <JobNotFound />
    if (state === 'error') return <JobError message={error} onRetry={reload} />

    const act = async (action) => {
        setBusy(true)
        const res = await runJobAction({ backendUrl, job, action, onAuthError })
        setBusy(false)
        if (!res) return
        if (action === 'delete') return navigate('/admin/jobs', { replace: true })
        if (action === 'duplicate') return navigate(`/admin/jobs/${res.job._id}/edit`)
        setJob(j => ({ ...j, ...res.job }))
    }

    return (
        <div className='max-w-5xl'>
            <div className='flex flex-wrap items-start justify-between gap-3 mb-4'>
                <div className='flex items-start gap-3'>
                    <Link to='/admin/jobs' className='text-gray-500 hover:text-blue-600 mt-1' aria-label='Back to jobs'><ArrowLeft size={18} /></Link>
                    <div>
                        <h1 className='text-xl font-semibold'>{job.title}</h1>
                        <div className='flex flex-wrap items-center gap-2 mt-1 text-sm text-gray-500'>
                            <span className='font-mono text-xs bg-gray-100 rounded px-2 py-0.5'>{job.referenceId || 'legacy (no reference yet)'}</span>
                            <JobStatusBadge status={job.status} />
                            {job.featured && <span className='text-xs bg-amber-100 text-amber-800 rounded-full px-2 py-0.5'>Featured</span>}
                            <span>{job.applicationCount} application{job.applicationCount === 1 ? '' : 's'}</span>
                        </div>
                    </div>
                </div>
                <div className='flex flex-wrap gap-2'>
                    <Btn primary onClick={() => navigate(`/admin/jobs/${id}/edit`)}><Pencil size={14} /> Edit</Btn>
                    <Btn onClick={() => navigate(`/admin/jobs/${id}/preview`)}><Eye size={14} /> Preview</Btn>
                    {job.status === 'published'
                        ? <Btn disabled={busy} onClick={() => act('unpublish')}><EyeOff size={14} /> Unpublish</Btn>
                        : <Btn disabled={busy} onClick={() => act('publish')}><Send size={14} /> Publish</Btn>}
                    <Btn disabled={busy} onClick={() => act('duplicate')}><Copy size={14} /> Duplicate</Btn>
                    {job.status !== 'archived' && <Btn disabled={busy} onClick={() => act('archive')}><Archive size={14} /> Archive</Btn>}
                    <Btn danger disabled={busy || job.applicationCount > 0} title={job.applicationCount > 0 ? 'Jobs with applications cannot be deleted' : undefined} onClick={() => act('delete')}><Trash2 size={14} /> Delete</Btn>
                </div>
            </div>

            <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
                <div className='lg:col-span-2 bg-white border border-gray-200 rounded-lg shadow-sm p-5'>
                    <h2 className='font-semibold mb-2'>Description</h2>
                    <div className='rich-text' dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }} />
                    {job.responsibilities && <><h2 className='font-semibold mt-6 mb-2'>Responsibilities</h2><div className='rich-text' dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.responsibilities) }} /></>}
                    {job.qualifications && <><h2 className='font-semibold mt-6 mb-2'>Qualifications</h2><div className='rich-text' dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.qualifications) }} /></>}
                    {job.screeningQuestions?.length > 0 && (
                        <><h2 className='font-semibold mt-6 mb-2'>Screening questions</h2>
                            <ol className='list-decimal ml-5 text-sm text-gray-700 space-y-1'>{job.screeningQuestions.map(q => <li key={q}>{q}</li>)}</ol></>
                    )}
                </div>
                <dl className='bg-white border border-gray-200 rounded-lg shadow-sm p-5 grid gap-3 text-sm content-start'>
                    <Row label='Hiring organisation'>{companyName(job)}</Row>
                    <Row label='Department'>{job.department}</Row>
                    <Row label='Category'>{job.category}</Row>
                    <Row label='Employment / workplace'>{[job.employmentType, job.workplaceType].filter(Boolean).join(' · ')}</Row>
                    <Row label='Location'>{job.location}</Row>
                    <Row label='Address'>{job.address}</Row>
                    <Row label='Experience'>{[job.experienceLevel || job.level, experienceText(job)].filter(Boolean).join(' · ')}</Row>
                    <Row label='Vacancies'>{job.vacancies}</Row>
                    <Row label='Salary'>{salaryText(job)}</Row>
                    <Row label='Skills'>{job.skills?.join(', ')}</Row>
                    <Row label='Application deadline'>{formatDate(job.applicationDeadline, { utc: true })}</Row>
                    <Row label='Required documents'>{job.requiredDocuments}</Row>
                    <Row label='Application instructions'>{job.applicationInstructions}</Row>
                    <Row label='Publish from'>{formatDate(job.publishAt, { utc: true })}</Row>
                    <Row label='Expires on'>{formatDate(job.expiresAt, { utc: true })}</Row>
                    <Row label='Recruiter / owner'>{job.recruiterOwner}</Row>
                    <Row label='Internal notes'>{job.internalNotes}</Row>
                    <Row label='Created'>{formatDate(job.createdAt || job.date)}{job.createdBy ? ` by ${job.createdBy}` : ''}</Row>
                    <Row label='Last updated'>{job.updatedAt ? `${formatDate(job.updatedAt)}${job.updatedBy ? ` by ${job.updatedBy}` : ''}` : ''}</Row>
                </dl>
            </div>
        </div>
    )
}

export default AdminJobView
