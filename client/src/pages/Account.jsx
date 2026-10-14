import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { toast } from 'react-toastify'
import { AppContext } from '../context/AppContext'
import { AuthField, OtpInput, ResendButton } from '../components/auth/AuthFields'
import { assets } from '../assets/assets'

// Recruiter dashboard -> Account: add / change / verify the mobile number used for mobile login.
const Account = () => {
    const { backendUrl, companyToken, companyData } = useContext(AppContext)
    const [state, setState] = useState(null)        // { phone, phoneVerified, pendingPhone }
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [awaitingCode, setAwaitingCode] = useState(false)
    const [cooldownUntil, setCooldownUntil] = useState(0)
    const [busy, setBusy] = useState(false)
    const busyRef = useRef(false)

    const call = useCallback(async (method, path, data) => {
        try { return (await axios({ method, url: backendUrl + path, data, headers: { token: companyToken } })).data }
        catch (err) { return err.response?.data || { success: false, message: 'Network error. Please try again.' } }
    }, [backendUrl, companyToken])

    useEffect(() => {
        call('get', '/api/company/phone').then(d => {
            if (!d.success) return
            setState(d)
            setPhone(d.pendingPhone || d.phone || '')
            setAwaitingCode(Boolean(d.pendingPhone))
        })
    }, [call])

    const guarded = (fn) => async (e) => {
        e?.preventDefault?.()
        if (busyRef.current) return
        busyRef.current = true; setBusy(true)
        try { await fn() } finally { busyRef.current = false; setBusy(false) }
    }

    const sendCode = guarded(async () => {
        const d = await call('post', '/api/company/phone/send-code', { phone })
        if (d.retryAfter) setCooldownUntil(Date.now() + d.retryAfter * 1000)
        if (!d.success) return toast.error(d.message)
        setState(d)
        if (d.alreadyVerified) { setAwaitingCode(false); return toast.info(d.message) }
        setCooldownUntil(Date.now() + (d.cooldown || 60) * 1000)
        setAwaitingCode(true); setCode('')
        toast.success(d.message)
    })

    const verify = guarded(async () => {
        const d = await call('post', '/api/company/phone/verify', { code })
        if (!d.success) return toast.error(d.message)
        setState(d); setAwaitingCode(false); setCode(''); setPhone(d.phone)
        toast.success(d.message)
    })

    const verified = state?.phoneVerified && !state?.pendingPhone
    return (
        <div className='container p-4 max-w-xl'>
            <h1 className='text-xl font-medium text-gray-800 mb-4'>Account</h1>
            {companyData && <p className='text-sm text-gray-600 mb-4'>{companyData.name} · {companyData.email}</p>}

            <section aria-labelledby='mobile-heading' className='border rounded-lg p-4 sm:p-6 bg-white'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                    <h2 id='mobile-heading' className='font-medium text-gray-800'>Mobile number</h2>
                    {state && (
                        <span role='status' className={`text-xs rounded px-2 py-0.5 ${verified ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                            {verified ? 'Verified' : 'Not verified'}
                        </span>
                    )}
                </div>
                <p className='text-sm text-gray-500 mt-1'>Used to log in with your mobile and to reset your password by SMS. Include the country code.</p>
                {state?.phone && state?.pendingPhone && state.phone !== state.pendingPhone && (
                    <p className='text-xs text-gray-500 mt-2'>Current: {state.phone} (not verified until the new number is confirmed)</p>
                )}

                <form onSubmit={sendCode}>
                    <AuthField label='Mobile number' icon={assets.person_icon} type='tel' inputMode='tel' autoComplete='tel'
                        placeholder='+91 98765 43210' value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} required disabled={awaitingCode} />
                    {!awaitingCode && (
                        <button type='submit' disabled={busy || !phone} className='disabled:opacity-60 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full mt-4 w-full sm:w-auto'>
                            {busy ? 'Please wait…' : verified ? 'Change number' : 'Send code'}
                        </button>
                    )}
                </form>

                {awaitingCode && (
                    <form onSubmit={verify}>
                        <OtpInput value={code} onChange={setCode} />
                        <div className='flex flex-wrap items-center justify-between gap-2'>
                            <ResendButton until={cooldownUntil} disabled={busy} onResend={sendCode} />
                            <button type='button' className='text-sm text-blue-600 mt-3' onClick={() => { setAwaitingCode(false); setCode('') }}>Use a different number</button>
                        </div>
                        <button type='submit' disabled={busy || code.length !== 6} className='disabled:opacity-60 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-full mt-4 w-full sm:w-auto'>
                            {busy ? 'Please wait…' : 'Verify'}
                        </button>
                    </form>
                )}
            </section>
        </div>
    )
}

export default Account
