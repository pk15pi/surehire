import { toast } from 'react-toastify'
import { adminJobAction, apiErrorMessage, deleteAdminJob, isAuthError } from '../../../admin/adminApi'

const CONFIRM = {
    archive: 'Archive this job? It will be hidden from the public site. Existing applications are kept.',
    unpublish: 'Unpublish this job? It will be hidden from the public site.',
}

// Runs a status action (publish/unpublish/archive/duplicate) or delete with confirmation.
// Returns the API response data on success, otherwise null.
export const runJobAction = async ({ backendUrl, job, action, onAuthError }) => {
    if (action === 'delete') {
        if (!window.confirm(`Permanently delete "${job.title}"? This cannot be undone.\n\nJobs with applications cannot be deleted - archive them instead.`)) return null
    } else if (CONFIRM[action] && !window.confirm(CONFIRM[action])) {
        return null
    }
    try {
        const { data } = action === 'delete'
            ? await deleteAdminJob(backendUrl, job._id)
            : await adminJobAction(backendUrl, job._id, action)
        toast.success(data.message || 'Done')
        return data
    } catch (error) {
        if (isAuthError(error)) { onAuthError(); return null }
        toast.error(apiErrorMessage(error, 'Action failed'))
        return null
    }
}
