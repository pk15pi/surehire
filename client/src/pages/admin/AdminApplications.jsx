import React, { useCallback, useContext, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AppContext } from '../../context/AppContext'
import { apiErrorMessage, isAuthError, listAdminApplications, updateAdminApplicationStatus } from '../../admin/adminApi'
import usePageMeta from '../../hooks/usePageMeta'
import useAdminFetch from './ui/useAdminFetch'
import useAdminAuthError from './jobs/useAdminAuthError'
import { DataState, PageHeader, Pagination, SearchBox, Table } from './ui/AdminUI'
import { selectClass, useListParams } from './ui/adminUtils'
import { useConfirm } from './ui/useConfirm'
import { formatDate } from '../../utils/jobFormat'

const STATUSES = ['Pending', 'Accepted', 'Rejected']
const STYLES = { Pending: 'bg-blue-100 text-blue-800', Accepted: 'bg-green-100 text-green-800', Rejected: 'bg-red-100 text-red-800' }

export const ApplicationStatusBadge = ({ status }) => (
    <span className={`inline-block text-xs rounded px-2 py-0.5 ${STYLES[status] || 'bg-gray-100'}`}>{status}</span>
)

const AdminApplications = () => {
    usePageMeta('Admin - Applications', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const onAuthError = useAdminAuthError()
    const [params, setParams] = useSearchParams()
    const [f, update] = useListParams(params, setParams, ['q', 'status', 'jobId', 'userId', 'since', 'page'])
    const key = params.toString()
    const request = useCallback(() => listAdminApplications(backendUrl, Object.fromEntries(new URLSearchParams(key))), [backendUrl, key])
    const { data, loading, error, reload, setData } = useAdminFetch(request, 'Could not load applications')
    const [busy, setBusy] = useState(null)
    const [confirm, dialog] = useConfirm()
    const hasFilters = ['q', 'status', 'jobId', 'userId', 'since'].some(k => f[k])

    const changeStatus = async (app, status) => {
        if (status === app.status) return
        const ok = await confirm({
            title: 'Change application status?',
            message: `${app.userId?.name || 'Candidate'} - ${app.jobId?.title || 'job'}: ${app.status} -> ${status}`,
            confirmLabel: `Mark ${status}`, danger: status === 'Rejected',
        })
        if (!ok) return
        setBusy(app._id)
        try {
            const res = await updateAdminApplicationStatus(backendUrl, app._id, status)
            setData(d => ({ ...d, items: d.items.map(i => (i._id === app._id ? { ...i, status: res.data.item.status } : i)) }))
            toast.success('Status updated')
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            toast.error(apiErrorMessage(err, 'Could not update the status'))
        } finally {
            setBusy(null)
        }
    }

    return (
        <div>
            {dialog}
            <PageHeader title='Applications' breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Applications' }]} onRefresh={reload} loading={loading} />
            <div className='flex flex-wrap items-center gap-2 mb-4'>
                <SearchBox value={f.q} onSearch={(q) => update({ q })} placeholder='Candidate, email, job title, reference' label='Search applications' />
                <select aria-label='Status' value={f.status} onChange={e => update({ status: e.target.value })} className={selectClass}>
                    <option value=''>All statuses</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select aria-label='Date' value={f.since} onChange={e => update({ since: e.target.value })} className={selectClass}>
                    <option value=''>Any time</option>
                    <option value='7d'>Last 7 days</option>
                </select>
                {(f.jobId || f.userId) && <span className='text-xs bg-gray-200 rounded px-2 py-1'>Filtered by {f.jobId ? 'job' : 'candidate'}</span>}
                {hasFilters && <button type='button' onClick={() => setParams(new URLSearchParams())} className='text-sm text-blue-600 hover:underline'>Clear filters</button>}
            </div>
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!data} empty={data && !data.items.length}
                emptyText={hasFilters ? 'No applications match these filters.' : 'No applications yet.'}>
                {data && (
                    <>
                        <Table head={['Candidate', 'Job', 'Company', 'Applied', 'Resume', 'Status']}>
                            {data.items.map(a => (
                                <tr key={a._id} className='hover:bg-gray-50'>
                                    <td className='px-3 py-2'>
                                        {a.userId ? <Link to={`/admin/candidates/${encodeURIComponent(a.userId._id)}`} className='text-blue-700 hover:underline'>{a.userId.name}</Link> : <span className='text-gray-400'>(unknown user)</span>}
                                        {a.userId?.email && <span className='block text-xs text-gray-500'>{a.userId.email}</span>}
                                    </td>
                                    <td className='px-3 py-2'>
                                        {a.jobId ? <Link to={`/admin/jobs/${a.jobId._id}`} className='text-blue-700 hover:underline'>{a.jobId.title}</Link> : <span className='text-gray-400'>(job deleted)</span>}
                                        {a.screeningAnswers?.length > 0 && (
                                            <details className='mt-1 text-xs text-gray-600'>
                                                <summary className='cursor-pointer text-blue-600'>Screening answers ({a.screeningAnswers.length})</summary>
                                                <dl className='mt-1 space-y-1'>
                                                    {a.screeningAnswers.map((qa, i) => (
                                                        <div key={i}><dt className='font-medium'>{qa.question}</dt><dd className='whitespace-pre-wrap'>{qa.answer}</dd></div>
                                                    ))}
                                                </dl>
                                            </details>
                                        )}
                                    </td>
                                    <td className='px-3 py-2'>{a.companyId?.name || 'SureHire'}</td>
                                    <td className='px-3 py-2 whitespace-nowrap'>{formatDate(a.date)}</td>
                                    <td className='px-3 py-2'>{a.userId?.resume ? <a href={a.userId.resume} target='_blank' rel='noopener noreferrer' className='text-blue-700 hover:underline'>Open</a> : <span className='text-gray-400'>-</span>}</td>
                                    <td className='px-3 py-2'>
                                        <select aria-label='Application status' value={a.status} disabled={busy === a._id} onChange={e => changeStatus(a, e.target.value)}
                                            className={`${selectClass} ${STYLES[a.status] || ''}`}>
                                            {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                                        </select>
                                    </td>
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

export default AdminApplications
