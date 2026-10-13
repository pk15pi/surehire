import React from 'react'
import { Link } from 'react-router-dom'

export const JobLoading = () => (
    <div className='flex justify-center py-16'><div className='w-10 h-10 border-4 border-gray-300 border-t-blue-400 rounded-full animate-spin' /></div>
)

export const JobNotFound = () => (
    <div className='bg-white border border-gray-200 rounded-lg py-16 text-center'>
        <h1 className='text-lg font-semibold mb-2'>Job not found</h1>
        <p className='text-gray-500 mb-4'>It may have been deleted, or the link is incorrect.</p>
        <Link to='/admin/jobs' className='text-blue-600 hover:underline'>Back to jobs</Link>
    </div>
)

export const JobError = ({ message, onRetry }) => (
    <div className='bg-red-50 border border-red-200 text-red-700 rounded px-4 py-3 text-sm flex items-center justify-between'>
        <span>{message}</span>
        <button type='button' onClick={onRetry} className='underline'>Retry</button>
    </div>
)
