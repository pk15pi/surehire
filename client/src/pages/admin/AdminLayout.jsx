import React, { useEffect, useState } from 'react'
import { Navigate, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { assets } from '../../assets/assets'
import { clearAdminSession, getAdminEmail, getAdminToken } from '../../admin/adminApi'
import { ADMIN_NAV, ADMIN_TABS } from './adminConfig'
import { invalidateMasters } from '../../admin/useMasters'

const AdminLayout = () => {
    const navigate = useNavigate()
    const [authed, setAuthed] = useState(() => !!getAdminToken())

    // Re-check the session when the page is restored from the back/forward cache,
    // when the tab becomes visible again, or when another tab logs out.
    useEffect(() => {
        const recheck = () => { if (!getAdminToken()) { invalidateMasters(); setAuthed(false) } }
        const onShow = () => recheck()
        const onVisible = () => { if (document.visibilityState === 'visible') recheck() }
        window.addEventListener('pageshow', onShow)
        window.addEventListener('storage', recheck)
        window.addEventListener('focus', recheck)
        document.addEventListener('visibilitychange', onVisible)
        return () => {
            window.removeEventListener('pageshow', onShow)
            window.removeEventListener('storage', recheck)
            window.removeEventListener('focus', recheck)
            document.removeEventListener('visibilitychange', onVisible)
        }
    }, [])

    if (!authed || !getAdminToken()) return <Navigate to='/admin/login' replace />

    const logout = () => {
        clearAdminSession()
        invalidateMasters() // drop in-memory admin data
        setAuthed(false)
        navigate('/admin/login', { replace: true })
    }

    const tabClass = ({ isActive }) =>
        `px-4 py-2 text-sm rounded-t-md border-b-2 whitespace-nowrap ${isActive ? 'border-blue-600 text-blue-700 font-medium' : 'border-transparent text-gray-600 hover:text-blue-600'}`

    return (
        <div className='min-h-screen bg-gray-50'>
            <header className='bg-white shadow-sm'>
                <div className='container px-4 2xl:px-20 mx-auto py-3 flex items-center justify-between gap-4'>
                    <div className='flex items-center gap-3'>
                        <img src={assets.logo} alt='SureHire' className='w-28 sm:w-32' />
                        <span className='text-xs uppercase tracking-wider bg-gray-800 text-white rounded px-2 py-0.5'>Admin</span>
                    </div>
                    <div className='flex items-center gap-3 text-sm'>
                        <span className='max-sm:hidden text-gray-600'>{getAdminEmail()}</span>
                        <button onClick={logout} className='flex items-center gap-1 border border-gray-300 rounded px-3 py-1.5 hover:bg-gray-100'>
                            <LogOut size={14} /> Logout
                        </button>
                    </div>
                </div>
                <nav className='container px-4 2xl:px-20 mx-auto flex gap-1 overflow-x-auto' aria-label='Admin sections'>
                    {ADMIN_NAV.map(t => <NavLink key={t.to} to={t.to} className={tabClass}>{t.label}</NavLink>)}
                </nav>
            </header>
            <main className='container px-4 2xl:px-20 mx-auto py-6'>
                <Outlet />
            </main>
        </div>
    )
}

// Sub-navigation for the enquiry inboxes (/admin/enquiries/:section)
export const EnquiriesLayout = () => (
    <div>
        <nav className='text-xs text-gray-500 mb-1' aria-label='Breadcrumb'>
            <NavLink to='/admin/dashboard' className='hover:underline'>Admin</NavLink> / <span>Enquiries</span>
        </nav>
        <div className='flex gap-2 mb-4 flex-wrap' role='tablist' aria-label='Enquiry types'>
            {ADMIN_TABS.map(t => (
                <NavLink key={t.path} to={`/admin/enquiries/${t.path}`}
                    className={({ isActive }) => `px-3 py-1.5 text-sm rounded-full border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-300 hover:border-blue-400'}`}>
                    {t.label}
                </NavLink>
            ))}
        </div>
        <Outlet />
    </div>
)

// Old bookmarked URLs (/admin/calls, /admin/hire-requests, ...) -> new locations
const LEGACY_SECTIONS = { calls: 'calls', enquiries: 'quick', 'hire-requests': 'hire-requests' }
export const LegacySectionRedirect = () => {
    const { section } = useParams()
    const target = LEGACY_SECTIONS[section]
    return <Navigate to={target ? `/admin/enquiries/${target}` : '/admin/dashboard'} replace />
}

export default AdminLayout
