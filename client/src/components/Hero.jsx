import React, { useContext, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { assets } from '../assets/assets'
import { AppContext } from '../context/AppContext'
import { INDUSTRIES } from './forms/formOptions'


const Hero = () => {

    const {setSearchFilter, setIsSearched} = useContext(AppContext)

    const navigate = useNavigate()

    const titleRef = useRef(null)
    const locationRef = useRef(null)

    const onSearch = () => {
        setSearchFilter({
            title: titleRef.current.value,
            location: locationRef.current.value
        })
        setIsSearched(true)
        // Job listing lives on its own page now
        navigate('/jobs')
        window.scrollTo(0, 0)
    }

    return (
        <div className='container 2xl:px-20 mx-auto my-10'>
            <div className='bg-linear-to-r from-purple-800 to-purple-950 text-white py-16 text-center mx-2 rounded-xl'>
                <p className='uppercase tracking-widest text-xs text-purple-200 mb-3'>Engineering Recruitment</p>
                <h1 className='text-2xl md:text-3xl lg:text-4xl font-medium mb-4 px-4'>Core Engineering Talent for the Industries That Build the World</h1>
                <p className='mb-8 max-w-2xl mx-auto text-sm font-light px-5'>SureHire connects employers with skilled engineers across energy, construction, manufacturing, process and other non-IT engineering sectors. Find your next role or tell us who you need to hire.</p>
                <div className='flex items-center justify-between bg-white rounded text-gray-600 max-w-xl pl-4 mx-4 sm:mx-auto'>
                    <div className='flex items-center border-r'>
                        <img className='h-4 sm:h-5' src={assets.search_icon} alt="" />
                        <input type="text" 
                        placeholder='Search engineering jobs' 
                        className='max-sm:text-xs p-2 rounded outline-none w-full'
                        ref={titleRef}/>
                    </div>
                    <div className='flex items-center'>
                        <img className='h-4 sm:h-5 pl-2' src={assets.location_icon} alt="" />
                        <input type="text" 
                        placeholder='Location' 
                        className='max-sm:text-xs p-2 rounded outline-none w-full' ref={locationRef}/>
                    </div>
                    <button onClick={onSearch} className='bg-blue-600 px-6 py-2 rounded text-white m-1'>Search</button>
                </div>
                <div className='flex flex-wrap justify-center gap-3 mt-6 px-4 text-sm'>
                    <Link to='/hire-engineers' className='bg-white text-purple-900 px-5 py-2 rounded-full font-medium hover:bg-purple-100'>Hire Engineers</Link>
                    <Link to='/submit-resume' className='border border-white px-5 py-2 rounded-full hover:bg-white/10'>Submit Your Resume</Link>
                </div>
            </div>

            {/* Industries we recruit for */}
            <div className='border border-gray-300 shadow-md mx-2 mt-5 p-6 rounded-md'>
                <div className='flex items-center justify-center gap-3 flex-wrap'>
                    <p className='font-medium mr-2'>Industries we recruit for</p>
                    {INDUSTRIES.filter(i => i.value !== 'other').map(i => (
                        <Link key={i.value} to='/industries' className='text-sm border border-gray-300 rounded-full px-3 py-1 text-gray-700 hover:border-blue-500 hover:text-blue-600'>{i.label}</Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Hero
