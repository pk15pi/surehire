import axios from 'axios'

// Admin session is kept separate from the recruiter `companyToken`.
const TOKEN_KEY = 'adminToken'
const EMAIL_KEY = 'adminEmail'

const decodeExp = (token) => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
        return typeof payload.exp === 'number' ? payload.exp * 1000 : 0
    } catch {
        return 0
    }
}

export const clearAdminSession = () => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
}

// Returns the stored token only if it has not expired (server re-verifies on every call)
export const getAdminToken = () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) return null
    if (decodeExp(token) <= Date.now()) {
        clearAdminSession()
        return null
    }
    return token
}

export const getAdminEmail = () => localStorage.getItem(EMAIL_KEY) || ''

export const setAdminSession = (token, email) => {
    localStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(EMAIL_KEY, email || '')
}

export const adminLoginRequest = (backendUrl, email, password) =>
    axios.post(`${backendUrl}/api/admin/login`, { email, password })

// Authenticated request helper
export const adminRequest = (backendUrl, config) => {
    const token = getAdminToken()
    return axios({
        ...config,
        url: `${backendUrl}/api/admin${config.url}`,
        headers: { ...(config.headers || {}), Authorization: `Bearer ${token || ''}` },
    })
}

export const isAuthError = (error) => error?.response?.status === 401

// ---------------------------------------------------------------------------
// Job management (all require an admin session)
// ---------------------------------------------------------------------------
export const listAdminJobs = (backendUrl, params) => adminRequest(backendUrl, { method: 'get', url: '/jobs', params })
export const getAdminJob = (backendUrl, id) => adminRequest(backendUrl, { method: 'get', url: `/jobs/${encodeURIComponent(id)}` })
export const createAdminJob = (backendUrl, data) => adminRequest(backendUrl, { method: 'post', url: '/jobs', data })
export const updateAdminJob = (backendUrl, id, data) => adminRequest(backendUrl, { method: 'patch', url: `/jobs/${encodeURIComponent(id)}`, data })
export const deleteAdminJob = (backendUrl, id) => adminRequest(backendUrl, { method: 'delete', url: `/jobs/${encodeURIComponent(id)}` })
// action: 'publish' | 'unpublish' | 'archive' | 'duplicate'
export const adminJobAction = (backendUrl, id, action) => adminRequest(backendUrl, { method: 'post', url: `/jobs/${encodeURIComponent(id)}/${action}` })

// Job applications + overview
export const listAdminApplications = (backendUrl, params) => adminRequest(backendUrl, { method: 'get', url: '/applications', params })
export const updateAdminApplication = (backendUrl, id, status) => adminRequest(backendUrl, { method: 'patch', url: `/applications/${encodeURIComponent(id)}`, data: { status } })
export const getAdminOverview = (backendUrl) => adminRequest(backendUrl, { method: 'get', url: '/overview' })

// Server error message (falls back to a generic one)
export const apiErrorMessage = (error, fallback = 'Something went wrong') =>
    error?.response?.data?.message || (error?.response ? fallback : 'Network error. Please check your connection.')

// ---------------------------------------------------------------------------
// Dashboard, candidates, applications, audit logs, master data
// ---------------------------------------------------------------------------
export const getAdminDashboard = (backendUrl) => adminRequest(backendUrl, { method: 'get', url: '/dashboard' })
export const listAdminCandidates = (backendUrl, params) => adminRequest(backendUrl, { method: 'get', url: '/candidates', params })
export const getAdminCandidate = (backendUrl, id) => adminRequest(backendUrl, { method: 'get', url: `/candidates/${encodeURIComponent(id)}` })
export const updateAdminApplicationStatus = (backendUrl, id, status) => adminRequest(backendUrl, { method: 'patch', url: `/applications/${encodeURIComponent(id)}`, data: { status } })
export const listAdminAuditLogs = (backendUrl, params) => adminRequest(backendUrl, { method: 'get', url: '/audit-logs', params })

// Recruiter / company accounts
export const listAdminCompanies = (backendUrl, params) => adminRequest(backendUrl, { method: 'get', url: '/companies', params })
export const createAdminCompany = (backendUrl, data) => adminRequest(backendUrl, { method: 'post', url: '/companies', data })
export const updateAdminCompany = (backendUrl, id, data) => adminRequest(backendUrl, { method: 'patch', url: `/companies/${encodeURIComponent(id)}`, data })

export const listMasterTypes = (backendUrl) => adminRequest(backendUrl, { method: 'get', url: '/master' })
export const listMaster = (backendUrl, type, params) => adminRequest(backendUrl, { method: 'get', url: `/master/${encodeURIComponent(type)}`, params })
export const createMaster = (backendUrl, type, data) => adminRequest(backendUrl, { method: 'post', url: `/master/${encodeURIComponent(type)}`, data })
export const updateMaster = (backendUrl, type, id, data) => adminRequest(backendUrl, { method: 'patch', url: `/master/${encodeURIComponent(type)}/${encodeURIComponent(id)}`, data })
export const deleteMaster = (backendUrl, type, id) => adminRequest(backendUrl, { method: 'delete', url: `/master/${encodeURIComponent(type)}/${encodeURIComponent(id)}` })
// action: 'activate' | 'deactivate'
export const setMasterActive = (backendUrl, type, id, active) => adminRequest(backendUrl, { method: 'post', url: `/master/${encodeURIComponent(type)}/${encodeURIComponent(id)}/${active ? 'activate' : 'deactivate'}` })
