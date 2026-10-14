import React, { useRef, useContext, useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import { assets, jobsApplied } from '../assets/assets'
import moment from 'moment'
import Footer from '../components/Footer'
import { useAuth, useUser } from '@clerk/clerk-react'
import { toast } from 'react-toastify'
import { AppContext } from '../context/AppContext'
import axios from 'axios'

const Applications = () => {
  
  const {user} = useUser()
  const {getToken} = useAuth()

  const [isEdit, setIsEdit] = useState(false)
  const [resume, setResume] = useState(null)

  const {backendUrl, userData, userApplications, fetchUserData, fetchUserApplications} = useContext(AppContext)

  // Duplicate-submit guard: ignore clicks while a request is in flight
const [busy, setBusy] = useState(false)
const busyRef = useRef(false)
const updateResume = async (...args) => {
  if (busyRef.current) { args[0]?.preventDefault?.(); return }
  busyRef.current = true; setBusy(true)
  try { return await updateResumeRun(...args) } finally { busyRef.current = false; setBusy(false) }
}
const updateResumeRun = async () => {

    try {
      
      if (!resume) {
        return toast.error('Please select a PDF resume')
      }
      // The API runs on Vercel, which rejects uploads over 4.5 MB; the server allows up to 4 MB
      if (resume.type !== 'application/pdf' || !/\.pdf$/i.test(resume.name)) {
        return toast.error('Resume must be a PDF file')
      }
      if (resume.size > 4 * 1024 * 1024) {
        return toast.error('Resume is too large. Maximum size is 4 MB')
      }

      const formData = new FormData()
      formData.append('resume', resume)

      const token = await getToken()

      const {data} = await axios.post(backendUrl+'/api/users/update-resume',
        formData,
        { headers: { 'Authorization': `Bearer ${token}` } }
      )

      if(data.success){
        toast.success(data.message)
        await fetchUserData()
      } else{
        toast.error(data.message)
      }

    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    }

    setIsEdit(false)
    setResume(null)

  }

  useEffect(()=>{
    if (user) {
      fetchUserApplications()
    }
  },[user])

  return (
    <>
      <Navbar />
      <div className='container px-4 min-h-[65vh] 2xl:px-20 mx-auto my-10'>
        <h2 className='text-xl font-semibold'>Your Resume</h2>
        <div className='flex gap-2 mb-6 mt-3'>
          {
            isEdit || userData && userData.resume === ""
              ? <>
                <label htmlFor="resumeUpload" className='flex items-center cursor-pointer'>
                  <p className='bg-blue-100 text-blue-600 px-4 py-2 rounded-lg mr-2'>{resume ? resume.name : "Select Resume"}</p>
                  <input id='resumeUpload' onChange={e => setResume(e.target.files[0])} accept='application/pdf' type="file" name="" hidden />
                  <img src={assets.profile_upload_icon} alt="" />
                </label>
                <button onClick={updateResume} disabled={busy} className='disabled:opacity-60 bg-green-100 border-green-400 rounded-lg px-4 py-2 cursor-pointer'>Save</button>
              </>
              : <div className='flex gap-2'>
                <a href={userData.resume} target='_blank' className='bg-blue-100 text-blue-600 px-4 py-2 rounded-lg'>
                  Resume
                </a>
                <button onClick={() => setIsEdit(true)} className='text-gray-500 border border-gray-300 rounded-lg px-4 py-2 cursor-pointer'>Edit</button>
              </div>
          }
        </div>
        <h2 className='text-xl font-semibold mb-4'>Jobs Applied</h2>
        <table className='min-w-full bg-white border-0 rounded-lg shadow'>
          <thead>
            <tr>
              <th className='py-3 px-4 border-b-0 shadow text-left'>Company</th>
              <th className='py-3 px-4 border-b-0 shadow text-left'>Job Title</th>
              <th className='py-3 px-4 border-b-0 shadow text-left max-sm:hidden'>Location</th>
              <th className='py-3 px-4 border-b-0 shadow text-left max-sm:hidden'>Date</th>
              <th className='py-3 px-4 border-b-0 shadow text-left'>Status</th>
            </tr>
          </thead>
          <tbody>
            {userApplications.map((job, index) => true ? (
              <tr key={index}>
                <td className='py-3 px-4 flex items-center gap-2 border-b-0'>
                  <img className='w-8 h-8' src={job.companyId?.image || assets.company_icon} alt="" />
                  {job.companyId?.name || job.jobId?.clientName || 'SureHire'}
                </td>
                <td className='py-2 px-4 border-b-0'>{job.jobId?.title || 'Job removed'}</td>
                <td className='py-2 px-4 border-b-0 max-sm:hidden'>{job.jobId?.location}</td>
                <td className='py-2 px-4 border-b-0 max-sm:hidden'>{moment(job.date).format('ll')}</td>
                <td className='py-2 px-4 border-b-0'>
                  <span className={`${job.status === 'Accepted' ? 'bg-green-100' : job.status === 'Rejected' ? 'bg-red-100' : 'bg-blue-100'} px-4 py-1.5 rounded `}>
                    {job.status}
                  </span>
                </td>
              </tr>
            ) : (null))}
          </tbody>
        </table>
      </div>
      <Footer />
    </>
  )
}

export default Applications
