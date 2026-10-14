import React, { useCallback, useContext, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Copy, Eye, Pencil, Plus, Search, Archive, Trash2, Send, EyeOff } from 'lucide-react'
import { AppContext } from '../../../context/AppContext'
import { apiErrorMessage, isAuthError, listAdminJobs } from '../../../admin/adminApi'
import { JOB_STATUSES } from '../../../admin/jobOptions'
import { masterLabel, useAdminMasters } from '../../../admin/useMasters'
import { PageHeader } from '../ui/AdminUI'

const FILTER_MASTERS = [
    { key: 'categoryId', type: 'categories', all: 'All categories' },
    { key: 'employmentTypeId', type: 'employment-types', all: 'All employment types' },
    { key: 'workplaceTypeId', type: 'workplace-types', all: 'All workplaces' },
    { key: 'locationId', type: 'locations', all: 'All locations' },
    { key: 'clientId', type: 'clients', all: 'All clients' },
]
const FILTER_MASTER_TYPES = FILTER_MASTERS.map(f => f.type)
import usePageMeta from '../../../hooks/usePageMeta'
import useAdminAuthError from './useAdminAuthError'
import JobStatusBadge from './JobStatusBadge'
import { runJobAction } from './jobActions'
import { formatDate } from '../../../utils/jobFormat'

const FILTER_KEYS = ['q', 'status', 'categoryId', 'employmentTypeId', 'workplaceTypeId', 'locationId', 'clientId', 'expired', 'sort', 'order', 'page']
const selectClass = 'border border-gray-300 rounded px-2 py-1.5 text-sm bg-white'

const IconButton = ({ title, onClick, children, danger, disabled }) => (
    <button type='button' title={title} aria-label={title} onClick={onClick} disabled={disabled}
        className={`p-1.5 rounded hover:bg-gray-100 disabled:opacity-40 ${danger ? 'text-red-600' : 'text-gray-600'}`}>
        {children}
    </button>
)

const AdminJobs = () => {
    usePageMeta('Admin - Jobs', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()
    const onAuthError = useAdminAuthError()
    const [params, setParams] = useSearchParams()
    const masters = useAdminMasters(backendUrl, FILTER_MASTER_TYPES)

    // Filters live in the URL so refresh/back keep them
    const filters = Object.fromEntries(FILTER_KEYS.map(k => [k, params.get(k) || '']))
    const [searchInput, setSearchInput] = useState(filters.q)
    const [data, setData] = useState({ items: [], total: 0, pages: 1, page: 1 })
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [busyId, setBusyId] = useState(null)

    const paramsKey = params.toString()
    const load = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const query = Object.fromEntries(new URLSearchParams(paramsKey))
            const { data } = await listAdminJobs(backendUrl, query)
            setData(data)
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            setError(apiErrorMessage(err, 'Could not load jobs'))
        } finally {
            setLoading(false)
        }
    }, [backendUrl, paramsKey, onAuthError])

    useEffect(() => { load() }, [load])

    const update = (changes) => {
        const next = new URLSearchParams(params)
        for (const [k, v] of Object.entries(changes)) { if (v) next.set(k, v); else next.delete(k) }
        if (!('page' in changes)) next.delete('page')
        setParams(next)
    }

    const onSearch = (e) => { e.preventDefault(); update({ q: searchInput.trim() }) }

    const act = async (job, action) => {
        setBusyId(job._id)
        const res = await runJobAction({ backendUrl, job, action, onAuthError })
        setBusyId(null)
        if (!res) return
        if (action === 'duplicate' && res.job) return navigate(`/admin/jobs/${res.job._id}/edit`)
        load()
    }

    const sortValue = `${filters.sort || 'createdAt'}:${filters.order || 'desc'}`
    const page = Number(filters.page) || 1
    const hasFilters = ['q', 'status', 'categoryId', 'employmentTypeId', 'workplaceTypeId', 'locationId', 'clientId', 'expired'].some(k => filters[k])

    return (
        <div>
            <PageHeader title='Jobs' breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Jobs' }]} onRefresh={load} loading={loading}
                actions={<Link to='/admin/jobs/new' className='flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-sm'><Plus size={14} /> New job</Link>} />

            <div className='flex flex-wrap items-center gap-2 mb-4'>
                <form onSubmit={onSearch} className='flex items-center border border-gray-300 rounded bg-white'>
                    <input value={searchInput} onChange={e => setSearchInput(e.target.value)} placeholder='Title, reference, client, city' aria-label='Search jobs'
                        className='px-3 py-1.5 text-sm outline-none w-60' maxLength={100} />
                    <button type='submit' aria-label='Search' className='px-2 min-h-[32px] text-gray-500'><Search size={16} /></button>
                </form>
                <select aria-label='Status' value={filters.status} onChange={e => update({ status: e.target.value })} className={selectClass}>
                    <option value=''>All statuses</option>
                    {JOB_STATUSES.map(s => <option key={s} value={s} className='capitalize'>{s}</option>)}
                </select>
                {FILTER_MASTERS.map(f => {
                    const list = masters.data[f.type] || []
                    // keep a selected (possibly inactive) value visible
                    const shown = list.filter(m => m.active !== false || m._id === filters[f.key])
                    return (
                        <select key={f.key} aria-label={f.all} value={filters[f.key]} onChange={e => update({ [f.key]: e.target.value })} className={selectClass}>
                            <option value=''>{f.all}</option>
                            {!shown.length && !masters.loading && <option value='' disabled>No {f.type.replace('-', ' ')} yet - add in Master data</option>}
                            {shown.map(m => <option key={m._id} value={m._id}>{masterLabel(m, f.type)}{m.active === false ? ' (inactive)' : ''}</option>)}
                        </select>
                    )
                })}
                {filters.expired && <span className='text-xs bg-amber-100 text-amber-800 rounded px-2 py-1'>Expired only</span>}
                <select aria-label='Sort' value={sortValue} onChange={e => { const [sort, order] = e.target.value.split(':'); update({ sort, order }) }} className={selectClass}>
                    <option value='createdAt:desc'>Newest first</option>
                    <option value='createdAt:asc'>Oldest first</option>
                    <option value='title:asc'>Title A–Z</option>
                    <option value='title:desc'>Title Z–A</option>
                    <option value='deadline:asc'>Deadline (soonest)</option>
                    <option value='deadline:desc'>Deadline (latest)</option>
                </select>
                {hasFilters && <button type='button' onClick={() => { setSearchInput(''); setParams(new URLSearchParams()) }} className='text-sm text-blue-600 hover:underline'>Clear filters</button>}
            </div>

            {error ? (
                <div className='bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm flex items-center justify-between'>
                    <span>{error}</span>
                    <button type='button' onClick={load} className='underline'>Retry</button>
                </div>
            ) : loading && !data.items.length ? (
                <div className='flex justify-center py-16'><div className='w-10 h-10 border-4 border-gray-300 border-t-blue-400 rounded-full animate-spin' /></div>
            ) : !data.items.length ? (
                <div className='bg-white border border-dashed border-gray-300 rounded-lg py-16 text-center text-gray-500'>
                    <p className='mb-3'>{hasFilters ? 'No jobs match these filters.' : 'No jobs yet.'}</p>
                    {!hasFilters && <Link to='/admin/jobs/new' className='text-blue-600 hover:underline'>Create the first job</Link>}
                </div>
            ) : (
                <div aria-busy={loading} className={`relative overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm ${loading ? 'opacity-60 pointer-events-none' : ''}`}>
                    {loading && <div className='absolute inset-0 z-10 flex items-start justify-center pt-10 bg-white/60' role='status' aria-label='Loading jobs'><div className='w-8 h-8 border-4 border-gray-300 border-t-blue-400 rounded-full animate-spin' /></div>}
                    <table className='min-w-full text-sm'>
                        <thead className='bg-gray-50 text-left text-gray-600'>
                            <tr>
                                <th className='px-3 py-2 font-medium'>Title</th>
                                <th className='px-3 py-2 font-medium'>Reference</th>
                                <th className='px-3 py-2 font-medium'>Client / department</th>
                                <th className='px-3 py-2 font-medium'>Location</th>
                                <th className='px-3 py-2 font-medium'>Type</th>
                                <th className='px-3 py-2 font-medium'>Status</th>
                                <th className='px-3 py-2 font-medium'>Created</th>
                                <th className='px-3 py-2 font-medium'>Deadline</th>
                                <th className='px-3 py-2 font-medium text-right'>Apps</th>
                                <th className='px-3 py-2 font-medium text-right'>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.items.map(job => (
                                <tr key={job._id} className='border-t hover:bg-gray-50'>
                                    <td className='px-3 py-2 font-medium max-w-64'>
                                        <Link to={`/admin/jobs/${job._id}`} className='hover:text-blue-600 line-clamp-2'>{job.title}</Link>
                                        {job.featured && <span className='ml-1 text-xs text-amber-700'>★</span>}
                                    </td>
                                    <td className='px-3 py-2 font-mono text-xs whitespace-nowrap'>{job.referenceId || <span className='text-gray-400 font-sans'>Not assigned</span>}</td>
                                    <td className='px-3 py-2'>{job.clientName || job.companyId?.name || '-'}{job.department && <span className='block text-xs text-gray-500'>{job.department}</span>}</td>
                                    <td className='px-3 py-2'>{job.location || '-'}</td>
                                    <td className='px-3 py-2 whitespace-nowrap'>{job.employmentType || job.employmentTypeId?.name || <span className='text-gray-400'>Not set</span>}</td>
                                    <td className='px-3 py-2'><JobStatusBadge status={job.status} /></td>
                                    <td className='px-3 py-2 whitespace-nowrap'>{formatDate(job.createdAt || job.date) || '-'}</td>
                                    <td className='px-3 py-2 whitespace-nowrap'>{formatDate(job.applicationDeadline, { utc: true }) || <span className='text-gray-400'>None</span>}</td>
                                    <td className='px-3 py-2 text-right'>{job.applicationCount}</td>
                                    <td className='px-3 py-2'>
                                        <div className='flex justify-end gap-0.5'>
                                            <IconButton title='View' onClick={() => navigate(`/admin/jobs/${job._id}`)}><Eye size={16} /></IconButton>
                                            <IconButton title='Edit' onClick={() => navigate(`/admin/jobs/${job._id}/edit`)}><Pencil size={16} /></IconButton>
                                            {job.status === 'published'
                                                ? <IconButton title='Unpublish' disabled={busyId === job._id} onClick={() => act(job, 'unpublish')}><EyeOff size={16} /></IconButton>
                                                : <IconButton title='Publish' disabled={busyId === job._id} onClick={() => act(job, 'publish')}><Send size={16} /></IconButton>}
                                            <IconButton title='Duplicate' disabled={busyId === job._id} onClick={() => act(job, 'duplicate')}><Copy size={16} /></IconButton>
                                            {job.status !== 'archived' && <IconButton title='Archive' disabled={busyId === job._id} onClick={() => act(job, 'archive')}><Archive size={16} /></IconButton>}
                                            <IconButton title={job.applicationCount ? 'Has applications - archive instead' : 'Delete'} danger disabled={busyId === job._id || job.applicationCount > 0} onClick={() => act(job, 'delete')}><Trash2 size={16} /></IconButton>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {data.total > 0 && (
                <div className='flex items-center justify-between mt-4 text-sm text-gray-600'>
                    <span>{data.total} job{data.total === 1 ? '' : 's'}</span>
                    <div className='flex items-center gap-2'>
                        <button type='button' disabled={page <= 1} onClick={() => update({ page: String(page - 1) })} className='border border-gray-300 rounded px-3 py-1 disabled:opacity-40'>Previous</button>
                        <span>Page {data.page} of {data.pages}</span>
                        <button type='button' disabled={page >= data.pages} onClick={() => update({ page: String(page + 1) })} className='border border-gray-300 rounded px-3 py-1 disabled:opacity-40'>Next</button>
                    </div>
                </div>
            )}
        </div>
    )
}

export default AdminJobs
