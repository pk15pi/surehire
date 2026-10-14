import React, { useCallback, useContext } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import { getAdminCandidate, listAdminCandidates } from '../../admin/adminApi'
import usePageMeta from '../../hooks/usePageMeta'
import useAdminFetch from './ui/useAdminFetch'
import { DataState, EmptyBox, PageHeader, Pagination, SearchBox, Table } from './ui/AdminUI'
import { selectClass, useListParams } from './ui/adminUtils'
import { formatDate } from '../../utils/jobFormat'
import { ApplicationStatusBadge } from './AdminApplications'

const crumbs = (extra = []) => [{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Candidates', to: extra.length ? '/admin/candidates' : undefined }, ...extra]

// Registered candidates (read-only)
export const AdminCandidates = () => {
    usePageMeta('Admin - Candidates', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const [params, setParams] = useSearchParams()
    const [f, update] = useListParams(params, setParams, ['q', 'hasResume', 'page'])
    const key = params.toString()
    const request = useCallback(() => listAdminCandidates(backendUrl, Object.fromEntries(new URLSearchParams(key))), [backendUrl, key])
    const { data, loading, error, reload } = useAdminFetch(request, 'Could not load candidates')

    return (
        <div>
            <PageHeader title='Candidates' breadcrumbs={crumbs()} onRefresh={reload} loading={loading} />
            <div className='flex flex-wrap gap-2 mb-4'>
                <SearchBox value={f.q} onSearch={(q) => update({ q })} placeholder='Name or email' label='Search candidates' />
                <select aria-label='Resume' value={f.hasResume} onChange={e => update({ hasResume: e.target.value })} className={selectClass}>
                    <option value=''>Any resume status</option>
                    <option value='true'>With resume</option>
                </select>
            </div>
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!data} empty={data && !data.items.length}
                emptyText={f.q || f.hasResume ? 'No candidates match these filters.' : 'No registered candidates yet.'}>
                {data && (
                    <>
                        <Table head={['Name', 'Email', 'Resume', 'Applications', 'Last applied']}>
                            {data.items.map(c => (
                                <tr key={c._id} className='hover:bg-gray-50'>
                                    <td className='px-3 py-2'><Link to={`/admin/candidates/${encodeURIComponent(c._id)}`} className='text-blue-700 hover:underline'>{c.name || '(no name)'}</Link></td>
                                    <td className='px-3 py-2'>{c.email}</td>
                                    <td className='px-3 py-2'>{c.hasResume ? 'Yes' : 'No'}</td>
                                    <td className='px-3 py-2'>{c.applicationCount ? <Link to={`/admin/applications?userId=${encodeURIComponent(c._id)}`} className='text-blue-700 hover:underline'>{c.applicationCount}</Link> : 0}</td>
                                    <td className='px-3 py-2'>{c.lastAppliedAt ? formatDate(c.lastAppliedAt) : '-'}</td>
                                </tr>
                            ))}
                        </Table>
                        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => update({ page: String(p) })} />
                    </>
                )}
            </DataState>
        </div>
    )
}

export const AdminCandidateDetail = () => {
    const { id } = useParams()
    usePageMeta('Admin - Candidate', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const request = useCallback(() => getAdminCandidate(backendUrl, id), [backendUrl, id])
    const { data, loading, error, notFound, reload } = useAdminFetch(request, 'Could not load the candidate')
    const c = data?.candidate

    if (notFound) return <div><PageHeader title='Candidate not found' breadcrumbs={crumbs([{ label: 'Not found' }])} /><EmptyBox>This candidate does not exist.</EmptyBox></div>
    return (
        <div className='max-w-4xl'>
            <PageHeader title={c?.name || 'Candidate'} breadcrumbs={crumbs([{ label: c?.name || '...' }])} onRefresh={reload} loading={loading} />
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!c}>
                {c && (
                    <>
                        <div className='bg-white border border-gray-200 rounded-lg shadow-sm p-5 flex gap-4 items-center mb-6'>
                            {c.image && <img src={c.image} alt='' className='w-14 h-14 rounded-full object-cover' />}
                            <div className='text-sm'>
                                <p className='font-medium text-base'>{c.name}</p>
                                <p className='text-gray-600'>{c.email}</p>
                                {c.resume ? <a href={c.resume} target='_blank' rel='noopener noreferrer' className='text-blue-700 hover:underline'>View resume</a> : <p className='text-gray-500'>No resume uploaded</p>}
                            </div>
                        </div>
                        <h2 className='text-sm font-semibold text-gray-700 mb-2'>Applications ({data.applications.length})</h2>
                        {data.applications.length === 0 ? <EmptyBox>No applications yet.</EmptyBox> : (
                            <Table head={['Job', 'Company', 'Applied', 'Status']}>
                                {data.applications.map(a => (
                                    <tr key={a._id}>
                                        <td className='px-3 py-2'>{a.jobId ? <Link to={`/admin/jobs/${a.jobId._id}`} className='text-blue-700 hover:underline'>{a.jobId.title}</Link> : <span className='text-gray-400'>(job deleted)</span>}</td>
                                        <td className='px-3 py-2'>{a.companyId?.name || 'SureHire'}</td>
                                        <td className='px-3 py-2'>{formatDate(a.date)}</td>
                                        <td className='px-3 py-2'><ApplicationStatusBadge status={a.status} /></td>
                                    </tr>
                                ))}
                            </Table>
                        )}
                        <p className='mt-3 text-sm'><Link to={`/admin/applications?userId=${encodeURIComponent(c._id)}`} className='text-blue-600 hover:underline'>Manage these applications</Link></p>
                    </>
                )}
            </DataState>
        </div>
    )
}
