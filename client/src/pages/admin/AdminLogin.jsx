import React, { useContext, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { AppContext } from '../../context/AppContext'
import { adminLoginRequest, getAdminToken, setAdminSession } from '../../admin/adminApi'
import usePageMeta from '../../hooks/usePageMeta'

const AdminLogin = () => {
    usePageMeta('Admin Login', 'SureHire admin', { noIndex: true })
    const { backendUrl } = useContext(AppContext)
    const navigate = useNavigate()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    if (getAdminToken()) return <Navigate to='/admin/dashboard' replace />

    const onSubmit = async (e) => {
        e.preventDefault()
        setError('')
        if (!email.trim() || !password) return setError('Email and password are required')
        setLoading(true)
        try {
            const { data } = await adminLoginRequest(backendUrl, email.trim(), password)
            if (data.success && data.token) {
                setAdminSession(data.token, data.email)
                setPassword('')
                navigate('/admin/dashboard', { replace: true })
            } else {
                setError(data.message || 'Login failed')
            }
        } catch (err) {
            const status = err?.response?.status
            const serverMessage = err?.response?.data?.message
            if (serverMessage) {
                setError(status === 503 ? `${serverMessage}. Check ADMIN_* settings in server/.env and restart the server.` : serverMessage)
            } else if (!err?.response) {
                setError(`Cannot reach the API at ${backendUrl || '(VITE_BACKEND_URL not set)'}. Is the server running?`)
            } else {
                setError(`Login failed (HTTP ${status}). Please try again.`)
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className='min-h-screen flex items-center justify-center bg-gray-50 px-4'>
            <form onSubmit={onSubmit} className='bg-white border border-gray-200 shadow-sm rounded-xl p-8 w-full max-w-sm flex flex-col gap-4' noValidate>
                <div className='flex items-center gap-2'>
                    <Lock size={20} className='text-blue-600' />
                    <h1 className='text-xl font-semibold'>SureHire Admin</h1>
                </div>
                <label className='text-sm flex flex-col gap-1'>
                    Email
                    <input type='email' autoComplete='username' value={email} onChange={e => setEmail(e.target.value)}
                        className='border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-500' required />
                </label>
                <label className='text-sm flex flex-col gap-1'>
                    Password
                    <input type='password' autoComplete='current-password' value={password} onChange={e => setPassword(e.target.value)}
                        className='border border-gray-300 rounded px-3 py-2 outline-none focus:border-blue-500' required />
                </label>
                {error && <p role='alert' className='text-sm text-red-600'>{error}</p>}
                <button type='submit' disabled={loading} className='bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded py-2'>
                    {loading ? 'Signing in...' : 'Sign in'}
                </button>
            </form>
        </div>
    )
}

export default AdminLogin
