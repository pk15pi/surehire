import React, { useContext, useEffect, useState } from 'react';
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

const applyHandler = async () => {
    try {

      if (!userData) {
        return toast.error("Login to apply for job")
      }

      if (!userData.resume) {
        navigate('/applications')
        return toast.error("Upload your resume to apply for job")
      }

      const token = await getToken();

      const {data} = await axios.post(backendUrl+'/api/users/apply',
        {jobId:  jobData._id },
        {headers: {Authorization: `Bearer ${token}`}}
      )

      if(data.success){
        toast.success(data.message)
        fetchUserApplications()
      } else{
        toast.error(data.message)
      }

    } catch (error) {
      toast.error(error.message)
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


  const applyButton = (extra = '') => (
    <button onClick={applyHandler} className={`bg-blue-600 p-2.5 px-10 text-white rounded ${extra}`}>{isAlreadyApplied ? 'Already Applied':'Apply Now'}</button>
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
          bottomAction={applyButton('mt-10')}
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
