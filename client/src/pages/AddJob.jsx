import React, { useContext, useEffect, useRef, useState } from 'react'
import Quill from 'quill'; 
import { JobCategories, JobLocations } from '../assets/assets';
import { usePublicMasters } from '../admin/useMasters';

const OPTION_TYPES = ['categories', 'locations', 'experience-levels']
// Fallback only if master data cannot be loaded, so recruiters are never blocked
const FALLBACK_LEVELS = ['Beginner level', 'Intermediate level', 'Senior level']
import axios from 'axios';
import { AppContext } from '../context/AppContext';
import { toast } from 'react-toastify';

const AddJob = () => {

    const [title, setTitle] = useState('');
    const [location, setLocation] = useState('Bangalore');
    const [category, setCategory] = useState('Programming');
    const [level, setLevel] = useState('Beginner level');
    const [salary, setSalary] = useState(0);

    const editorRef = useRef(null);
    const quillRef = useRef(null);

    const { backendUrl, companyToken } = useContext(AppContext)

    // Options from master data (names are linked to masters on the server; nothing is created)
    const masters = usePublicMasters(backendUrl, OPTION_TYPES)
    const names = (type, fallback, fn = m => m.name) => (masters.data[type]?.length ? masters.data[type].map(fn) : (masters.loading ? [] : fallback))
    const categoryOptions = names('categories', JobCategories)
    const locationOptions = [...new Set(names('locations', JobLocations, m => m.city || m.name))]
    const levelOptions = names('experience-levels', FALLBACK_LEVELS)
    // Keep the selection valid once options load
    if (categoryOptions.length && !categoryOptions.includes(category)) setCategory(categoryOptions[0])
    if (locationOptions.length && !locationOptions.includes(location)) setLocation(locationOptions[0])
    if (levelOptions.length && !levelOptions.includes(level)) setLevel(levelOptions[0])

    // Duplicate-submit guard: ignore clicks while a request is in flight
const [busy, setBusy] = useState(false)
const busyRef = useRef(false)
const onSubmitHandler = async (...args) => {
  if (busyRef.current) { args[0]?.preventDefault?.(); return }
  busyRef.current = true; setBusy(true)
  try { return await onSubmitHandlerRun(...args) } finally { busyRef.current = false; setBusy(false) }
}
const onSubmitHandlerRun = async (e) => {
        e.preventDefault()

        try {
            
            const description = quillRef.current.root.innerHTML

            const { data } = await axios.post(backendUrl+'/api/company/post-job',
                {title, description, location, salary, category, level},
                {headers: {token:companyToken}}
            )

            if (data.success) {
                toast.success(data.message)
                setTitle('')
                setSalary(0)
                quillRef.current.root.innerHTML = ""
            } else {
                 toast.error(data.message)
            }

        } catch (error) {
            toast.error(error.message)
        }

    }

    useEffect(() => {
        // Initiate Quill only once
        if (!quillRef.current && editorRef.current) {
            quillRef.current = new Quill(editorRef.current,{
                theme:'snow',
            })
        }
    },[])

  return (
    <form onSubmit={onSubmitHandler} className='container p-4 flex flex-col w-full items-start gap-3'>
        {/* Job Title */}
        <div className='w-full'>
            <p className='mb-2'>Job Title</p>
            <input type="text" placeholder='Type here' onChange={e => setTitle(e.target.value)} value={title} maxLength={200} required className='w-full max-w-lg px-3 py-2 border-2 border-gray-300 rounded'/>
        </div>
        {/* Job Desc */}
        <div className='w-full max-w-lg'>
            <p className='my-2'>Job Description</p>
            <div ref={editorRef}>

            </div>
        </div>
        {/* Job Category, Location, Level DropDown */}
        <div className='flex flex-col sm:flex-row gap-2 w-full sm:gap-8'>
            <div>
                <p className='mb-2'>Job Category</p>
                <select className='w-full px-3 py-2 border-2 border-gray-300 rounded' value={category} onChange={e => setCategory(e.target.value)}>
                    {categoryOptions.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>
            
            <div>
                <p className='mb-2'>Job Location</p>
                <select className='w-full px-3 py-2 border-2 border-gray-300 rounded' value={location} onChange={e => setLocation(e.target.value)}>
                    {locationOptions.map((l) => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                </select>
            </div>

            <div>
                <p className='mb-2'>Job Level</p>
                <select className='w-full px-3 py-2 border-2 border-gray-300 rounded' value={level} onChange={e => setLevel(e.target.value)}>
                    {levelOptions.map((l) => (
                        <option key={l} value={l}>{l}</option>
                    ))}
                </select>
            </div>
        </div>
        {/* Job salary */}
        <div>
            <p className='mb-2'>Job Salary</p>
            <input min={0} className='w-full px-3 py-2 border-2 border-gray-300 rounded sm:w-[120px' onChange={e => setSalary(e.target.value)} type="number" placeholder='25000'/>
        </div>

        <button disabled={busy} className='disabled:opacity-60 w-28 py-3 mt-4 bg-black text-white rounded'>ADD</button>
    </form>
  )
}

export default AddJob