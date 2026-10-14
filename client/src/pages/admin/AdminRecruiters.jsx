import React, { useCallback, useContext, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AppContext } from '../../context/AppContext'
import { apiErrorMessage, createAdminCompany, listAdminCompanies, updateAdminCompany } from '../../admin/adminApi'
import usePageMeta from '../../hooks/usePageMeta'
import useAdminFetch from './ui/useAdminFetch'
import { Badge, DataState, PageHeader, Pagination, SearchBox, Table } from './ui/AdminUI'
import { inputClass, selectClass, useListParams } from './ui/adminUtils'

const crumbs = [{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Recruiters' }]

// Admin-created recruiters get no password: they sign in with an email code or use "Forgot password".
const CreateRecruiter = ({ backendUrl, onCreated }) => {
    const [form, setForm] = useState({ name: '', email: '', phone: '', status: 'active' })
    const [busy, setBusy] = useState(false)
    const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))
    const submit = async (e) => {
        e.preventDefault()
        if (busy) return
        setBusy(true)
        try {
            await createAdminCompany(backendUrl, form)
            toast.success('Recruiter created. They can log in with an email code or set a password via "Forgot password".')
            setForm({ name: '', email: '', phone: '', status: 'active' })
            onCreated()
        } catch (err) { toast.error(apiErrorMessage(err, 'Could not create recruiter')) }
        finally { setBusy(false) }
    }
    return (
        <form onSubmit={submit} className='border rounded p-4 mb-6 bg-white' aria-labelledby='new-recruiter'>
            <h2 id='new-recruiter' className='font-medium mb-3'>Add recruiter</h2>
            <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-4'>
                <label className='text-sm'>Company name<input className={inputClass()} value={form.name} onChange={set('name')} maxLength={200} required /></label>
                <label className='text-sm'>Email<input type='email' className={inputClass()} value={form.email} onChange={set('email')} maxLength={254} required /></label>
                <label className='text-sm'>Mobile (optional)<input type='tel' className={inputClass()} value={form.phone} onChange={set('phone')} placeholder='+91 98765 43210' maxLength={20} /></label>
                <label className='text-sm'>Status
                    <select className={`${selectClass} w-full py-2.5`} value={form.status} onChange={set('status')}>
                        <option value='active'>Active</option><option value='suspended'>Suspended</option>
                    </select>
                </label>
            </div>
            <p className='text-xs text-gray-500 mt-2'>No password is set here. The email is treated as verified; the mobile must be verified by the recruiter.</p>
            <button type='submit' disabled={busy} className='mt-3 bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-60'>{busy ? 'Creating…' : 'Create recruiter'}</button>
        </form>
    )
}

const PhoneCell = ({ company, onSave }) => {
    const [editing, setEditing] = useState(false)
    const [value, setValue] = useState(company.phone)
    if (!editing) return (
        <span className='flex items-center gap-2'>
            <span>{company.phone || '-'}</span>
            {company.phone && <Badge active={company.phoneVerified}>{company.phoneVerified ? 'Verified' : 'Unverified'}</Badge>}
            <button type='button' className='text-blue-700 text-xs hover:underline' onClick={() => { setValue(company.phone); setEditing(true) }} aria-label={`Edit mobile for ${company.name}`}>Edit</button>
        </span>
    )
    return (
        <form className='flex gap-1' onSubmit={async (e) => { e.preventDefault(); if (await onSave(value)) setEditing(false) }}>
            <input aria-label='Mobile number' type='tel' className='border rounded px-2 py-1 text-sm w-36' value={value} onChange={e => setValue(e.target.value)} maxLength={20} autoFocus />
            <button type='submit' className='text-xs bg-blue-600 text-white rounded px-2'>Save</button>
            <button type='button' className='text-xs px-1' onClick={() => setEditing(false)}>Cancel</button>
        </form>
    )
}

const AdminRecruiters = () => {
    usePageMeta('Admin - Recruiters', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const [params, setParams] = useSearchParams()
    const [f, update] = useListParams(params, setParams, ['q', 'status', 'page'])
    const key = params.toString()
    const request = useCallback(() => listAdminCompanies(backendUrl, Object.fromEntries(new URLSearchParams(key))), [backendUrl, key])
    const { data, loading, error, reload } = useAdminFetch(request, 'Could not load recruiters')

    const patch = async (c, body, ok) => {
        try { await updateAdminCompany(backendUrl, c._id, body); toast.success(ok); reload(); return true }
        catch (err) { toast.error(apiErrorMessage(err, 'Update failed')); return false }
    }

    return (
        <div>
            <PageHeader title='Recruiters' breadcrumbs={crumbs} onRefresh={reload} loading={loading} />
            <CreateRecruiter backendUrl={backendUrl} onCreated={reload} />
            <div className='flex flex-wrap gap-2 mb-4'>
                <SearchBox value={f.q} onSearch={(q) => update({ q })} placeholder='Name, email or mobile' label='Search recruiters' />
                <select aria-label='Status' value={f.status} onChange={e => update({ status: e.target.value })} className={selectClass}>
                    <option value=''>Any status</option><option value='active'>Active</option><option value='suspended'>Suspended</option>
                </select>
            </div>
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!data} empty={data && !data.items.length}
                emptyText={f.q || f.status ? 'No recruiters match these filters.' : 'No recruiter accounts yet.'}>
                {data && (<>
                    <Table head={['Company', 'Email', 'Mobile', 'Jobs', 'Status', '']}>
                        {data.items.map(c => (
                            <tr key={c._id} className='hover:bg-gray-50'>
                                <td className='px-3 py-2'>{c.name}</td>
                                <td className='px-3 py-2'>{c.email}{!c.emailVerified && <span className='ml-1 text-xs text-yellow-700'>(unconfirmed)</span>}</td>
                                <td className='px-3 py-2'><PhoneCell company={c} onSave={(phone) => patch(c, { phone }, 'Mobile updated (needs verification)')} /></td>
                                <td className='px-3 py-2'>{c.jobCount}</td>
                                <td className='px-3 py-2'><Badge active={c.status === 'active'}>{c.status === 'active' ? 'Active' : 'Suspended'}</Badge></td>
                                <td className='px-3 py-2 text-right'>
                                    <button type='button' className='text-sm text-blue-700 hover:underline'
                                        onClick={() => patch(c, { status: c.status === 'active' ? 'suspended' : 'active' }, c.status === 'active' ? 'Recruiter suspended' : 'Recruiter reactivated')}>
                                        {c.status === 'active' ? 'Suspend' : 'Reactivate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </Table>
                    <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => update({ page: String(p) })} />
                </>)}
            </DataState>
        </div>
    )
}

export default AdminRecruiters
