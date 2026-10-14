import React, { Suspense, lazy, useContext, useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home'
import ApplyJob from './pages/ApplyJob'
import Applications from './pages/Applications'
import RecruiterLogin from './components/RecruiterLogin'
import { AppContext } from './context/AppContext'
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
import AdminLayout, { EnquiriesLayout, LegacySectionRedirect } from './pages/admin/AdminLayout'
import NotFound from './pages/NotFound'
import Loading from './components/Loading'
import 'quill/dist/quill.snow.css'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

// Route-level code splitting: admin + recruiter dashboard (Quill-heavy) load on demand
const Dashboard = lazy(() => import('./pages/Dashboard'))
const AddJob = lazy(() => import('./pages/AddJob'))
const ManageJobs = lazy(() => import('./pages/ManageJobs'))
const ViewApplications = lazy(() => import('./pages/ViewApplications'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const AdminCandidates = lazy(() => import('./pages/admin/AdminCandidates').then(m => ({ default: m.AdminCandidates })))
const AdminCandidateDetail = lazy(() => import('./pages/admin/AdminCandidates').then(m => ({ default: m.AdminCandidateDetail })))
const AdminApplications = lazy(() => import('./pages/admin/AdminApplications'))
const MasterDataIndex = lazy(() => import('./pages/admin/MasterData').then(m => ({ default: m.MasterDataIndex })))
const MasterDataPage = lazy(() => import('./pages/admin/MasterData').then(m => ({ default: m.MasterDataPage })))
const AdminAuditLogs = lazy(() => import('./pages/admin/AdminAuditLogs'))
const AdminSubmissions = lazy(() => import('./pages/admin/AdminSubmissions'))
const AdminJobs = lazy(() => import('./pages/admin/jobs/AdminJobs'))
const AdminJobCreate = lazy(() => import('./pages/admin/jobs/AdminJobEditor').then(m => ({ default: m.AdminJobCreate })))
const AdminJobEdit = lazy(() => import('./pages/admin/jobs/AdminJobEditor').then(m => ({ default: m.AdminJobEdit })))
const AdminJobView = lazy(() => import('./pages/admin/jobs/AdminJobView'))
const AdminJobPreview = lazy(() => import('./pages/admin/jobs/AdminJobPreview'))

const App = () => {

  const { showRecruiterLogin, setShowRecruiterLogin, companyToken } = useContext(AppContext)
  // Recruiter login is no longer in the nav; existing recruiters can open it via /?recruiter-login.
  // Email confirmation links land on /?recruiter-verify=<token> and open the same modal.
  const { search } = useLocation()
  useEffect(() => { const p = new URLSearchParams(search); if (p.has('recruiter-login') || p.has('recruiter-verify')) setShowRecruiterLogin(true) }, [search, setShowRecruiterLogin])

  return (
    <div>
      { showRecruiterLogin && <RecruiterLogin /> }
      <ScheduleCallModal />
      <ToastContainer />
      <HelpDock />
      <Suspense fallback={<Loading />}>
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
          <Route index element={<Navigate to='dashboard' replace />} />
          <Route path='dashboard' element={<AdminDashboard />} />
          <Route path='candidates' element={<AdminCandidates />} />
          <Route path='candidates/:id' element={<AdminCandidateDetail />} />
          <Route path='applications' element={<AdminApplications />} />
          <Route path='clients' element={<MasterDataPage type='clients' />} />
          <Route path='master' element={<MasterDataIndex />} />
          <Route path='master/:type' element={<MasterDataPage />} />
          <Route path='audit-logs' element={<AdminAuditLogs />} />
          <Route path='enquiries' element={<EnquiriesLayout />}>
            <Route index element={<Navigate to='calls' replace />} />
            <Route path=':section' element={<AdminSubmissions />} />
          </Route>
          <Route path='jobs' element={<AdminJobs />} />
          <Route path='jobs/new' element={<AdminJobCreate />} />
          <Route path='jobs/:id' element={<AdminJobView />} />
          <Route path='jobs/:id/edit' element={<AdminJobEdit />} />
          <Route path='jobs/:id/preview' element={<AdminJobPreview />} />
          <Route path=':section' element={<LegacySectionRedirect />} />
        </Route>
        <Route path='/dashboard' element={<Dashboard />}>
          {companyToken ? <>
          <Route path='add-job' element={<AddJob />} />
          <Route path='manage-jobs' element={<ManageJobs />} />
          <Route path='view-applications' element={<ViewApplications />} />
          </> : null
          }
          
        </Route>
        <Route path='*' element={<NotFound />} />
      </Routes>
      </Suspense>
    </div>
  )
}

export default App
