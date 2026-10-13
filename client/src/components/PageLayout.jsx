import React from 'react'
import Navbar from './Navbar'
import Footer from './Footer'

// Simple wrapper for content pages: navbar, page header, content, footer
const PageLayout = ({ title, subtitle, children }) => (
    <div className='min-h-screen flex flex-col'>
        <Navbar />
        <main className='flex-1'>
            {title && (
                <div className='bg-linear-to-r from-purple-800 to-purple-950 text-white'>
                    <div className='container px-4 2xl:px-20 mx-auto py-12'>
                        <h1 className='text-3xl md:text-4xl font-medium'>{title}</h1>
                        {subtitle && <p className='mt-3 max-w-2xl text-purple-100 font-light'>{subtitle}</p>}
                    </div>
                </div>
            )}
            <div className='container px-4 2xl:px-20 mx-auto py-10'>{children}</div>
        </main>
        <Footer />
    </div>
)

export default PageLayout
