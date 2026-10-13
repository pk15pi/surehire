import { useCallback, useContext, useEffect, useState } from 'react'
import { AppContext } from '../../../context/AppContext'
import { apiErrorMessage, getAdminJob, isAuthError } from '../../../admin/adminApi'
import useAdminAuthError from './useAdminAuthError'

// Loads one job for the admin pages. state: 'loading' | 'ready' | 'notFound' | 'error'
const useAdminJob = (id) => {
    const { backendUrl } = useContext(AppContext)
    const onAuthError = useAdminAuthError()
    const [job, setJob] = useState(null)
    const [state, setState] = useState('loading')
    const [error, setError] = useState('')
    const [attempt, setAttempt] = useState(0)

    useEffect(() => {
        let active = true
        getAdminJob(backendUrl, id)
            .then(({ data }) => {
                if (!active) return
                setJob(data.job)
                setState('ready')
            })
            .catch((err) => {
                if (!active) return
                if (isAuthError(err)) return onAuthError()
                const code = err?.response?.status
                if (code === 404 || code === 400) return setState('notFound')
                setError(apiErrorMessage(err, 'Could not load job'))
                setState('error')
            })
        return () => { active = false }
    }, [backendUrl, id, attempt, onAuthError])

    const reload = useCallback(() => { setState('loading'); setAttempt(a => a + 1) }, [])

    return { job, setJob, state, error, reload, onAuthError }
}

export default useAdminJob
