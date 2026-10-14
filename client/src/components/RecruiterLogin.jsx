import React, { useRef, useContext, useEffect, useState } from 'react'
import { assets } from '../assets/assets'
import { AppContext } from '../context/AppContext'
import axios from 'axios'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { AuthField, ChannelToggle, LinkButton, OtpInput, ResendButton } from './auth/AuthFields'
import { safeRedirect } from '../utils/safeRedirect'

// Self sign-up hidden unless VITE_ALLOW_RECRUITER_SIGNUP=true (server enforces ALLOW_RECRUITER_SIGNUP)
const SIGNUP_ENABLED = import.meta.env.VITE_ALLOW_RECRUITER_SIGNUP === 'true'

const TITLES = { login: 'Recruiter Login', otp: 'Login with a code', forgot: 'Reset password', signup: 'Recruiter Sign Up', checkEmail: 'Check your email', verify: 'Email confirmation' }

const RecruiterLogin = () => {

    const navigate = useNavigate()
    const { search } = useLocation()
    const params = new URLSearchParams(search)
    const verifyToken = params.get('recruiter-verify')

    const { setShowRecruiterLogin, backendUrl, setCompanyToken, setCompanyData } = useContext(AppContext)

    const [mode, setMode] = useState(verifyToken ? 'verify' : 'login')
    const [step, setStep] = useState(0)          // multi-step flows: 0 = enter destination, 1 = code, 2 = new password
    const [channel, setChannel] = useState('email')
    const [identifier, setIdentifier] = useState('')
    const [destination, setDestination] = useState('')
    const [password, setPassword] = useState('')
    const [confirm, setConfirm] = useState('')
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [code, setCode] = useState('')
    const [image, setImage] = useState(null)
    const [cooldownUntil, setCooldownUntil] = useState(0)   // epoch ms when "resend" unlocks
    const setCooldown = (s) => setCooldownUntil(Date.now() + s * 1000)
    const [resetToken, setResetToken] = useState('')
    const [notice, setNotice] = useState('')
    const [unverified, setUnverified] = useState(false)

    const [busy, setBusy] = useState(false)
    const busyRef = useRef(false)

    const close = () => setShowRecruiterLogin(false)
    const go = (m) => { setMode(m); setStep(0); setCode(''); setNotice(''); setPassword(''); setConfirm(''); setResetToken(''); setUnverified(false) }

    // POST helper: new endpoints use 4xx statuses; always hand back the JSON body
    const call = async (path, body) => {
        try { return (await axios.post(backendUrl + path, body)).data }
        catch (err) { return err.response?.data || { success: false, message: 'Network error. Please try again.' } }
    }
    const guarded = (fn) => async (e) => {
        e?.preventDefault?.()
        if (busyRef.current) return
        busyRef.current = true; setBusy(true)
        try { await fn() } finally { busyRef.current = false; setBusy(false) }
    }

    const finishLogin = (data) => {
        setCompanyData(data.company)
        setCompanyToken(data.token)
        localStorage.setItem('companyToken', data.token)
        close()
        navigate(safeRedirect(params.get('next'), '/dashboard'))
    }

    const sendCode = async (purpose, ch, dest) => {
        const data = await call('/api/company/auth/otp/request', { purpose, channel: ch, destination: dest })
        if (data.retryAfter) setCooldown(data.retryAfter)
        if (!data.success) { toast.error(data.message); return false }
        setCooldown(data.cooldown || 60)
        setNotice(data.message)
        return true
    }

    // ---- handlers --------------------------------------------------------------
    const onPasswordLogin = guarded(async () => {
        const data = await call('/api/company/login', { identifier, password })
        if (data.success) return finishLogin(data)
        setUnverified(Boolean(data.verificationRequired))
        toast.error(data.message)
    })

    const onOtpLogin = guarded(async () => {
        if (step === 0) { if (await sendCode('login', channel, destination)) setStep(1); return }
        const data = await call('/api/company/auth/otp/login', { channel, destination, code })
        if (data.success) return finishLogin(data)
        toast.error(data.message)
    })

    const onForgot = guarded(async () => {
        if (step === 0) { if (await sendCode('reset', channel, destination)) setStep(1); return }
        if (step === 1) {
            const data = await call('/api/company/auth/password/verify-otp', { channel, destination, code })
            if (!data.success) return toast.error(data.message)
            setResetToken(data.resetToken); setStep(2); return
        }
        if (password !== confirm) return toast.error('Passwords do not match')
        const data = await call('/api/company/auth/password/reset', { resetToken, password })
        if (!data.success) { toast.error(data.message); if (/expired/i.test(data.message || '')) go('forgot'); return }
        toast.success(data.message)
        go('login')
    })

    const onSignup = guarded(async () => {
        if (step === 0) { if (await sendCode('signup', 'sms', phone)) setStep(1); return }
        if (!image) return toast.error('Please upload your company logo')
        const formData = new FormData()
        formData.append('name', name)
        formData.append('email', email)
        formData.append('password', password)
        formData.append('phone', phone)
        formData.append('phoneCode', code)
        formData.append('image', image)
        let data
        try { data = (await axios.post(backendUrl + '/api/company/register', formData)).data }
        catch (err) { data = err.response?.data || { success: false, message: 'Network error. Please try again.' } }
        if (!data.success) return toast.error(data.message)
        setNotice(data.message)
        setMode('checkEmail')
    })

    const onResendVerification = guarded(async () => {
        const data = await call('/api/company/auth/verify-email/resend', { email: email || identifier })
        if (data.success) { toast.success(data.message); setCooldown(data.cooldown || 60) } else toast.error(data.message)
    })

    // Email confirmation link: /?recruiter-verify=<token>
    const verifiedOnce = useRef(false)
    useEffect(() => {
        if (!verifyToken || verifiedOnce.current) return
        verifiedOnce.current = true
        call('/api/company/auth/verify-email', { token: verifyToken }).then(data => {
            setNotice(data.message)
            navigate({ search: '' }, { replace: true })   // drop the token from the address bar/history
        })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [verifyToken])

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        const onKey = (e) => { if (e.key === 'Escape') setShowRecruiterLogin(false) }
        window.addEventListener('keydown', onKey)
        return () => { document.body.style.overflow = 'unset'; window.removeEventListener('keydown', onKey) }
    }, [setShowRecruiterLogin])

    const submit = { login: onPasswordLogin, otp: onOtpLogin, forgot: onForgot, signup: onSignup }[mode]
    const destField = (
        <AuthField
            key={channel} label={channel === 'email' ? 'Email address' : 'Mobile number'}
            icon={channel === 'email' ? assets.email_icon : assets.person_icon}
            type={channel === 'email' ? 'email' : 'tel'} autoComplete={channel === 'email' ? 'email' : 'tel'}
            inputMode={channel === 'email' ? 'email' : 'tel'} placeholder={channel === 'email' ? 'you@company.com' : '98765 43210'}
            value={destination} onChange={e => setDestination(e.target.value)} maxLength={254} required disabled={step > 0}
        />
    )
    const codeStep = (purpose, ch, dest) => (<>
        <OtpInput value={code} onChange={setCode} />
        <div className='flex justify-between items-center'>
            <ResendButton until={cooldownUntil} disabled={busy} onResend={guarded(() => sendCode(purpose, ch, dest))} />
            <LinkButton onClick={() => { setStep(0); setCode('') }}>Change {ch === 'email' ? 'email' : 'number'}</LinkButton>
        </div>
    </>)
    const primary = (label) => (
        <button type='submit' disabled={busy} className='disabled:opacity-60 bg-blue-600 hover:bg-blue-700 w-full text-white py-2 rounded-full mt-5'>
            {busy ? 'Please wait…' : label}
        </button>
    )

    return (
        <div className='fixed inset-0 z-50 backdrop-blur-sm bg-black/30 flex justify-center items-start sm:items-center overflow-y-auto p-4'>
            <form onSubmit={submit || (e => e.preventDefault())} role='dialog' aria-modal='true' aria-labelledby='recruiter-auth-title'
                className='relative bg-white p-6 sm:p-10 rounded-xl text-slate-500 w-full max-w-md my-8' noValidate={false}>
                <h1 id='recruiter-auth-title' className='text-center text-2xl text-neutral-700 font-medium'>{TITLES[mode]}</h1>
                {notice && <p role='status' className='text-sm mt-3 text-center text-neutral-600'>{notice}</p>}

                {mode === 'login' && <>
                    <p className='text-sm text-center mt-1'>Welcome back! Please sign in to continue</p>
                    <AuthField label='Email or mobile number' icon={assets.email_icon} autoComplete='username' value={identifier}
                        onChange={e => setIdentifier(e.target.value)} placeholder='you@company.com or 98765 43210' maxLength={254} required autoFocus />
                    <AuthField label='Password' icon={assets.lock_icon} type='password' autoComplete='current-password' value={password}
                        onChange={e => setPassword(e.target.value)} maxLength={128} required />
                    <div className='flex justify-between mt-3'>
                        <LinkButton onClick={() => go('forgot')}>Forgot password?</LinkButton>
                        <LinkButton onClick={() => go('otp')}>Login with a code</LinkButton>
                    </div>
                    {unverified && <div className='mt-3 text-sm'>Didn't get the confirmation email? <LinkButton disabled={busy} onClick={onResendVerification}>Resend confirmation email</LinkButton></div>}
                    {primary('Login')}
                    {SIGNUP_ENABLED && <p className='mt-5 text-center text-sm'>Don't have an account? <LinkButton onClick={() => go('signup')}>Sign Up</LinkButton></p>}
                </>}

                {(mode === 'otp' || mode === 'forgot') && <>
                    {step === 0 && <ChannelToggle value={channel} onChange={c => { setChannel(c); setDestination('') }} />}
                    {step < 2 && destField}
                    {step === 1 && codeStep(mode === 'otp' ? 'login' : 'reset', channel, destination)}
                    {step === 2 && <>
                        <AuthField label='New password' icon={assets.lock_icon} type='password' autoComplete='new-password' minLength={8} maxLength={128}
                            value={password} onChange={e => setPassword(e.target.value)} required autoFocus />
                        <AuthField label='Confirm new password' icon={assets.lock_icon} type='password' autoComplete='new-password' minLength={8} maxLength={128}
                            value={confirm} onChange={e => setConfirm(e.target.value)} required />
                        <p className='text-xs mt-2'>At least 8 characters. You'll be signed out on other devices.</p>
                    </>}
                    {primary(step === 0 ? 'Send code' : step === 1 ? (mode === 'otp' ? 'Login' : 'Verify code') : 'Set new password')}
                    <p className='mt-5 text-center'><LinkButton onClick={() => go('login')}>Back to password login</LinkButton></p>
                </>}

                {mode === 'signup' && SIGNUP_ENABLED && <>
                    <AuthField label='Company name' icon={assets.person_icon} autoComplete='organization' value={name} onChange={e => setName(e.target.value)} maxLength={100} required disabled={step > 0} />
                    <AuthField label='Work email' icon={assets.email_icon} type='email' autoComplete='email' value={email} onChange={e => setEmail(e.target.value)} maxLength={254} required disabled={step > 0} />
                    <AuthField label='Password' icon={assets.lock_icon} type='password' autoComplete='new-password' minLength={8} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required disabled={step > 0} />
                    <AuthField label='Mobile number' icon={assets.person_icon} type='tel' inputMode='tel' autoComplete='tel' value={phone} onChange={e => setPhone(e.target.value)} maxLength={20} required disabled={step > 0} />
                    {step === 1 && <>
                        {codeStep('signup', 'sms', phone)}
                        <div className='flex items-center gap-4 mt-4'>
                            <label htmlFor='company-logo' className='cursor-pointer'>
                                <img className='w-16 h-16 object-cover rounded-full' src={image ? URL.createObjectURL(image) : assets.upload_area} alt='Company logo preview' />
                            </label>
                            <input onChange={e => setImage(e.target.files[0])} type='file' accept='image/png,image/jpeg,image/webp,image/gif' id='company-logo' className='sr-only' />
                            <label htmlFor='company-logo' className='text-sm cursor-pointer'>Upload company logo</label>
                        </div>
                    </>}
                    {primary(step === 0 ? 'Verify mobile' : 'Create account')}
                    <p className='mt-5 text-center text-sm'>Already have an account? <LinkButton onClick={() => go('login')}>Login</LinkButton></p>
                </>}

                {mode === 'checkEmail' && <>
                    <p className='text-sm text-center mt-3'>Open the link we sent to <b>{email}</b> to activate your account. The link works once.</p>
                    <div className='text-center'><ResendButton until={cooldownUntil} disabled={busy} onResend={onResendVerification} /></div>
                    <p className='mt-5 text-center'><LinkButton onClick={() => go('login')}>Back to login</LinkButton></p>
                </>}

                {mode === 'verify' && <p className='mt-5 text-center'>{notice ? <LinkButton onClick={() => go('login')}>Go to login</LinkButton> : 'Confirming…'}</p>}

                <button type='button' onClick={close} aria-label='Close' className='absolute top-5 right-5'>
                    <img src={assets.cross_icon} alt='' aria-hidden='true' />
                </button>
            </form>
        </div>
    )
}

export default RecruiterLogin
