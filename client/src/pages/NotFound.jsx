import React from 'react'
import { Link } from 'react-router-dom'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import usePageMeta from '../hooks/usePageMeta'

// Shown for any unknown URL (previously a blank page under the navbar-less layout)
const NotFound = () => {
  usePageMeta('Page not found', 'The page you are looking for does not exist.', { noIndex: true })
  return (
    <div>
      <Navbar />
      <div className='min-h-[60vh] flex flex-col items-center justify-center gap-4 container px-4 mx-auto text-center'>
        <h1 className='text-2xl font-medium'>Page not found</h1>
        <p className='text-gray-600'>The page you are looking for doesn&apos;t exist or has moved.</p>
        <div className='flex flex-wrap gap-3 justify-center'>
          <Link to='/' className='bg-blue-600 text-white px-6 py-2 rounded'>Go to home</Link>
          <Link to='/jobs' className='border border-blue-600 text-blue-600 px-6 py-2 rounded'>Browse jobs</Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default NotFound
