import React from 'react'
import { STATUS_STYLES } from '../../../admin/jobOptions'

const JobStatusBadge = ({ status }) => (
    <span className={`text-xs px-2 py-0.5 rounded-full capitalize whitespace-nowrap ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-700'}`}>
        {status || 'unknown'}
    </span>
)

export default JobStatusBadge
