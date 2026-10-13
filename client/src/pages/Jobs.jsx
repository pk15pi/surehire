import React from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import JobListing from '../components/JobListing'
import usePageMeta from '../hooks/usePageMeta'

// Public job listing page (search/filter state comes from AppContext, incl. the home hero search)
const Jobs = () => {
  usePageMeta('Latest Jobs', 'Browse the latest core engineering jobs from SureHire. Filter by category and location.')
  return (
    <div>
      <Navbar />
      <JobListing />
      <Footer />
    </div>
  )
}

export default Jobs
