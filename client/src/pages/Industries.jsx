import React from 'react'
import { Link } from 'react-router-dom'
import PageLayout from '../components/PageLayout'
import usePageMeta from '../hooks/usePageMeta'
import { INDUSTRIES } from '../components/forms/formOptions'

const DESCRIPTIONS = {
    'oil-gas': 'Upstream, midstream and downstream roles: piping, process, mechanical, instrumentation and HSE engineers.',
    'power-energy': 'Thermal, hydro and transmission & distribution: electrical, protection, commissioning and O&M engineers.',
    'renewables': 'Solar, wind and storage projects: design, site, electrical and project engineers.',
    'construction-infrastructure': 'Civil, structural, MEP, QA/QC and project management roles for buildings, roads, rail and more.',
    'manufacturing': 'Production, quality, maintenance, tooling and industrial engineering roles.',
    'automotive': 'Design, validation, manufacturing and supplier quality engineers.',
    'aerospace-defence': 'Mechanical, avionics, quality and manufacturing engineering roles.',
    'chemicals-process': 'Process, chemical, safety and plant operations engineers.',
    'mining-metals': 'Mining, metallurgical, maintenance and plant engineers.',
    'marine-offshore': 'Naval architecture, marine, offshore structural and commissioning roles.',
    'water-utilities': 'Water treatment, pipelines, pumping and utilities engineering roles.',
}

const Industries = () => {
    usePageMeta('Industries', 'Core engineering sectors SureHire recruits for, including oil & gas, power, renewables, construction, manufacturing and more.')
    return (
    <PageLayout title='Industries' subtitle='Core engineering sectors we recruit for.'>
        <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
            {INDUSTRIES.filter(i => DESCRIPTIONS[i.value]).map(i => (
                <div key={i.value} className='border border-gray-200 rounded-lg p-5 shadow-sm'>
                    <h3 className='font-semibold text-lg'>{i.label}</h3>
                    <p className='text-sm text-gray-600 mt-2'>{DESCRIPTIONS[i.value]}</p>
                </div>
            ))}
        </div>
        <div className='flex flex-wrap gap-3 mt-10'>
            <Link to='/hire-engineers' className='bg-blue-600 text-white px-5 py-2 rounded-md'>Hire Engineers</Link>
            <Link to='/submit-resume' className='border border-gray-300 px-5 py-2 rounded-md'>Submit Your Resume</Link>
        </div>
    </PageLayout>
    )
}

export default Industries
