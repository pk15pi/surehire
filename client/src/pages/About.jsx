import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import usePageMeta from '../hooks/usePageMeta'
import { AppContext } from '../context/AppContext'

const About = () => {
    usePageMeta('About', 'SureHire is a recruitment partner focused on core (non-IT) engineering talent across energy, construction, manufacturing and heavy industry.')
    const { setShowScheduleCall } = useContext(AppContext)
    return (
        <PageLayout title='About SureHire' subtitle='A recruitment partner focused on core (non-IT) engineering talent.'>
            <div className='max-w-3xl flex flex-col gap-5 text-gray-700 leading-relaxed'>
                <p>SureHire helps employers find engineers for technical, site and plant roles, and helps engineers find opportunities that match their discipline and experience.</p>
                <p>We focus on core engineering disciplines such as mechanical, electrical, civil, instrumentation, process and chemical engineering, across industries including energy, construction, manufacturing and heavy industry.</p>
                <h2 className='text-xl font-semibold text-gray-900 mt-4'>How we work</h2>
                <ul className='list-disc ml-6 flex flex-col gap-2'>
                    <li>We start by understanding the role, the site or project context, and the skills that matter.</li>
                    <li>We search and screen candidates against those requirements before sharing profiles.</li>
                    <li>We coordinate interviews and support both sides through to an offer.</li>
                </ul>
                <div className='flex flex-wrap gap-3 mt-4'>
                    <button onClick={() => setShowScheduleCall(true)} className='bg-blue-600 text-white px-5 py-2 rounded-md'>Schedule a Call</button>
                    <Link to='/contact' className='border border-gray-300 px-5 py-2 rounded-md'>Contact Us</Link>
                </div>
            </div>
        </PageLayout>
    )
}

export default About
