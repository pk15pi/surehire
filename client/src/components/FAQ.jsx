import React from 'react'
import { Link } from 'react-router-dom'

// Factual FAQs only - describes how this site works, no invented claims or numbers.
const FAQS = [
    {
        q: 'What kind of roles does SureHire recruit for?',
        a: <>We focus on core (non-IT) engineering roles - for example mechanical, electrical, civil, instrumentation, process and chemical engineering - across sectors such as energy, construction, manufacturing and heavy industry. See the <Link to='/industries' className='text-blue-600 underline'>industries we recruit for</Link>.</>,
    },
    {
        q: 'How do I share a hiring requirement?',
        a: <>Fill in the <Link to='/hire-engineers' className='text-blue-600 underline'>Hire Talent</Link> form with the role, location, number of positions and timeline. You can optionally attach a job description (PDF or DOCX). Our team will contact you to discuss the requirement.</>,
    },
    {
        q: 'How do I submit my resume?',
        a: <>Use the <Link to='/submit-resume' className='text-blue-600 underline'>Submit Resume</Link> page. Upload your resume as a PDF or DOCX file (up to 5 MB) along with a few details about your discipline and experience. We will contact you if a matching role comes up.</>,
    },
    {
        q: 'What happens after I submit a form?',
        a: 'You will see a reference ID on screen. Keep it handy - it helps our team find your request quickly if you get in touch. A member of the team will review your submission and follow up.',
    },
    {
        q: 'Who can see my resume?',
        a: 'Uploaded resumes and job descriptions are stored privately and are not publicly accessible. They can only be opened by the SureHire team through a secure, time-limited link.',
    },
    {
        q: 'Can I speak to someone before submitting anything?',
        a: 'Yes. Use the "Schedule a Call" button at the top of the page, choose a time that works for you (including your timezone) and our team will call you.',
    },
]

const FAQ = () => (
    <section id='faq' className='container px-4 2xl:px-20 mx-auto mt-16 max-w-4xl' aria-labelledby='faq-heading'>
        <h2 id='faq-heading' className='text-2xl font-semibold mb-6'>Frequently asked questions</h2>
        <div className='flex flex-col gap-3'>
            {FAQS.map(({ q, a }) => (
                <details key={q} className='group border border-gray-200 rounded-lg p-4 open:shadow-sm'>
                    <summary className='cursor-pointer font-medium list-none flex justify-between items-center gap-4'>
                        {q}
                        <span className='text-gray-400 group-open:rotate-45 transition-transform text-xl leading-none'>+</span>
                    </summary>
                    <p className='mt-3 text-sm text-gray-600 leading-relaxed'>{a}</p>
                </details>
            ))}
        </div>
    </section>
)

export default FAQ
