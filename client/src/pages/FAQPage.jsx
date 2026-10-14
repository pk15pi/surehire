import React from 'react'
import Navbar from '../components/Navbar'
import Footer from '../components/Footer'
import FAQ from '../components/FAQ'
import usePageMeta from '../hooks/usePageMeta'

const FAQPage = () => {
  usePageMeta('FAQ', 'Answers to common questions about hiring engineers and submitting your resume with SureHire.')
  return (
    <div>
      <Navbar />
      <h1 className='container mx-auto px-4 2xl:px-20 pt-8 text-3xl font-semibold'>FAQ</h1>
      <FAQ />
      <Footer />
    </div>
  )
}

export default FAQPage
