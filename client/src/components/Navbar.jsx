import React, { useContext, useState } from 'react'
import { assets } from '../assets/assets'
import { useClerk, UserButton, useUser } from '@clerk/clerk-react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { AppContext } from '../context/AppContext'
import { Menu, X, PhoneCall } from "lucide-react";

const NAV_LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/about', label: 'About' },
  { to: '/industries', label: 'Industries' },
  { to: '/services', label: 'Services' },
  { to: '/jobs', label: 'Latest jobs' },
  { to: '/hire-engineers', label: 'For Employers' },
  { to: '/submit-resume', label: 'For Candidates' },
  { to: '/faq', label: 'FAQ' },
  { to: '/contact', label: 'Contact' },
]

const Navbar = () => {

  const { openSignIn } = useClerk()
  const { user } = useUser()

  const navigate = useNavigate()

  const { setShowRecruiterLogin, setShowScheduleCall } = useContext(AppContext)

  const [mobileOpen, setMobileOpen] = useState(false)

  const linkClass = ({ isActive }) =>
    `text-sm whitespace-nowrap hover:text-blue-600 ${isActive ? 'text-blue-600 font-medium' : 'text-gray-700'}`

  const openScheduleCall = () => {
    setMobileOpen(false)
    setShowScheduleCall(true)
  }

  const authArea = user
    ? <div className='flex items-center gap-3 text-sm'>
      <Link to={'/applications'} onClick={() => setMobileOpen(false)} className='whitespace-nowrap'>Applied Jobs</Link>
      <p className='max-xl:hidden'>|</p>
      <p className='max-xl:hidden whitespace-nowrap'>Hi, {user.firstName + " " + (user.lastName || '')}</p>
      <UserButton />
    </div>
    : <div className='flex items-center gap-4 text-sm'>
      <button onClick={() => { setMobileOpen(false); setShowRecruiterLogin(true) }} className='text-gray-600 whitespace-nowrap'>Recruiter Login</button>
      <button onClick={() => { setMobileOpen(false); openSignIn() }} className='border border-blue-600 text-blue-600 px-5 py-1.5 rounded-full'>Login</button>
    </div>

  return (
    <div className='shadow py-4 bg-white sticky top-0 z-40'>
      <div className='container px-4 2xl:px-20 mx-auto flex justify-between items-center gap-4'>
        <img onClick={() => navigate('/')} className='cursor-pointer max-sm:w-32' src={assets.logo} alt="SureHire" />

        {/* Desktop links */}
        <nav className='hidden lg:flex items-center gap-5' aria-label='Main'>
          {NAV_LINKS.map(l => <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>{l.label}</NavLink>)}
        </nav>

        <div className='flex items-center gap-3 lg:gap-4'>
          <div className='hidden lg:block'>{authArea}</div>
          <button onClick={openScheduleCall}
            className='flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 sm:px-5 py-2 rounded-full text-sm font-medium shadow whitespace-nowrap'>
            <PhoneCall size={16} /> <span className='max-[380px]:hidden'>Schedule a Call</span>
          </button>
          <button className='lg:hidden text-gray-700' onClick={() => setMobileOpen(o => !o)}
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'} aria-expanded={mobileOpen}>
            {mobileOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className='lg:hidden container px-4 mx-auto mt-4 border-t pt-4 flex flex-col gap-3'>
          {NAV_LINKS.map(l => (
            <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={() => setMobileOpen(false)}>{l.label}</NavLink>
          ))}
          <div className='border-t pt-3'>{authArea}</div>
        </div>
      )}
    </div>
  )
}

export default Navbar
