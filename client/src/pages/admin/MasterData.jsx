import React, { useCallback, useContext, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'react-toastify'
import { Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { apiErrorMessage, createMaster, deleteMaster, isAuthError, listMaster, listMasterTypes, setMasterActive, updateMaster } from '../../admin/adminApi'
import { invalidateMasters, masterLabel, useAdminMasters } from '../../admin/useMasters'
import usePageMeta from '../../hooks/usePageMeta'
import useAdminFetch from './ui/useAdminFetch'
import useAdminAuthError from './jobs/useAdminAuthError'
import { Badge, DataState, EmptyBox, PageHeader, Pagination, SearchBox, Table } from './ui/AdminUI'
import { inputClass, useListParams } from './ui/adminUtils'
import { useConfirm } from './ui/useConfirm'
import { MasterSelect } from './ui/MasterSelect'
import { humanize } from './adminConfig'

// Master types and their field specs come from GET /api/admin/master
let typesCache = null
const useMasterTypes = (backendUrl) => {
    const request = useCallback(async () => {
        if (typesCache) return { data: typesCache }
        const res = await listMasterTypes(backendUrl)
        typesCache = res.data
        return res
    }, [backendUrl])
    return useAdminFetch(request, 'Could not load master data types')
}

const crumbs = (extra = []) => [{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Master data', to: extra.length ? '/admin/master' : undefined }, ...extra]

// Index: every list with active/total counts
export const MasterDataIndex = () => {
    usePageMeta('Admin - Master data', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const request = useCallback(() => listMasterTypes(backendUrl), [backendUrl])
    const { data, loading, error, reload } = useAdminFetch(request, 'Could not load master data')
    return (
        <div>
            <PageHeader title='Master data' breadcrumbs={crumbs()} onRefresh={reload} loading={loading} />
            <p className='text-sm text-gray-600 mb-4'>Option lists used by job forms and public filters. Deactivate values to hide them from new selections; values in use cannot be deleted.</p>
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!data}>
                <div className='grid sm:grid-cols-2 lg:grid-cols-3 gap-3'>
                    {data?.types.map(t => (
                        <Link key={t.type} to={t.type === 'clients' ? '/admin/clients' : `/admin/master/${t.type}`}
                            className='bg-white border border-gray-200 rounded-lg shadow-sm p-4 hover:border-blue-400'>
                            <p className='font-medium'>{t.label}</p>
                            <p className='text-sm text-gray-500'>{t.active} active{t.total !== t.active ? ` · ${t.total - t.active} inactive` : ''}</p>
                        </Link>
                    ))}
                </div>
            </DataState>
        </div>
    )
}

const FIELD_LABELS = { categoryId: 'Category', industryId: 'Industry', displayOrder: 'Display order', minYears: 'Min years', maxYears: 'Max years', postalCode: 'Postal code', contactPerson: 'Contact person' }
const label = (f) => FIELD_LABELS[f.name] || humanize(f.name)

const emptyForm = (fields, item) => Object.fromEntries(fields.map(f => {
    const v = item?.[f.name]
    if (f.kind === 'boolean') return [f.name, !!v]
    if (v === null || v === undefined) return [f.name, '']
    return [f.name, String(v)]
}))

// Only changed values; '' clears an optional value; numbers are sent as numbers
const toPayload = (fields, form, initial) => {
    const out = {}
    for (const f of fields) {
        const v = form[f.name]
        if (initial && String(v) === String(initial[f.name])) continue
        if (!initial && (v === '' || v === false)) continue
        out[f.name] = f.kind === 'number' && v !== '' ? Number(v) : (f.kind === 'boolean' ? !!v : v)
    }
    return out
}

const MasterForm = ({ backendUrl, typeInfo, item, onSaved, onCancel }) => {
    const onAuthError = useAdminAuthError()
    const fields = typeInfo.fields
    const refTypes = [...new Set(fields.filter(f => f.kind === 'ref').map(f => f.refType))]
    const refs = useAdminMasters(backendUrl, refTypes)
    const [initial] = useState(() => (item ? emptyForm(fields, item) : null))
    const [form, setForm] = useState(() => emptyForm(fields, item))
    const [errors, setErrors] = useState({})
    const [saving, setSaving] = useState(false)

    const set = (name) => (e) => {
        const v = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e
        setForm(f => ({ ...f, [name]: v }))
        setErrors(er => { const n = { ...er }; delete n[name]; return n })
    }

    const submit = async (e) => {
        e.preventDefault()
        const found = {}
        for (const f of fields) if (f.required && !String(form[f.name] ?? '').trim()) found[f.name] = 'This field is required'
        setErrors(found)
        if (Object.keys(found).length) return
        const payload = toPayload(fields, form, initial)
        if (item && !Object.keys(payload).length) return onCancel()
        setSaving(true)
        try {
            const res = item ? await updateMaster(backendUrl, typeInfo.type, item._id, payload) : await createMaster(backendUrl, typeInfo.type, payload)
            toast.success(res.data.message || 'Saved')
            onSaved(res.data.item)
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            if (err?.response?.data?.errors) setErrors(err.response.data.errors)
            toast.error(apiErrorMessage(err, 'Could not save'))
        } finally {
            setSaving(false)
        }
    }

    return (
        <form onSubmit={submit} noValidate className='bg-white border border-blue-200 rounded-lg shadow-sm p-5 mb-4'>
            <h2 className='font-semibold mb-3'>{item ? `Edit ${typeInfo.singular.toLowerCase()}` : `New ${typeInfo.singular.toLowerCase()}`}</h2>
            <fieldset disabled={saving} className='grid md:grid-cols-2 gap-4'>
                {fields.map(f => {
                    const id = `master-${f.name}`
                    const err = errors[f.name]
                    const wide = f.max >= 500
                    return (
                        <div key={f.name} className={wide ? 'md:col-span-2' : ''}>
                            {f.kind === 'boolean' ? (
                                <label className='flex items-center gap-2 text-sm mt-6'><input id={id} type='checkbox' checked={!!form[f.name]} onChange={set(f.name)} className='scale-125' /> {label(f)}</label>
                            ) : (
                                <>
                                    <label htmlFor={id} className='block text-sm font-medium mb-1'>{label(f)}{f.required && <span className='text-red-600 ml-0.5'>*</span>}</label>
                                    {f.kind === 'ref' ? (
                                        <MasterSelect id={id} items={refs.data[f.refType] || []} type={f.refType} value={form[f.name]} onChange={set(f.name)} className={inputClass(err)} invalid={!!err} />
                                    ) : wide ? (
                                        <textarea id={id} rows={3} value={form[f.name]} onChange={set(f.name)} maxLength={f.max} className={inputClass(err)} aria-invalid={!!err || undefined} />
                                    ) : (
                                        <input id={id} type={f.kind === 'number' ? 'number' : 'text'} min={f.min} max={f.kind === 'number' ? f.max : undefined} maxLength={f.kind === 'string' ? f.max : undefined}
                                            value={form[f.name]} onChange={set(f.name)} className={`${inputClass(err)} ${f.upper ? 'uppercase' : ''}`} aria-invalid={!!err || undefined} />
                                    )}
                                </>
                            )}
                            {err && <p className='text-xs text-red-600 mt-1' role='alert'>{err}</p>}
                        </div>
                    )
                })}
            </fieldset>
            <div className='flex justify-end gap-2 mt-4'>
                <button type='button' onClick={onCancel} disabled={saving} className='border border-gray-300 rounded px-4 py-1.5 text-sm hover:bg-gray-100'>Cancel</button>
                <button type='submit' disabled={saving} className='bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded px-4 py-1.5 text-sm'>{saving ? 'Saving...' : 'Save'}</button>
            </div>
        </form>
    )
}

// Columns besides name, per type
const EXTRA_COLUMNS = {
    currencies: [['Code', i => i.code]],
    'experience-levels': [['Years', i => (i.minYears ?? '') !== '' || i.maxYears != null ? `${i.minYears ?? 0}${i.maxYears != null ? `-${i.maxYears}` : '+'}` : '-']],
    locations: [['Place', i => [i.city, i.state, i.country].filter(Boolean).join(', ') || '-']],
    clients: [['Code', i => i.code], ['Contact', i => [i.contactPerson, i.email].filter(Boolean).join(' · ') || '-'], ['Confidential', i => (i.confidential ? 'Yes' : 'No')]],
}

/** Generic list + CRUD page for one master type (`type` prop or :type param). */
export const MasterDataPage = ({ type: fixedType }) => {
    const params = useParams()
    const type = fixedType || params.type
    const { backendUrl } = useContext(AppContext)
    const onAuthError = useAdminAuthError()
    const types = useMasterTypes(backendUrl)
    const typeInfo = types.data?.types.find(t => t.type === type)
    usePageMeta(`Admin - ${typeInfo?.label || 'Master data'}`, 'SureHire admin', { noIndex: true })

    const [search, setSearch] = useSearchParams()
    const [f, update] = useListParams(search, setSearch, ['q', 'includeInactive', 'page'])
    const key = search.toString()
    const request = useCallback(() => listMaster(backendUrl, type, Object.fromEntries(new URLSearchParams(key))), [backendUrl, type, key])
    const { data, loading, error, reload } = useAdminFetch(request, 'Could not load records')
    const [editing, setEditing] = useState(null) // null | 'new' | item
    const [busy, setBusy] = useState(null)
    const [confirm, dialog] = useConfirm()

    const afterChange = () => { invalidateMasters(type); typesCache = null; reload() }

    const toggle = async (item) => {
        const next = !item.active
        if (!next && !(await confirm({
            title: `Deactivate "${item.name}"?`,
            message: `It will be hidden from new selections and public filters.${item.usageCount ? ` ${item.usageCount} existing record(s) keep their value.` : ''}`,
            confirmLabel: 'Deactivate',
        }))) return
        setBusy(item._id)
        try {
            await setMasterActive(backendUrl, type, item._id, next)
            toast.success(next ? 'Activated' : 'Deactivated')
            afterChange()
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            toast.error(apiErrorMessage(err, 'Could not update'))
        } finally { setBusy(null) }
    }

    const remove = async (item) => {
        if (!(await confirm({ title: `Delete "${item.name}"?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return
        setBusy(item._id)
        try {
            await deleteMaster(backendUrl, type, item._id)
            toast.success('Deleted')
            afterChange()
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            toast.error(apiErrorMessage(err, 'Could not delete'))
        } finally { setBusy(null) }
    }

    if (types.data && !typeInfo) return <div><PageHeader title='Unknown list' breadcrumbs={crumbs([{ label: 'Unknown' }])} /><EmptyBox>This master data type does not exist.</EmptyBox></div>
    const title = typeInfo?.label || 'Master data'
    const bc = type === 'clients' ? [{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Clients' }] : crumbs([{ label: title }])
    const extra = EXTRA_COLUMNS[type] || []
    const jobFilterKey = typeInfo?.jobField?.replace(/Ids$/, 'Id')

    return (
        <div>
            {dialog}
            <PageHeader title={title} breadcrumbs={bc} onRefresh={reload} loading={loading}
                actions={typeInfo && <button type='button' onClick={() => setEditing('new')} className='flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-3 py-1.5 text-sm'><Plus size={14} /> Add</button>} />
            {types.error && <p className='text-sm text-red-600 mb-3'>{types.error}</p>}
            {editing && typeInfo && (
                <MasterForm key={editing === 'new' ? 'new' : editing._id} backendUrl={backendUrl} typeInfo={typeInfo} item={editing === 'new' ? null : editing}
                    onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); afterChange() }} />
            )}
            <div className='flex flex-wrap items-center gap-3 mb-4'>
                <SearchBox value={f.q} onSearch={(q) => update({ q })} placeholder={`Search ${title.toLowerCase()}`} />
                <label className='flex items-center gap-2 text-sm'>
                    <input type='checkbox' checked={f.includeInactive === 'true'} onChange={e => update({ includeInactive: e.target.checked ? 'true' : '' })} /> Show inactive
                </label>
            </div>
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!data} empty={data && !data.items.length}
                emptyText={f.q ? 'No records match your search.' : 'No records yet. Use "Add" to create one.'}>
                {data && (
                    <>
                        <Table head={['Name', ...extra.map(c => c[0]), 'Status', 'Used by', '']}>
                            {data.items.map(i => (
                                <tr key={i._id} className={`hover:bg-gray-50 ${i.active ? '' : 'text-gray-500'}`}>
                                    <td className='px-3 py-2'>{type === 'locations' ? i.name : masterLabel(i, type)}{i.description && <span className='block text-xs text-gray-500 truncate max-w-xs'>{i.description}</span>}</td>
                                    {extra.map(([h, fn]) => <td key={h} className='px-3 py-2'>{fn(i)}</td>)}
                                    <td className='px-3 py-2'><Badge active={i.active}>{i.active ? 'Active' : 'Inactive'}</Badge></td>
                                    <td className='px-3 py-2'>{i.usageCount && jobFilterKey ? <Link to={`/admin/jobs?${jobFilterKey}=${i._id}`} className='text-blue-700 hover:underline'>{i.usageCount}</Link> : i.usageCount}</td>
                                    <td className='px-3 py-2 whitespace-nowrap text-right'>
                                        <button type='button' title='Edit' aria-label={`Edit ${i.name}`} onClick={() => setEditing(i)} className='p-1.5 rounded hover:bg-gray-100'><Pencil size={15} /></button>
                                        <button type='button' title={i.active ? 'Deactivate' : 'Activate'} aria-label={`${i.active ? 'Deactivate' : 'Activate'} ${i.name}`} disabled={busy === i._id} onClick={() => toggle(i)} className={`p-1.5 rounded hover:bg-gray-100 ${i.active ? 'text-amber-600' : 'text-green-600'}`}><Power size={15} /></button>
                                        <button type='button' title={i.usageCount ? 'In use - deactivate instead' : 'Delete'} aria-label={`Delete ${i.name}`} disabled={busy === i._id || i.usageCount > 0} onClick={() => remove(i)} className='p-1.5 rounded hover:bg-gray-100 text-red-600 disabled:opacity-30'><Trash2 size={15} /></button>
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
