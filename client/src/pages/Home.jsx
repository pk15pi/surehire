import React from 'react'
import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Footer from '../components/Footer'
import QuickEnquiryForm from '../components/QuickEnquiryForm'
import HomeCTA from '../components/HomeCTA'
import usePageMeta from '../hooks/usePageMeta'

const Home = () => {
  usePageMeta(
    'Core Engineering Recruitment',
    'SureHire connects employers with skilled engineers across energy, construction, manufacturing, process and other core engineering sectors.'
  )
  return (
    <div>
      <Navbar />
      <Hero />
      <HomeCTA />
      <section id='enquiry' className='container px-4 2xl:px-20 mx-auto mt-16 max-w-4xl'>
        <QuickEnquiryForm />
      </section>
      <Footer />
    </div>
  )
}

export default Home
