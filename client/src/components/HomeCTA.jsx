import React from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, FileUp } from 'lucide-react'

// Two clear paths on the homepage: employers and candidates
const HomeCTA = () => (
    <section className='container px-4 2xl:px-20 mx-auto mt-16' aria-label='Get started'>
        <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
            <div className='border border-gray-200 rounded-xl p-8 shadow-sm bg-linear-to-br from-blue-50 to-white'>
                <Briefcase className='text-blue-600' size={28} />
                <h2 className='text-xl font-semibold mt-3'>Hiring engineers?</h2>
                <p className='text-sm text-gray-600 mt-2'>Tell us about the role, location and timeline. You can attach a job description and our team will get back to you to discuss the requirement.</p>
                <Link to='/hire-engineers' className='inline-block mt-5 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-md text-sm font-medium'>Hire Talent</Link>
            </div>
            <div className='border border-gray-200 rounded-xl p-8 shadow-sm bg-linear-to-br from-purple-50 to-white'>
                <FileUp className='text-purple-700' size={28} />
                <h2 className='text-xl font-semibold mt-3'>Looking for your next role?</h2>
                <p className='text-sm text-gray-600 mt-2'>Share your resume and engineering background. We will contact you when a role matching your discipline and experience comes up.</p>
                <Link to='/submit-resume' className='inline-block mt-5 bg-purple-700 hover:bg-purple-800 text-white px-5 py-2 rounded-md text-sm font-medium'>Submit Your Resume</Link>
            </div>
        </div>
    </section>
)

export default HomeCTA
