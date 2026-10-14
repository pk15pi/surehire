import React, { useCallback, useContext } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AppContext } from '../../context/AppContext'
import { listAdminAuditLogs } from '../../admin/adminApi'
import usePageMeta from '../../hooks/usePageMeta'
import useAdminFetch from './ui/useAdminFetch'
import { DataState, PageHeader, Pagination, Table } from './ui/AdminUI'
import { formatDateTime, selectClass, useListParams } from './ui/adminUtils'

const ACTIONS = ['create', 'update', 'delete', 'activate', 'deactivate', 'publish', 'unpublish', 'archive', 'duplicate', 'status-change']

const entityLink = (a) => {
    if (a.action === 'delete') return null
    if (a.entityType === 'job') return `/admin/jobs/${a.entityId}`
    if (a.entityType === 'master:clients') return '/admin/clients'
    if (a.entityType?.startsWith('master:')) return `/admin/master/${a.entityType.slice(7)}`
    return null
}

const AdminAuditLogs = () => {
    usePageMeta('Admin - Audit logs', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const [params, setParams] = useSearchParams()
    const [f, update] = useListParams(params, setParams, ['entityType', 'action', 'page'])
    const key = params.toString()
    const request = useCallback(() => listAdminAuditLogs(backendUrl, Object.fromEntries(new URLSearchParams(key))), [backendUrl, key])
    const { data, loading, error, reload } = useAdminFetch(request, 'Could not load audit logs')

    return (
        <div>
            <PageHeader title='Audit logs' breadcrumbs={[{ label: 'Admin', to: '/admin/dashboard' }, { label: 'Audit logs' }]} onRefresh={reload} loading={loading} />
            <div className='flex flex-wrap gap-2 mb-4'>
                <select aria-label='Entity type' value={f.entityType} onChange={e => update({ entityType: e.target.value })} className={selectClass}>
                    <option value=''>All entities</option>
                    {(data?.entityTypes || []).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <select aria-label='Action' value={f.action} onChange={e => update({ action: e.target.value })} className={selectClass}>
                    <option value=''>All actions</option>
                    {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
            </div>
            <DataState loading={loading} error={error} onRetry={reload} hasData={!!data} empty={data && !data.items.length}
                emptyText='No activity recorded yet. Changes to jobs, clients, applications and master data appear here.'>
                {data && (
                    <>
                        <Table head={['When', 'Who', 'Action', 'Entity', 'Changed fields']}>
                            {data.items.map(a => {
                                const to = entityLink(a)
                                return (
                                    <tr key={a._id}>
                                        <td className='px-3 py-2 whitespace-nowrap'>{formatDateTime(a.createdAt)}</td>
                                        <td className='px-3 py-2'>{a.actor}</td>
                                        <td className='px-3 py-2 capitalize'>{a.action}{a.meta?.from && <span className='block text-xs text-gray-500'>{a.meta.from} → {a.meta.to}</span>}</td>
                                        <td className='px-3 py-2'><span className='text-xs text-gray-500'>{a.entityType}</span><br />{to ? <Link to={to} className='text-blue-700 hover:underline'>{a.entityLabel || a.entityId}</Link> : (a.entityLabel || a.entityId)}</td>
                                        <td className='px-3 py-2 text-xs text-gray-600 max-w-xs'>{(a.changes || []).join(', ') || '-'}</td>
                                    </tr>
                                )
                            })}
                        </Table>
                        <Pagination page={data.page} pages={data.pages} total={data.total} onPage={(p) => update({ page: String(p) })} />
                    </>
                )}
            </DataState>
        </div>
    )
}

export default AdminAuditLogs
