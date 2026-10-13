import React from 'react'
import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { assets } from '../../assets/assets'
import { clearAdminSession, getAdminEmail, getAdminToken } from '../../admin/adminApi'
import { ADMIN_TABS } from './adminConfig'

const AdminLayout = () => {
    const navigate = useNavigate()

    if (!getAdminToken()) return <Navigate to='/admin/login' replace />

    const logout = () => {
        clearAdminSession()
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
                    <NavLink to='/admin/jobs' className={tabClass}>Jobs</NavLink>
                    {ADMIN_TABS.map(t => <NavLink key={t.path} to={`/admin/${t.path}`} className={tabClass}>{t.label}</NavLink>)}
                </nav>
            </header>
            <main className='container px-4 2xl:px-20 mx-auto py-6'>
                <Outlet />
            </main>
        </div>
    )
}

export default AdminLayout
