import React, { useContext, useEffect, useState } from 'react'
import { AppContext } from '../context/AppContext'
import { assets } from '../assets/assets'
import { usePublicMasters } from '../admin/useMasters'

const FILTER_TYPES = ['categories', 'locations']
const lower = (v) => String(v || '').toLowerCase()
import JobCard from './JobCard'

const JobListing = () => {

    const { isSearched, searchFilter, setSearchFilter, jobs, backendUrl } = useContext(AppContext)
    // Filter options come from master data (active values only)
    const masters = usePublicMasters(backendUrl, FILTER_TYPES)
    const categoryOptions = masters.data.categories || []
    // Until the location master is seeded, fall back to distinct locations of the listed jobs
    const masterLocations = masters.data.locations || []
    const locationOptions = masterLocations.length || masters.loading ? masterLocations
        : [...new Set((jobs || []).map(j => (j.location || '').trim()).filter(Boolean))].sort().map(name => ({ _id: 'job-loc-' + name, name }))

    const [showFilter, setShowFilter] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const [selectedCategories, setSelectedCategories] = useState([])
    const [selectedLocations, setSelectedLocations] = useState([])

    const [filteredJobs, setFilteredJobs] = useState(jobs)

    const handleCategoryChange = (category) => {
        setSelectedCategories(
            prev => prev.some(c => c._id === category._id) ? prev.filter(c => c._id !== category._id) : [...prev, category]
        )
    }
    const handleLocationChange = (location) => {
        setSelectedLocations(
            prev => prev.some(c => c._id === location._id) ? prev.filter(c => c._id !== location._id) : [...prev, location]
        )
    }

    useEffect(() => {

        // Selected values are master records: match the linked id, or the label for older jobs
        const matchesCategory = job => selectedCategories.length === 0 || selectedCategories.some(c => String(job.categoryId || '') === c._id || lower(job.category) === lower(c.name))
        const locationText = job => `${job.location || ''} ${job.city || ''}`.toLowerCase()
        const matchesLocation = job => selectedLocations.length === 0 || selectedLocations.some(loc =>
            (job.locationIds || []).map(String).includes(loc._id) || locationText(job).includes(lower(loc.city || loc.name)))
        const matchesTitle = job => searchFilter.title === "" || (job.title || '').toLowerCase().includes(searchFilter.title.toLowerCase())
        const matchesSearchLocation = job => searchFilter.location === "" || locationText(job).includes(searchFilter.location.toLowerCase())

        const newFilteredJobs = jobs.slice().reverse().filter(
            job => matchesCategory(job) && matchesLocation(job) && matchesTitle(job) && matchesSearchLocation(job)
        )

        setFilteredJobs(newFilteredJobs)
        setCurrentPage(1)
    }, [jobs, selectedCategories, selectedLocations, searchFilter])

    return (
        <div className='container 2xl:px-20 mx-auto flex flex-col lg:flex-row max-lg:space-y-8 py-8'>

            {/* SideBar */}
            <div className='w-full lg:w-1/4 bg-white px-4'>

                {/* Search Filter From Hero */}
                {
                    isSearched && (searchFilter.title !== "" || searchFilter.location !== "") && (
                        <>
                            <h3 className='font-medium text-lg mb-4'>Current Search</h3>
                            <div className='mb-4 text-gray-600'>
                                {searchFilter.title && (
                                    <span className='inline-flex items-center gap-2.5 bg-blue-50 border border-blue-200 px-4 py-1.5 rounded'>
                                        {searchFilter.title}
                                        <img onClick={e => setSearchFilter(prev => ({ ...prev, title: "" }))} className='cursor-pointer' src={assets.cross_icon} alt="" />
                                    </span>
                                )}
                                {searchFilter.location && (
                                    <span className='ml-2 inline-flex items-center gap-2.5 bg-red-50 border border-red-200 px-4 py-1.5 rounded'>
                                        {searchFilter.location}
                                        <img onClick={e => setSearchFilter(prev => ({ ...prev, location: "" }))} className='cursor-pointer' src={assets.cross_icon} alt="" />
                                    </span>
                                )}
                            </div>
                        </>
                    )
                }

                <button onClick={e => setShowFilter(prev => !prev)} className='px-6 py-1.5 rounded border border-gray-400 lg:hidden'>
                    {showFilter ? "Close" : "Filters"}
                </button>

                {/* Category Filter */}
                <div className={showFilter ? "" : "max-lg:hidden"}>
                    <h4 className='font-medium text-lg py-4'>Search by Categories</h4>
                    <ul className='space-y-4 text-gray-600'>
                        {masters.loading && !categoryOptions.length && <li className='text-sm text-gray-400'>Loading...</li>}
                        {masters.error && <li className='text-sm text-gray-400'>Filters unavailable right now.</li>}
                        {
                            categoryOptions.map((category) => (
                                <li className='flex gap-3 items-center' key={category._id}>
                                    <input id={`cat-${category._id}`} className='scale-125' type="checkbox" onChange={() => handleCategoryChange(category)}
                                        checked={selectedCategories.some(c => c._id === category._id)} />
                                    <label htmlFor={`cat-${category._id}`}>{category.name}</label>
                                </li>
                            ))
                        }
                    </ul>
                </div>

                {/* Location Filter */}
                <div className={showFilter ? "" : "max-lg:hidden"}>
                    <h4 className='font-medium text-lg py-4 pt-14'>Search by Location</h4>
                    <ul className='space-y-4 text-gray-600'>
                        {
                            locationOptions.map((location) => (
                                <li className='flex gap-3 items-center' key={location._id}>
                                    <input id={`loc-${location._id}`} className='scale-125' type="checkbox" onChange={() => handleLocationChange(location)}
                                        checked={selectedLocations.some(c => c._id === location._id)} />
                                    <label htmlFor={`loc-${location._id}`}>{location.city || location.name}</label>
                                </li>
                            ))
                        }
                    </ul>
                </div>
            </div>

            {/* Job Listings */}
            <section className='w-full lg:w-3/4 text-gray-800 max-lg:px-4'>
                <h3 className='font-medium text-3xl py-2' id='job-list'>Latest jobs</h3>
                <p className='mb-8'>Get your desired job from top companies</p>
                <div className='grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'>
                    {filteredJobs.slice((currentPage - 1) * 6, currentPage * 6).map((job, index) => (
                        <JobCard key={index} job={job} />

                    ))}
                </div>

                {/* Pagination */}
                {filteredJobs.length > 0 && (
                    <div className='flex items-center justify-center space-x-2 mt-10'>
                        <a href="#job-list">
                            <img onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))} src={assets.left_arrow_icon} alt="" />
                        </a>
                        {Array.from({ length: Math.ceil(filteredJobs.length / 6) }).map((_, index) => (
                            <a key={index} href="#job-list">
                                <button onClick={() => setCurrentPage(index + 1)} className={`w-10 h-10 flex items-center justify-center border border-gray-300 rounded ${currentPage === index + 1 ? 'bg-blue-100 text-blue-500' : 'text-gray-500'}`}>{index + 1}</button>
                            </a>
                        ))}
                        <a href="#job-list">
                            <img onClick={() => setCurrentPage(Math.min(currentPage + 1, Math.ceil(filteredJobs.length / 6)))} src={assets.right_arrow_icon} alt="" />
                        </a>
                    </div>
                )}
            </section>

        </div>
    )
}

export default JobListing
