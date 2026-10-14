import React, { useContext } from 'react'
import { AppContext } from '../context/AppContext'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import JobListing from '../components/JobListing'
import usePageMeta from '../hooks/usePageMeta'

// Public job listing page (search/filter state comes from AppContext, incl. the home hero search)
const Jobs = () => {
  usePageMeta('Latest Jobs', 'Browse the latest core engineering jobs from SureHire. Filter by category and location.')
  const { searchFilter, setSearchFilter, setIsSearched } = useContext(AppContext)
  const onSearch = e => { const title = e.target.value.slice(0, 100); setSearchFilter(prev => ({ ...prev, title })); setIsSearched(true) }
  return (
    <div>
      <Navbar />
      <div className='container mx-auto px-4 2xl:px-20 pt-8'>
        <h1 className='text-3xl font-semibold'>Latest Jobs</h1>
        <label htmlFor='jobs-search' className='sr-only'>Search jobs by keyword</label>
        <input id='jobs-search' type='search' value={searchFilter.title} onChange={onSearch} maxLength={100}
          placeholder='Search jobs by title or keyword' className='mt-4 w-full max-w-lg border border-gray-300 rounded px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500' />
      </div>
      <JobListing />
      <Footer />
    </div>
  )
}

export default Jobs
