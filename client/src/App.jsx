import React, { useContext } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import ApplyJob from './pages/ApplyJob'
import Applications from './pages/Applications'
import RecruiterLogin from './components/RecruiterLogin'
import { AppContext } from './context/AppContext'
import Dashboard from './pages/Dashboard'
import AddJob from './pages/AddJob'
import ManageJobs from './pages/ManageJobs'
import ViewApplications from './pages/ViewApplications'
import About from './pages/About'
import Industries from './pages/Industries'
import Services from './pages/Services'
import Contact from './pages/Contact'
import HireEngineers from './pages/HireEngineers'
import SubmitResume from './pages/SubmitResume'
import Jobs from './pages/Jobs'
import FAQPage from './pages/FAQPage'
import ScheduleCallModal from './components/ScheduleCallModal'
import HelpDock from './components/assistant/HelpDock'
import AdminLogin from './pages/admin/AdminLogin'
import AdminLayout from './pages/admin/AdminLayout'
import AdminSubmissions from './pages/admin/AdminSubmissions'
import AdminJobs from './pages/admin/jobs/AdminJobs'
import { AdminJobCreate, AdminJobEdit } from './pages/admin/jobs/AdminJobEditor'
import AdminJobView from './pages/admin/jobs/AdminJobView'
import AdminJobPreview from './pages/admin/jobs/AdminJobPreview'
import 'quill/dist/quill.snow.css'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

const App = () => {

  const { showRecruiterLogin, companyToken } = useContext(AppContext)

  return (
    <div>
      { showRecruiterLogin && <RecruiterLogin /> }
      <ScheduleCallModal />
      <ToastContainer />
      <HelpDock />
      <Routes>
        <Route path='/' element={<Home />} />
        <Route path='/about' element={<About />} />
        <Route path='/industries' element={<Industries />} />
        <Route path='/services' element={<Services />} />
        <Route path='/contact' element={<Contact />} />
        <Route path='/hire-engineers' element={<HireEngineers />} />
        <Route path='/submit-resume' element={<SubmitResume />} />
        <Route path='/jobs' element={<Jobs />} />
        <Route path='/faq' element={<FAQPage />} />
        <Route path='/apply-job/:id' element={<ApplyJob />} />
        <Route path='/applications' element={<Applications />} />
        <Route path='/admin/login' element={<AdminLogin />} />
        <Route path='/admin' element={<AdminLayout />}>
          <Route index element={<Navigate to='calls' replace />} />
          <Route path='jobs' element={<AdminJobs />} />
          <Route path='jobs/new' element={<AdminJobCreate />} />
          <Route path='jobs/:id' element={<AdminJobView />} />
          <Route path='jobs/:id/edit' element={<AdminJobEdit />} />
          <Route path='jobs/:id/preview' element={<AdminJobPreview />} />
          <Route path=':section' element={<AdminSubmissions />} />
        </Route>
        <Route path='/dashboard' element={<Dashboard />}>
          {companyToken ? <>
          <Route path='add-job' element={<AddJob />} />
          <Route path='manage-jobs' element={<ManageJobs />} />
          <Route path='view-applications' element={<ViewApplications />} />
          </> : null
          }
          
        </Route>
      </Routes>
    </div>
  )
}

export default App
