import React from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import usePageMeta from '../hooks/usePageMeta'
import CandidateSubmissionForm from '../components/CandidateSubmissionForm'

const SubmitResume = () => {
    usePageMeta('Submit Your Resume', 'Engineers can submit their resume to SureHire and be contacted when a matching core engineering role comes up.')
    return (
    <PageLayout title='Submit Your Resume' subtitle='Share your profile and we will contact you when a matching engineering role comes up.'>
        <div className='max-w-4xl'>
            <p className='text-sm text-gray-600 mb-6'>Looking to apply right away? <Link to='/jobs' className='text-blue-600 underline'>Browse current openings</Link>.</p>
            <CandidateSubmissionForm />
        </div>
    </PageLayout>
    )
}

export default SubmitResume
