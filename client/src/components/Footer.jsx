import React from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone } from 'lucide-react'
import { assets } from '../assets/assets'
import WhatsAppIcon from './assistant/WhatsAppIcon'
import { CONTACT_EMAIL, mailHref, telHref, waHrefPlain, PHONE_DISPLAY, WHATSAPP_DISPLAY } from './assistant/config'

const Footer = () => {
  return (
    <footer className='container px-4 2xl:px-20 mx-auto mt-20 border-t pt-6'>
      <div className='flex flex-wrap gap-x-6 text-sm text-gray-600 mb-4'>
        <Link to='/about' className='py-1 hover:text-blue-600'>About</Link>
        <Link to='/industries' className='py-1 hover:text-blue-600'>Industries</Link>
        <Link to='/services' className='py-1 hover:text-blue-600'>Services</Link>
        <Link to='/jobs' className='py-1 hover:text-blue-600'>Latest jobs</Link>
        <Link to='/hire-engineers' className='py-1 hover:text-blue-600'>For Employers</Link>
        <Link to='/submit-resume' className='py-1 hover:text-blue-600'>For Candidates</Link>
        <Link to='/faq' className='py-1 hover:text-blue-600'>FAQ</Link>
        <Link to='/contact' className='py-1 hover:text-blue-600'>Contact</Link>
      </div>
      <div className='flex flex-wrap gap-x-6 text-sm text-gray-600 mb-2'>
        <a href={mailHref} className='flex items-center gap-1.5 py-1 hover:text-blue-600'><Mail size={14} aria-hidden='true' />{CONTACT_EMAIL}</a>
        {waHrefPlain && <a href={waHrefPlain} target='_blank' rel='noopener noreferrer' aria-label={`WhatsApp ${WHATSAPP_DISPLAY} (opens in new tab)`} className='flex items-center gap-1.5 py-1 hover:text-green-700'><WhatsAppIcon className='w-3.5 h-3.5 text-[#25D366]' />WhatsApp {WHATSAPP_DISPLAY}</a>}
        {telHref && <a href={telHref} className='flex items-center gap-1.5 py-1 hover:text-blue-600'><Phone size={14} aria-hidden='true' />Call {PHONE_DISPLAY}</a>}
      </div>
      <div className='flex items-center justify-between gap-4 py-3'>
        <img width={160} src={assets.logo} alt="SureHire" />
        <p className='flex-1 border-l border-gray-400 pl-4 text-sm text-gray-500 max-sm:hidden'>&copy; {new Date().getFullYear()} SureHire | All rights reserved.</p>
        <div className='flex gap-2.5'>
          <img width={38} src={assets.facebook_icon} alt="Facebook" />
          <img width={38} src={assets.twitter_icon} alt="Twitter" />
          <img width={38} src={assets.instagram_icon} alt="Instagram" />
        </div>
      </div>
      <div className='text-right pb-3'>
        <Link to='/admin/login' rel='nofollow' className='text-[11px] text-gray-300 hover:text-gray-500'>Admin</Link>
      </div>
    </footer>
  )
}

export default Footer
