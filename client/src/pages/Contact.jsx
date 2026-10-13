import React, { useContext } from 'react'
import { PhoneCall, Mail, Phone } from 'lucide-react'
import PageLayout from '../components/PageLayout'
import usePageMeta from '../hooks/usePageMeta'
import QuickEnquiryForm from '../components/QuickEnquiryForm'
import { AppContext } from '../context/AppContext'
import WhatsAppIcon from '../components/assistant/WhatsAppIcon'
import { CONTACT_EMAIL, mailHref, telHref, waHrefPlain, PHONE_DISPLAY, WHATSAPP_DISPLAY } from '../components/assistant/config'

const Contact = () => {
    usePageMeta('Contact Us', 'Contact SureHire by email, WhatsApp or phone, send a quick enquiry, or schedule a call with our team.')
    const { setShowScheduleCall } = useContext(AppContext)
    const item = 'flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400'
    return (
        <PageLayout title='Contact Us' subtitle="Email, WhatsApp or call us, send a quick enquiry, or schedule a call - we'll get back to you.">
            <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
                <div className='lg:col-span-2'>
                    <QuickEnquiryForm />
                </div>
                <div className='flex flex-col gap-4'>
                    <section aria-labelledby='contact-info-heading' className='border border-gray-200 rounded-xl p-6 shadow-sm'>
                        <h2 id='contact-info-heading' className='font-semibold text-lg'>Contact information</h2>
                        <ul className='mt-3 flex flex-col gap-1'>
                            <li>
                                <a href={mailHref} className={item}>
                                    <span className='w-9 h-9 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center'><Mail size={18} aria-hidden='true' /></span>
                                    <span><span className='block text-xs text-gray-500'>Email</span><span className='text-sm font-medium text-gray-800 break-all'>{CONTACT_EMAIL}</span></span>
                                </a>
                            </li>
                            {waHrefPlain && (
                                <li>
                                    <a href={waHrefPlain} target='_blank' rel='noopener noreferrer' aria-label={`WhatsApp ${WHATSAPP_DISPLAY} (opens in new tab)`} className={item}>
                                        <span className='w-9 h-9 shrink-0 rounded-full bg-[#25D366] text-white flex items-center justify-center'><WhatsAppIcon className='w-[18px] h-[18px]' /></span>
                                        <span><span className='block text-xs text-gray-500'>WhatsApp</span><span className='text-sm font-medium text-gray-800'>{WHATSAPP_DISPLAY}</span></span>
                                    </a>
                                </li>
                            )}
                            {telHref && (
                                <li>
                                    <a href={telHref} className={item}>
                                        <span className='w-9 h-9 shrink-0 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center'><Phone size={18} aria-hidden='true' /></span>
                                        <span><span className='block text-xs text-gray-500'>Call</span><span className='text-sm font-medium text-gray-800'>{PHONE_DISPLAY}</span></span>
                                    </a>
                                </li>
                            )}
                        </ul>
                    </section>
                    <div className='border border-gray-200 rounded-xl p-6 shadow-sm'>
                        <h3 className='font-semibold text-lg'>Prefer to talk?</h3>
                        <p className='text-sm text-gray-600 mt-2'>Pick a time that suits you and our team will call you.</p>
                        <button type='button' onClick={() => setShowScheduleCall(true)} className='mt-4 flex items-center gap-2 bg-blue-600 text-white px-5 py-2 rounded-md'>
                            <PhoneCall size={16} /> Schedule a Call
                        </button>
                    </div>
                </div>
            </div>
        </PageLayout>
    )
}

export default Contact
