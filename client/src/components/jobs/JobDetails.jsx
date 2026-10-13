import React from 'react'
import moment from 'moment'
import { assets } from '../../assets/assets'
import { sanitizeHtml } from '../../utils/sanitizeHtml'
import { companyName, experienceText, formatDate, postedAt, salaryText } from '../../utils/jobFormat'

const Section = ({ title, html }) => html ? (
    <div className='mt-8'>
        <h2 className='font-bold text-xl mb-3'>{title}</h2>
        <div className='rich-text' dangerouslySetInnerHTML={{ __html: sanitizeHtml(html) }}></div>
    </div>
) : null

const Fact = ({ label, value }) => value ? (
    <div>
        <dt className='text-xs uppercase tracking-wide text-gray-500'>{label}</dt>
        <dd className='text-gray-800'>{value}</dd>
    </div>
) : null

// Public job detail presentation. Used by the public ApplyJob page and by the
// admin preview so both render the same saved backend data.
const JobDetails = ({ job, actions, bottomAction, aside }) => {
    const salary = salaryText(job)
    const deadline = formatDate(job.applicationDeadline, { utc: true })
    const tags = [job.employmentType, job.workplaceType].filter(Boolean)
    const posted = postedAt(job)

    return (
        <div className='bg-white text-black rounded-lg w-full'>
            <div className='flex justify-center md:justify-between flex-wrap gap-8 px-6 sm:px-14 py-14 sm:py-20 mb-6 bg-sky-50 border border-sky-400 rounded-xl'>
                <div className='flex flex-col md:flex-row items-center'>
                    <img src={job.companyId?.image || assets.company_icon} alt='' className='h-24 bg-white rounded-lg p-4 mr-4 max-md:mb-4 border' />
                    <div className='text-center md:text-left text-neutral-700'>
                        <h1 className='text-2xl sm:text-4xl font-medium'>{job.title}</h1>
                        <div className='flex flex-row flex-wrap max-md:justify-center gap-y-2 gap-6 items-center text-gray-600 mt-2'>
                            <span className='flex items-center gap-1'><img src={assets.suitcase_icon} alt='' />{companyName(job)}</span>
                            {job.location && <span className='flex items-center gap-1'><img src={assets.location_icon} alt='' />{job.location}</span>}
                            {(job.experienceLevel || job.level) && <span className='flex items-center gap-1'><img src={assets.person_icon} alt='' />{job.experienceLevel || job.level}</span>}
                            {salary && <span className='flex items-center gap-1'><img src={assets.money_icon} alt='' />{salary}</span>}
                        </div>
                        {tags.length > 0 && (
                            <div className='flex flex-wrap gap-2 mt-3 max-md:justify-center text-xs'>
                                {tags.map(t => <span key={t} className='bg-white border border-sky-300 px-3 py-1 rounded'>{t}</span>)}
                            </div>
                        )}
                    </div>
                </div>

                <div className='flex flex-col justify-center text-end text-sm max-md:mx-auto max-md:text-center'>
                    {actions}
                    {posted && <p className='mt-1 text-gray-600'>Posted {moment(posted).fromNow()}</p>}
                    {deadline && <p className='mt-1 text-gray-600'>Apply by {deadline}</p>}
                </div>
            </div>

            <div className='flex flex-col lg:flex-row justify-between items-start'>
            <div className='w-full lg:w-2/3'>
                <dl className='grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8 text-sm'>
                    <Fact label='Reference' value={job.referenceId} />
                    <Fact label='Department' value={job.department} />
                    <Fact label='Experience' value={experienceText(job)} />
                    <Fact label='Vacancies' value={job.vacancies} />
                    <Fact label='Category' value={job.category} />
                    <Fact label='Deadline' value={deadline} />
                </dl>

                <h2 className='font-bold text-2xl mb-4'>Job description</h2>
                <div className='rich-text' dangerouslySetInnerHTML={{ __html: sanitizeHtml(job.description) }}></div>
                <Section title='Responsibilities' html={job.responsibilities} />
                <Section title='Qualifications' html={job.qualifications} />

                {job.skills?.length > 0 && (
                    <div className='mt-8'>
                        <h2 className='font-bold text-xl mb-3'>Skills</h2>
                        <div className='flex flex-wrap gap-2'>
                            {job.skills.map(s => <span key={s} className='bg-blue-50 border border-blue-200 px-3 py-1 rounded text-sm'>{s}</span>)}
                        </div>
                    </div>
                )}

                {(job.requiredDocuments || job.applicationInstructions) && (
                    <div className='mt-8'>
                        <h2 className='font-bold text-xl mb-3'>How to apply</h2>
                        {job.requiredDocuments && <p className='text-gray-600 mb-2 whitespace-pre-line'><span className='font-medium text-gray-800'>Required documents: </span>{job.requiredDocuments}</p>}
                        {job.applicationInstructions && <p className='text-gray-600 whitespace-pre-line'>{job.applicationInstructions}</p>}
                    </div>
                )}

                {bottomAction}
            </div>
            {aside && <div className='w-full lg:w-1/3 mt-8 lg:mt-0 lg:ml-8 space-y-5'>{aside}</div>}
            </div>
        </div>
    )
}

export default JobDetails
