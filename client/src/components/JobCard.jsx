import React from 'react'
import { assets } from '../assets/assets'
import { useNavigate } from 'react-router-dom'
import { htmlToText } from '../utils/sanitizeHtml'
import { formatDate, salaryText } from '../utils/jobFormat'

const JobCard = ( { job } ) => {

  const navigate = useNavigate()
  const open = () => { navigate(`/apply-job/${job._id}`); scrollTo(0,0) }
  const salary = salaryText(job)
  const deadline = formatDate(job.applicationDeadline, { utc: true })

  return (
    <div className='border-0 p-6 shadow rounded'>
        <div className='flex justify-between items-center  '>
            <img className='h-8' src={job.companyId?.image || assets.company_icon} alt="" />
            {job.featured && <span className='text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded'>Featured</span>}
        </div>
        <h4 className='font-medium text-xl mt-2'>{job.title}</h4>
        {!job.companyId && job.clientName && <p className='text-sm text-gray-500'>{job.clientName}</p>}
        <div className='flex flex-wrap items-center gap-3 mt-2
         text-xs'>
            {job.location && <span className='bg-blue-50 border border-blue-200 px-4 py-1.5 rounded '>{job.location}</span>}
            {(job.experienceLevel || job.level) && <span className='bg-red-50 border border-red-200 px-4 py-1.5 rounded '>{job.experienceLevel || job.level}</span>}
            {job.employmentType && <span className='bg-green-50 border border-green-200 px-4 py-1.5 rounded '>{job.employmentType}</span>}
            {job.workplaceType && job.workplaceType !== 'On-site' && <span className='bg-purple-50 border border-purple-200 px-4 py-1.5 rounded '>{job.workplaceType}</span>}
        </div>
        {(job.salaryMin != null || job.salaryMax != null || job.salaryUndisclosed || job.salaryNegotiable) && salary && <p className='text-sm text-gray-600 mt-3'>{salary}</p>}
        <p className='text-gray-500 text-sm mt-4'>{htmlToText(job.description, 150)}</p>
        {deadline && <p className='text-xs text-gray-500 mt-2'>Apply by {deadline}</p>}
        <div className='mt-4 flex gap-4 text-sm'>
            <button onClick={open} className='bg-blue-600 text-white px-4 py-2 rounded'>Apply now</button>
            <button onClick={open} className='text-gray-500 border border-gray-500 rounded px-4 py-2'>Learn more</button>
        </div>
    </div>
  )
}

export default JobCard
