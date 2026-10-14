import React, { useCallback, useContext, useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { ChevronDown, ChevronUp, FileText, RefreshCw, Search } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { adminRequest, clearAdminSession, isAuthError } from '../../admin/adminApi'
import usePageMeta from '../../hooks/usePageMeta'
import { ADMIN_TABS, DETAIL_FIELDS, FILE_FIELD, PRIMARY_FIELDS, humanize } from './adminConfig'

const STATUS_COLORS = {
    new: 'bg-blue-100 text-blue-800',
    scheduled: 'bg-indigo-100 text-indigo-800',
    reviewing: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-amber-100 text-amber-800',
    shortlisted: 'bg-emerald-100 text-emerald-800',
    completed: 'bg-green-100 text-green-800',
    resolved: 'bg-green-100 text-green-800',
    placed: 'bg-green-100 text-green-800',
    closed: 'bg-gray-200 text-gray-700',
    cancelled: 'bg-gray-200 text-gray-700',
    rejected: 'bg-red-100 text-red-800',
}

const formatDate = (d) => (d ? new Date(d).toLocaleString() : '-')

const formatValue = (item, field) => {
    if (field === 'phone') return item.phone ? `${item.countryCode || ''} ${item.phone}`.trim() : ''
    const v = item[field]
    if (v === undefined || v === null || v === '') return ''
    if (typeof v === 'boolean') return v ? 'Yes' : 'No'
    return String(v)
}

const StatusBadge = ({ status }) => (
    <span className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLORS[status] || 'bg-gray-100 text-gray-700'}`}>
        {humanize(status || 'unknown')}
    </span>
)

const SubmissionRow = ({ item, type, statuses, onSaved, onAuthError }) => {
    const { backendUrl } = useContext(AppContext)
    const [open, setOpen] = useState(false)
    const [status, setStatus] = useState(item.status)
    const [notes, setNotes] = useState(item.adminNotes || '')
    const [saving, setSaving] = useState(false)
    const [opening, setOpening] = useState(false)

    const fileField = FILE_FIELD[type]
    const file = fileField ? item[fileField] : null
    const dirty = status !== item.status || notes.trim() !== (item.adminNotes || '')

    const save = async () => {
        setSaving(true)
        try {
            const { data } = await adminRequest(backendUrl, {
                method: 'patch',
                url: `/submissions/${type}/${item._id}`,
                data: { status, notes },
            })
            if (data.success) {
                toast.success(`${item.referenceId} updated`)
                onSaved(data.item)
            } else {
                toast.error(data.message || 'Update failed')
            }
        } catch (error) {
            if (isAuthError(error)) return onAuthError()
            toast.error(error?.response?.data?.message || 'Update failed')
        } finally {
            setSaving(false)
        }
    }

    // Fetch a short-lived signed URL and open it. The tab is opened synchronously
    // so popup blockers allow it, then pointed at the URL once we have it.
    const openDocument = async () => {
        const win = window.open('about:blank', '_blank')
        setOpening(true)
        try {
            const { data } = await adminRequest(backendUrl, {
                method: 'get',
                url: `/resumes/${item._id}/url`,
                params: { type },
            })
            if (!data.success || !data.url) throw new Error(data.message || 'Could not open document')
            if (win) {
                win.opener = null
                win.location.href = data.url
            } else {
                window.location.assign(data.url)
            }
        } catch (error) {
            if (win) win.close()
            if (isAuthError(error)) return onAuthError()
            toast.error(error?.response?.data?.message || error.message || 'Could not open document')
        } finally {
            setOpening(false)
        }
    }

    return (
        <li className='bg-white border border-gray-200 rounded-lg shadow-sm'>
            <button type='button' onClick={() => setOpen(o => !o)} aria-expanded={open}
                className='w-full text-left px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-1'>
                <span className='font-mono text-xs bg-gray-100 rounded px-2 py-0.5'>{item.referenceId}</span>
                <span className='font-medium flex-1 min-w-40 truncate'>{PRIMARY_FIELDS[type](item)}</span>
                <span className='text-sm text-gray-500 max-md:hidden truncate max-w-56'>{item.email}</span>
                <span className='text-xs text-gray-500'>{formatDate(item.createdAt)}</span>
                <StatusBadge status={item.status} />
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {open && (
                <div className='border-t px-4 py-4 grid grid-cols-1 lg:grid-cols-3 gap-6'>
                    <dl className='lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm'>
                        {DETAIL_FIELDS[type].map(field => {
                            const value = formatValue(item, field)
                            if (!value) return null
                            const long = ['description', 'message'].includes(field)
                            return (
                                <div key={field} className={long ? 'sm:col-span-2' : ''}>
                                    <dt className='text-gray-500 text-xs'>{humanize(field)}</dt>
                                    <dd className='text-gray-900 whitespace-pre-wrap break-words'>
                                        {field === 'linkedinUrl' && /^https?:\/\//i.test(value)
                                            ? <a href={value} target='_blank' rel='noopener noreferrer nofollow' className='text-blue-600 underline'>{value}</a>
                                            : value}
                                    </dd>
                                </div>
                            )
                        })}
                        {file && (
                            <div className='sm:col-span-2'>
                                <dt className='text-gray-500 text-xs'>{type === 'candidate' ? 'Resume' : 'Job description'}</dt>
                                <dd className='flex items-center gap-3 mt-1'>
                                    <button type='button' onClick={openDocument} disabled={opening}
                                        className='flex items-center gap-1.5 border border-blue-600 text-blue-700 rounded px-3 py-1.5 hover:bg-blue-50 disabled:opacity-60'>
                                        <FileText size={14} /> {opening ? 'Opening...' : 'Open document'}
                                    </button>
                                    <span className='text-xs text-gray-500 truncate'>{file.originalName}</span>
                                </dd>
                            </div>
                        )}
                        {item.adminUpdatedAt && (
                            <div className='sm:col-span-2 text-xs text-gray-500'>
                                Last admin update {formatDate(item.adminUpdatedAt)}{item.adminUpdatedBy ? ` by ${item.adminUpdatedBy}` : ''}
                            </div>
                        )}
                    </dl>

                    <div className='flex flex-col gap-3'>
                        <label className='text-sm flex flex-col gap-1'>
                            Status
                            <select value={status} onChange={e => setStatus(e.target.value)} className='border border-gray-300 rounded px-2 py-1.5'>
                                {statuses.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
                            </select>
                        </label>
                        <label className='text-sm flex flex-col gap-1'>
                            Internal notes
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={5} maxLength={5000}
                                className='border border-gray-300 rounded px-2 py-1.5 text-sm' placeholder='Visible to admins only' />
                        </label>
                        <button type='button' onClick={save} disabled={!dirty || saving}
                            className='bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded py-2 text-sm'>
                            {saving ? 'Saving...' : 'Save changes'}
                        </button>
                    </div>
                </div>
            )}
        </li>
    )
}

const AdminSubmissionsView = ({ section }) => {
    const tab = ADMIN_TABS.find(t => t.path === section)
    usePageMeta(tab ? `Admin - ${tab.title}` : 'Admin', 'SureHire admin', { noIndex: true })

    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()

    const [status, setStatus] = useState('')
    const [query, setQuery] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [page, setPage] = useState(1)
    const [data, setData] = useState({ items: [], statuses: [], total: 0, pages: 1 })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')

    const onAuthError = useCallback(() => {
        clearAdminSession()
        toast.error('Your admin session has expired. Please log in again.')
        navigate('/admin/login', { replace: true })
    }, [navigate])

    const type = tab?.type

    const load = useCallback(async () => {
        if (!type) return
        setLoading(true)
        setError('')
        try {
            const { data: res } = await adminRequest(backendUrl, {
                method: 'get',
                url: '/submissions',
                params: { type, status: status || undefined, q: query || undefined, page },
            })
            if (res.success) setData(res)
            else setError(res.message || 'Failed to load')
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            setError(err?.response?.data?.message || 'Failed to load submissions')
        } finally {
            setLoading(false)
        }
    }, [backendUrl, type, status, query, page, onAuthError])

    useEffect(() => { load() }, [load])

    if (!tab) return <Navigate to='/admin/enquiries/calls' replace />

    const onSearch = (e) => {
        e.preventDefault()
        setPage(1)
        setQuery(searchInput.trim())
    }

    const replaceItem = (updated) =>
        setData(d => ({ ...d, items: d.items.map(i => (i._id === updated._id ? updated : i)) }))

    return (
        <div>
            <div className='flex flex-wrap items-end justify-between gap-4 mb-5'>
                <div>
                    <h1 className='text-xl font-semibold'>{tab.title}</h1>
                    <p className='text-sm text-gray-500'>{data.total} result{data.total === 1 ? '' : 's'}</p>
                </div>
                <div className='flex flex-wrap items-center gap-2'>
                    <form onSubmit={onSearch} className='flex items-center border border-gray-300 rounded bg-white'>
                        <input value={searchInput} onChange={e => setSearchInput(e.target.value)} maxLength={100}
                            placeholder='Search ref ID, name, email...' className='px-3 py-1.5 text-sm outline-none w-56' />
                        <button type='submit' className='px-2 text-gray-600' aria-label='Search'><Search size={16} /></button>
                    </form>
                    <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
                        className='border border-gray-300 rounded px-2 py-1.5 text-sm bg-white' aria-label='Filter by status'>
                        <option value=''>All statuses</option>
                        {data.statuses.map(s => <option key={s} value={s}>{humanize(s)}</option>)}
                    </select>
                    <button type='button' onClick={load} className='border border-gray-300 rounded p-2 bg-white' aria-label='Refresh'>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && <p role='alert' className='text-sm text-red-600 mb-4'>{error}</p>}

            {!loading && !error && data.items.length === 0 && (
                <p className='text-sm text-gray-500 bg-white border rounded-lg p-6 text-center'>No submissions found.</p>
            )}

            <ul className='flex flex-col gap-3'>
                {data.items.map(item => (
                    <SubmissionRow key={item._id} item={item} type={type} statuses={data.statuses}
                        onSaved={replaceItem} onAuthError={onAuthError} />
                ))}
            </ul>

            {data.pages > 1 && (
                <div className='flex items-center justify-center gap-3 mt-6 text-sm'>
                    <button disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)} className='border rounded px-3 py-1 bg-white disabled:opacity-50'>Previous</button>
                    <span>Page {data.page} of {data.pages}</span>
                    <button disabled={page >= data.pages || loading} onClick={() => setPage(p => p + 1)} className='border rounded px-3 py-1 bg-white disabled:opacity-50'>Next</button>
                </div>
            )}
        </div>
    )
}

// Remount per tab so filters/paging reset when switching submission types
const AdminSubmissions = () => {
    const { section } = useParams()
    return <AdminSubmissionsView key={section} section={section} />
}

export default AdminSubmissions
