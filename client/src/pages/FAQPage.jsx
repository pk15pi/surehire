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
      <FAQ />
      <Footer />
    </div>
  )
}

export default FAQPage
