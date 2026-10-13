import React, { useContext } from 'react'
import { Link } from 'react-router-dom'
import { Briefcase, Users, ClipboardCheck, HardHat } from 'lucide-react'
import PageLayout from '../components/PageLayout'
import usePageMeta from '../hooks/usePageMeta'
import { AppContext } from '../context/AppContext'

const SERVICES = [
    { icon: Briefcase, title: 'Permanent Recruitment', text: 'Full-time engineering hires, from graduate engineers to senior technical and management roles.' },
    { icon: HardHat, title: 'Contract & Project Staffing', text: 'Engineers for fixed-term projects, shutdowns, commissioning and site work.' },
    { icon: Users, title: 'Volume / Team Hiring', text: 'Multiple positions for new plants, sites or project mobilisations.' },
    { icon: ClipboardCheck, title: 'Screening & Shortlisting', text: 'Technical screening of candidates against your requirements before profiles are shared.' },
]

const Services = () => {
    usePageMeta('Services', 'Permanent recruitment, contract and project staffing, team hiring and technical screening for core engineering roles.')
    const { setShowScheduleCall } = useContext(AppContext)
    return (
        <PageLayout title='Services' subtitle='Recruitment support for core engineering roles.'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
                {SERVICES.map(({ icon: Icon, title, text }) => (
                    <div key={title} className='border border-gray-200 rounded-lg p-6 shadow-sm flex gap-4'>
                        <Icon className='text-blue-600 shrink-0' size={28} />
                        <div>
                            <h3 className='font-semibold text-lg'>{title}</h3>
                            <p className='text-sm text-gray-600 mt-1'>{text}</p>
                        </div>
                    </div>
                ))}
            </div>
            <div className='flex flex-wrap gap-3 mt-10'>
                <Link to='/hire-engineers' className='bg-blue-600 text-white px-5 py-2 rounded-md'>Share a Requirement</Link>
                <button onClick={() => setShowScheduleCall(true)} className='border border-gray-300 px-5 py-2 rounded-md'>Schedule a Call</button>
            </div>
        </PageLayout>
    )
}

export default Services
