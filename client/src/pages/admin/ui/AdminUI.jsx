import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, RefreshCw, Search } from 'lucide-react'

// ---------------------------------------------------------------------------
// Shared building blocks for admin pages: header + breadcrumbs, search box,
// pagination and loading / error / empty states. Helpers: adminUtils.js,
// confirm dialog: useConfirm.jsx.
// ---------------------------------------------------------------------------

export const PageHeader = ({ title, breadcrumbs = [], actions, onRefresh, loading }) => (
    <div className='mb-4'>
        {breadcrumbs.length > 0 && (
            <nav aria-label='Breadcrumb' className='text-xs text-gray-500 mb-1'>
                <ol className='flex flex-wrap items-center gap-1'>
                    {breadcrumbs.map((b, i) => (
                        <li key={i} className='flex items-center gap-1'>
                            {i > 0 && <span aria-hidden='true'>/</span>}
                            {b.to ? <Link to={b.to} className='hover:text-blue-600 hover:underline'>{b.label}</Link> : <span aria-current='page'>{b.label}</span>}
                        </li>
                    ))}
                </ol>
            </nav>
        )}
        <div className='flex flex-wrap items-center justify-between gap-3'>
            <h1 className='text-xl font-semibold'>{title}</h1>
            <div className='flex flex-wrap gap-2'>
                {onRefresh && (
                    <button type='button' onClick={onRefresh} className='flex items-center gap-1 border border-gray-300 rounded px-3 py-1.5 text-sm hover:bg-gray-100'>
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
                    </button>
                )}
                {actions}
            </div>
        </div>
    </div>
)

export const SearchBox = ({ value, onSearch, placeholder = 'Search', label = 'Search' }) => {
    const [text, setText] = useState(value || '')
    const [seen, setSeen] = useState(value)
    if (value !== seen) { setSeen(value); setText(value || '') }
    return (
        <form onSubmit={(e) => { e.preventDefault(); onSearch(text.trim()) }} className='flex items-center border border-gray-300 rounded bg-white'>
            <input value={text} onChange={e => setText(e.target.value)} placeholder={placeholder} aria-label={label} maxLength={100}
                className='px-3 py-1.5 text-sm outline-none w-56' />
            <button type='submit' aria-label='Search' className='px-2 min-h-[32px] text-gray-500'><Search size={16} /></button>
        </form>
    )
}

export const Pagination = ({ page, pages, total, onPage }) => {
    if (!total) return null
    return (
        <div className='flex items-center justify-between mt-4 text-sm text-gray-600'>
            <span>{total} result{total === 1 ? '' : 's'}</span>
            {pages > 1 && (
                <div className='flex items-center gap-2'>
                    <button type='button' disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label='Previous page' className='p-1.5 border rounded disabled:opacity-40 hover:bg-gray-100'><ChevronLeft size={16} /></button>
                    <span>Page {page} of {pages}</span>
                    <button type='button' disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label='Next page' className='p-1.5 border rounded disabled:opacity-40 hover:bg-gray-100'><ChevronRight size={16} /></button>
                </div>
            )}
        </div>
    )
}

export const Spinner = () => (
    <div className='flex justify-center py-16' role='status' aria-label='Loading'><div className='w-10 h-10 border-4 border-gray-300 border-t-blue-400 rounded-full animate-spin' /></div>
)

export const ErrorBox = ({ message, onRetry }) => (
    <div className='bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm flex items-center justify-between' role='alert'>
        <span>{message}</span>
        {onRetry && <button type='button' onClick={onRetry} className='underline'>Retry</button>}
    </div>
)

export const EmptyBox = ({ children }) => (
    <div className='bg-white border border-dashed border-gray-300 rounded-lg py-16 text-center text-gray-500'>{children}</div>
)

/** Renders loading / error / empty, or the children when there is data. */
export const DataState = ({ loading, error, empty, onRetry, emptyText = 'Nothing here yet.', hasData, children }) => {
    if (error) return <ErrorBox message={error} onRetry={onRetry} />
    if (loading && !hasData) return <Spinner />
    if (empty) return <EmptyBox>{emptyText}</EmptyBox>
    return <div className={loading ? 'opacity-60' : ''}>{children}</div>
}

export const Table = ({ head, children }) => (
    <div className='overflow-x-auto bg-white border border-gray-200 rounded-lg shadow-sm'>
        <table className='min-w-full text-sm'>
            <thead className='bg-gray-50 text-left text-gray-600'>
                <tr>{head.map((h, i) => <th key={i} scope='col' className='px-3 py-2 font-medium whitespace-nowrap'>{h}</th>)}</tr>
            </thead>
            <tbody className='divide-y divide-gray-100'>{children}</tbody>
        </table>
    </div>
)

export const Badge = ({ active, children }) => (
    <span className={`inline-block text-xs rounded px-2 py-0.5 ${active ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>{children}</span>
)

export const ConfirmDialog = ({ title = 'Are you sure?', message, confirmLabel = 'Confirm', danger, onClose }) => {
    const btn = useRef(null)
    useEffect(() => {
        btn.current?.focus()
        const onKey = (e) => { if (e.key === 'Escape') onClose(false) }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])
    return (
        <div className='fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4' onClick={() => onClose(false)}>
            <div role='alertdialog' aria-modal='true' aria-labelledby='confirm-title' className='bg-white rounded-lg shadow-xl max-w-md w-full p-5' onClick={e => e.stopPropagation()}>
                <h2 id='confirm-title' className='text-lg font-semibold mb-2'>{title}</h2>
                {message && <p className='text-sm text-gray-600 mb-5'>{message}</p>}
                <div className='flex justify-end gap-2'>
                    <button type='button' onClick={() => onClose(false)} className='border border-gray-300 rounded px-4 py-1.5 text-sm hover:bg-gray-100'>Cancel</button>
                    <button ref={btn} type='button' onClick={() => onClose(true)} className={`${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded px-4 py-1.5 text-sm`}>{confirmLabel}</button>
                </div>
            </div>
        </div>
    )
}
