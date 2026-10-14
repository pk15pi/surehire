import React, { useContext, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ClipboardList, PhoneCall, ArrowLeft } from 'lucide-react'
import PageLayout from '../components/PageLayout'
import usePageMeta from '../hooks/usePageMeta'
import HireRequestForm from '../components/HireRequestForm'
import { AppContext } from '../context/AppContext'

const FORM_ID = 'hire-request-form-section'

const wantsForm = (location) =>
    new URLSearchParams(location.search).get('mode') === 'form' || location.hash === '#form'

const HireEngineers = () => {
    usePageMeta('Hire Talent', 'Share your engineering hiring requirement with SureHire - role, location, positions and timeline.')
    const { setShowScheduleCall } = useContext(AppContext)
    const location = useLocation()
    const navigate = useNavigate()
    const [showForm, setShowForm] = useState(true) // full form shown by default; schedule-a-call stays available
    const formRef = useRef(null)
    const formCardRef = useRef(null)
    const shouldFocus = useRef(wantsForm(location))

    // React to deep links (?mode=form or #form) when navigating within the app
    const linkKey = location.search + location.hash
    const [prevLinkKey, setPrevLinkKey] = useState(linkKey)
    if (linkKey !== prevLinkKey) {
        setPrevLinkKey(linkKey)
        if (wantsForm(location)) setShowForm(true)
    }
    useEffect(() => {
        if (wantsForm(location)) shouldFocus.current = true
    }, [location])

    // Scroll to & focus the form after it is revealed
    useEffect(() => {
        if (showForm && shouldFocus.current && formRef.current) {
            shouldFocus.current = false
            formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
            formRef.current.focus({ preventScroll: true })
        }
    }, [showForm])

    const openForm = () => {
        shouldFocus.current = true
        if (showForm) {
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            formRef.current?.focus({ preventScroll: true })
        }
        setShowForm(true)
    }

    const backToChoice = () => {
        setShowForm(false)
        if (wantsForm(location)) navigate(location.pathname, { replace: true })
        requestAnimationFrame(() => formCardRef.current?.focus())
    }

    const cardClass = (active) =>
        `text-left w-full h-full flex gap-4 items-start border rounded-xl p-5 bg-white shadow-sm transition hover:border-blue-500 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${active ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`

    return (
    <PageLayout title='Hire Talent' subtitle='Tell us about the role and we will get back to you to discuss the requirement.'>
        <div className='max-w-4xl mx-auto'>
            <section aria-labelledby='hire-choice-title' className='mb-8'>
                <h2 id='hire-choice-title' className='text-lg font-semibold mb-1'>How would you like to share your requirement?</h2>
                <p className='text-sm text-gray-600 mb-4'>Choose whichever is easier for you - both reach our hiring team.</p>
                <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
                    <button type='button' ref={formCardRef} onClick={openForm}
                        aria-expanded={showForm} aria-controls={FORM_ID} className={cardClass(showForm)}>
                        <ClipboardList size={28} className='text-blue-600 shrink-0 mt-0.5' aria-hidden='true' />
                        <span>
                            <span className='block font-semibold text-gray-900'>Fill in full hiring details</span>
                            <span className='block text-sm text-gray-600 mt-1'>Share the role, location, positions, timeline and JD in one go so we can start sourcing right away.</span>
                        </span>
                    </button>
                    <button type='button' onClick={() => setShowScheduleCall({ iAm: 'employer' })}
                        aria-haspopup='dialog' className={cardClass(false)}>
                        <PhoneCall size={28} className='text-blue-600 shrink-0 mt-0.5' aria-hidden='true' />
                        <span>
                            <span className='block font-semibold text-gray-900'>Schedule a call instead</span>
                            <span className='block text-sm text-gray-600 mt-1'>Takes about 2 minutes to request - our team will call you to discuss your requirement.</span>
                        </span>
                    </button>
                </div>
            </section>

            <div id={FORM_ID} ref={formRef} tabIndex={-1} hidden={!showForm}
                aria-label='Full hiring details form' className='scroll-mt-24 focus:outline-none'>
                {showForm && (
                    <>
                        <button type='button' onClick={backToChoice}
                            className='mb-4 inline-flex items-center gap-1 text-sm text-blue-600 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded'>
                            <ArrowLeft size={16} aria-hidden='true' /> Back to options
                        </button>
                        <HireRequestForm />
                    </>
                )}
            </div>
        </div>
    </PageLayout>
    )
}

export default HireEngineers