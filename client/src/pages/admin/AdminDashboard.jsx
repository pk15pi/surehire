import React, { useCallback, useContext } from 'react'
import { Link } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import { getAdminDashboard } from '../../admin/adminApi'
import usePageMeta from '../../hooks/usePageMeta'
import useAdminFetch from './ui/useAdminFetch'
import { DataState, PageHeader } from './ui/AdminUI'
import { formatDateTime } from './ui/adminUtils'
import { formatDate } from '../../utils/jobFormat'

// Every number comes from GET /api/admin/dashboard (live counts); each card links to the filtered list.
const Card = ({ label, value, to, tone = 'text-gray-900' }) => (
    <Link to={to} className='block bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:border-blue-400 hover:shadow focus:outline-none focus:ring-2 focus:ring-blue-400'>
        <p className='text-xs uppercase tracking-wide text-gray-500'>{label}</p>
        <p className={`text-2xl font-semibold mt-1 ${tone}`}>{Number.isFinite(value) ? value.toLocaleString() : '-'}</p>
    </Link>
)

const Section = ({ title, children }) => (
    <section className='mb-6'>
        <h2 className='text-sm font-semibold text-gray-700 mb-2'>{title}</h2>
        <div className='grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3'>{children}</div>
    </section>
)

const AdminDashboard = () => {
    usePageMeta('Admin - Dashboard', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const request = useCallback(() => getAdminDashboard(backendUrl), [backendUrl])
    const { data, loading, error, reload } = useAdminFetch(request, 'Could not load the dashboard')
    const m = data?.metrics

    return (
        <div>
            <PageHeader title='Dashboard' breadcrumbs={[{ label: 'Admin' }, { label: 'Dashboard' }]} onRefresh={reload} loading={loading} />
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!m}>
                {m && (
                    <>
                        <Section title='Jobs'>
                            <Card label='All jobs' value={m.jobs.total} to='/admin/jobs' />
                            <Card label='Published' value={m.jobs.published} to='/admin/jobs?status=published' tone='text-green-700' />
                            <Card label='Drafts' value={m.jobs.draft} to='/admin/jobs?status=draft' />
                            <Card label='Archived' value={m.jobs.archived} to='/admin/jobs?status=archived' />
                            <Card label='Expired (still published)' value={m.jobs.expired} to='/admin/jobs?status=published&expired=true' tone={m.jobs.expired ? 'text-amber-700' : undefined} />
                        </Section>
                        <Section title='Candidates & applications'>
                            <Card label='Registered candidates' value={m.candidates.total} to='/admin/candidates' />
                            <Card label='Applications' value={m.applications.total} to='/admin/applications' />
                            <Card label='Pending review' value={m.applications.pending} to='/admin/applications?status=Pending' tone={m.applications.pending ? 'text-blue-700' : undefined} />
                            <Card label='New in last 7 days' value={m.applications.last7Days} to='/admin/applications?since=7d' />
                            <Card label='Active clients' value={m.clients.active} to='/admin/clients' />
                        </Section>
                        <Section title='New enquiries'>
                            <Card label='Call requests' value={m.enquiries.call} to='/admin/enquiries/calls' />
                            <Card label='Quick enquiries' value={m.enquiries.quick} to='/admin/enquiries/quick' />
                            <Card label='Hire requests' value={m.enquiries.hire} to='/admin/enquiries/hire-requests' />
                            <Card label='CV submissions' value={m.enquiries.candidate} to='/admin/enquiries/cv-submissions' />
                        </Section>
                        <div className='grid lg:grid-cols-2 gap-6'>
                            <section className='bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                                <h2 className='text-sm font-semibold text-gray-700 mb-3'>Deadlines in the next 14 days</h2>
                                {data.upcomingDeadlines.length === 0 ? <p className='text-sm text-gray-500'>No upcoming application deadlines.</p> : (
                                    <ul className='divide-y text-sm'>
                                        {data.upcomingDeadlines.map(j => (
                                            <li key={j._id} className='py-2 flex justify-between gap-3'>
                                                <Link to={`/admin/jobs/${j._id}`} className='text-blue-700 hover:underline truncate'>{j.title} <span className='text-gray-400 font-mono text-xs'>{j.referenceId}</span></Link>
                                                <span className='whitespace-nowrap text-gray-600'>{formatDate(j.applicationDeadline, { utc: true })}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                            <section className='bg-white border border-gray-200 rounded-lg shadow-sm p-4'>
                                <div className='flex justify-between mb-3'>
                                    <h2 className='text-sm font-semibold text-gray-700'>Recent admin activity</h2>
                                    <Link to='/admin/audit-logs' className='text-xs text-blue-600 hover:underline'>View all</Link>
                                </div>
                                {data.recentActivity.length === 0 ? <p className='text-sm text-gray-500'>No activity recorded yet.</p> : (
                                    <ul className='divide-y text-sm'>
                                        {data.recentActivity.map(a => (
                                            <li key={a._id} className='py-2'>
                                                <span className='font-medium capitalize'>{a.action}</span> {a.entityType}{a.entityLabel ? `: ${a.entityLabel}` : ''}
                                                <span className='block text-xs text-gray-500'>{a.actor} · {formatDateTime(a.createdAt)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </section>
                        </div>
                        <p className='text-xs text-gray-400 mt-4'>Updated {new Date(data.generatedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short', timeZoneName: 'short' })}</p>
                    </>
                )}
            </DataState>
        </div>
    )
}

export default AdminDashboard
