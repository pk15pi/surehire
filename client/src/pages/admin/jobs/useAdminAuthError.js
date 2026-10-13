import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { clearAdminSession } from '../../../admin/adminApi'

// Clears the admin session and returns to the login page on 401s
const useAdminAuthError = () => {
    const navigate = useNavigate()
    return useCallback(() => {
        clearAdminSession()
        toast.error('Your admin session has expired. Please log in again.')
        navigate('/admin/login', { replace: true })
    }, [navigate])
}

export default useAdminAuthError
