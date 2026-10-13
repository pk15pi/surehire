import { createContext, useEffect, useState } from "react";
// import { jobsData } from "../assets/assets";
import axios from "axios";
import { toast } from "react-toastify";
import { useAuth, useUser } from "@clerk/clerk-react";


export const AppContext = createContext()

export const AppContextProvider = (props) => {

    // VITE_BACKEND_URL wins. Otherwise: local API (port 3000) in dev, same origin ('') in production
    // builds, which is how the combined Vercel deployment serves /api. A trailing /api is tolerated.
    const backendUrl = (import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? 'http://localhost:3000' : '')).trim().replace(/\/+$/, '').replace(/\/api$/, '')

    const { user } = useUser()
    const { getToken } = useAuth()

    const [searchFilter, setSearchFilter] = useState({
        title: '',
        location: ''
    })

    const [isSearched, setIsSearched] = useState(false)

    const [jobs, setJobs] = useState([])

    const [showRecruiterLogin, setShowRecruiterLogin] = useState(false)

    const [showScheduleCall, setShowScheduleCall] = useState(false)

    const [companyToken, setCompanyToken] = useState(null)
    const [companyData, setCompanyData] = useState(null)

    const [userData, setUserData] = useState(null)
    const [userApplications, setUserApplications] = useState([])

    // Function to fetch Jobs

    const fetchJobs = async () => {
        try {

            const { data } = await axios.get(backendUrl + '/api/jobs')
            if (data.success) {
                setJobs(data.jobs)
                console.log(data.jobs);

            } else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.message)
        }
    }

    // Function to fetch company data
    const fetchCompanyData = async () => {

        try {

            const { data } = await axios.get(backendUrl + '/api/company/company', { headers: { token: companyToken } })

            if (data.success) {
                setCompanyData(data.company)
                console.log(data);

            } else {
                toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.message)
        }

    }

    // Function to fetch user data
    const fetchUserData = async () => {
        try {

            const token = await getToken();

            const { data } = await axios.get(backendUrl + '/api/users/user',
                { headers: { Authorization: `Bearer ${token}` } })

            if (data.success) {
                setUserData(data.user)
            } else (
                toast.error(data.message)
            )

        } catch (error) {
            toast.error(error.message)
        }
    }

    //  Function to fetch user's applied applications data
    const fetchUserApplications = async () =>{
        try {
            const token = await getToken()

            const {data} = await axios.get(backendUrl+'/api/users/applications',
                {headers: {Authorization : `Bearer ${token}`}}
            )
            if (data.success) {
                setUserApplications(data.applications)
            } else {
                toast.error(data.message)
            }
            
        } catch (error) {
            toast.error(error.message)
        }
    }

    useEffect(() => {
        fetchJobs()

        const storedCompanyToken = localStorage.getItem('companyToken')

        if (storedCompanyToken) {
            setCompanyToken(storedCompanyToken)
        }

    }, [])

    useEffect(() => {
        if (companyToken) {
            fetchCompanyData()
        }
    }, [companyToken])

    useEffect(() => {
        if (user) {
            fetchUserData()
            fetchUserApplications()
        }
    }, [user])


    const value = {
        setSearchFilter, searchFilter,
        isSearched, setIsSearched,
        jobs, setJobs,
        showRecruiterLogin, setShowRecruiterLogin,
        showScheduleCall, setShowScheduleCall,
        companyToken, setCompanyToken,
        companyData, setCompanyData,
        backendUrl,
        userData, setUserData,
        userApplications, setUserApplications,
        fetchUserData,
        fetchUserApplications,
    }

    return (<AppContext.Provider value={value}>
        {props.children}
    </AppContext.Provider>)
}