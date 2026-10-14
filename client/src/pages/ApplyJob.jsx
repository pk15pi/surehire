import React, { useRef, useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppContext } from '../context/AppContext';
import Loading from '../components/Loading';
import Navbar from "../components/Navbar";
import JobCard from '../components/JobCard';
import Footer from '../components/Footer';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useAuth } from '@clerk/clerk-react';
import JobDetails from '../components/jobs/JobDetails';
import { companyName } from '../utils/jobFormat';

const ApplyJob = () => {

  const { id } = useParams()

  const { getToken } = useAuth()

  const navigate = useNavigate()

  const [jobData, setJobData] = useState(null)
  const [isAlreadyApplied, setIsAlreadyApplied] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [answers, setAnswers] = useState([])
  const [showQuestions, setShowQuestions] = useState(false)

  const { jobs, backendUrl, userData, userApplications, fetchUserApplications } = useContext(AppContext)

  const fetchJob = async () => {

    try {

      const { data } = await axios.get(backendUrl + `/api/jobs/${id}`)

      if (data.success) {
        setNotFound(false)
        setJobData(data.job)
      } else {
        toast.error(data.message)
      }

    } catch (error) {
      // Draft, archived, expired or unknown jobs are not public
      if (error?.response?.status === 404) {
        setNotFound(true)
      } else {
        toast.error(error?.response?.data?.message || error.message)
      }
    }

  }

// Duplicate-submit guard: ignore clicks while a request is in flight
const [busy, setBusy] = useState(false)
const busyRef = useRef(false)
const applyHandler = async (...args) => {
  if (busyRef.current) { args[0]?.preventDefault?.(); return }
  busyRef.current = true; setBusy(true)
  try { return await applyHandlerRun(...args) } finally { busyRef.current = false; setBusy(false) }
}
const applyHandlerRun = async () => {
    try {

      if (!userData) {
        return toast.error("Login to apply for job")
      }

      if (!userData.resume) {
        navigate('/applications')
        return toast.error("Upload your resume to apply for job")
      }

      if (isAlreadyApplied) {
        return toast.info("You have already applied for this job")
      }

      // Jobs with screening questions: collect one answer per question first
      const questions = Array.isArray(jobData.screeningQuestions) ? jobData.screeningQuestions : []
      if (questions.length) {
        if (!showQuestions) {
          setShowQuestions(true)
          setTimeout(() => document.getElementById('screening-questions')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
          return
        }
        if (questions.some((_, i) => !(answers[i] || '').trim())) {
          return toast.error("Please answer all screening questions")
        }
      }

      const token = await getToken();

      const {data} = await axios.post(backendUrl+'/api/users/apply',
        { jobId: jobData._id, ...(questions.length ? { answers: questions.map((_, i) => answers[i].trim()) } : {}) },
        {headers: {Authorization: `Bearer ${token}`}}
      )

      if(data.success){
        toast.success(data.message)
        setShowQuestions(false)
        fetchUserApplications()
      } else{
        toast.error(data.message)
      }

    } catch (error) {
      toast.error(error?.response?.data?.message || error.message)
    }
}

const checkAlreadyApplied = () => {
  const hasApplied = userApplications.some( item => item.jobId && item.jobId._id === jobData._id)
  setIsAlreadyApplied(hasApplied)
}

  useEffect(() => {

    fetchJob()

  },[id])

  useEffect(()=>{
    if (userApplications.length > 0 && jobData) {
      checkAlreadyApplied()
    }
  },[jobData,userApplications, id])


  const screeningForm = () => (showQuestions && !isAlreadyApplied && jobData?.screeningQuestions?.length > 0) ? (
    <div id='screening-questions' className='mt-8 border border-blue-200 bg-blue-50/40 rounded-lg p-5 max-w-2xl'>
      <h2 className='font-medium text-lg mb-1'>Screening questions</h2>
      <p className='text-sm text-gray-600 mb-4'>Please answer these before submitting your application.</p>
      {jobData.screeningQuestions.map((q, i) => (
        <label key={i} className='block mb-4'>
          <span className='block text-sm font-medium text-gray-800 mb-1'>{i + 1}. {q} <span className='text-red-500'>*</span></span>
          <textarea
            rows={2}
            maxLength={2000}
            required
            value={answers[i] || ''}
            onChange={e => setAnswers(prev => { const next = [...prev]; next[i] = e.target.value; return next })}
            className='w-full border border-gray-300 rounded px-3 py-2 text-sm bg-white'
          />
        </label>
      ))}
      <button onClick={applyHandler} disabled={busy} className='disabled:opacity-60 bg-blue-600 p-2.5 px-10 text-white rounded'>Submit application</button>
    </div>
  ) : null

  const applyButton = (extra = '') => (
    <button onClick={applyHandler} disabled={busy} className={`disabled:opacity-60 bg-blue-600 p-2.5 px-10 text-white rounded ${extra}`}>{isAlreadyApplied ? 'Already Applied':'Apply Now'}</button>
  )

  // Other public jobs from the same company (or, for SureHire-posted jobs, other SureHire jobs)
  const sameOwner = (job) => jobData.companyId
    ? job.companyId && job.companyId._id === jobData.companyId._id
    : !job.companyId
  const appliedJobIds = new Set(userApplications.map(app => app.jobId && app.jobId._id))
  const moreJobs = jobData ? jobs.filter(job => job._id !== jobData._id && sameOwner(job) && !appliedJobIds.has(job._id)).slice(0, 4) : []

  if (notFound) {
    return (
      <>
        <Navbar />
        <div className='min-h-[60vh] flex flex-col items-center justify-center gap-4 container px-4 mx-auto text-center'>
          <h1 className='text-2xl font-medium'>This job is no longer available</h1>
          <p className='text-gray-600'>It may have been filled, closed or removed.</p>
          <button onClick={() => navigate('/')} className='bg-blue-600 text-white px-6 py-2 rounded'>Browse jobs</button>
        </div>
        <Footer />
      </>
    )
  }

  return jobData ? (
    <>
      <Navbar />

      <div className='min-h-screen flex flex-col py-10 container px-4 2xl:px-20 mx-auto'>
        <JobDetails
          job={jobData}
          actions={applyButton()}
          bottomAction={<>{applyButton('mt-10')}{screeningForm()}</>}
          aside={<>
            <h2>More jobs from {companyName(jobData)}</h2>
            {moreJobs.map((job) => <JobCard key={job._id} job={job} />)}
          </>}
        />
      </div>

      <Footer />
    </>
  ) : (
    <Loading />
  )
}

export default ApplyJob
