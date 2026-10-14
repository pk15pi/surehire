import { useCallback, useEffect, useState } from 'react'
import { apiErrorMessage, isAuthError } from '../../../admin/adminApi'
import useAdminAuthError from '../jobs/useAdminAuthError'

/**
 * Loads data for an admin page. `request` must be memoised (useCallback);
 * it re-runs whenever it changes. Returns { data, loading, error, reload, setData }.
 */
const useAdminFetch = (request, fallbackError = 'Could not load data') => {
    const onAuthError = useAdminAuthError()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [notFound, setNotFound] = useState(false)

    const reload = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await request()
            setData(res.data)
            setNotFound(false)
        } catch (err) {
            if (isAuthError(err)) return onAuthError()
            if (err?.response?.status === 404) setNotFound(true)
            setError(apiErrorMessage(err, fallbackError))
        } finally {
            setLoading(false)
        }
    }, [request, onAuthError, fallbackError])

    useEffect(() => { reload() }, [reload])
    return { data, loading, error, notFound, reload, setData }
}

export default useAdminFetch
