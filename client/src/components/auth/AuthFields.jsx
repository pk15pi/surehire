import React, { useEffect, useId, useState } from 'react'

// Shared, accessible building blocks for the recruiter auth screens.

export const AuthField = ({ label, icon, id, ...props }) => {
    const auto = useId()
    const fieldId = id || auto
    return (
        <div className='mt-4'>
            <label htmlFor={fieldId} className='block text-xs font-medium text-neutral-600 mb-1'>{label}</label>
            <div className='border px-4 py-2 flex items-center gap-2 rounded-full focus-within:ring-2 focus-within:ring-blue-500'>
                {icon && <img src={icon} alt='' aria-hidden='true' />}
                <input id={fieldId} className='outline-none text-sm w-full bg-transparent' {...props} />
            </div>
        </div>
    )
}

// Single field with one-time-code autofill (iOS/Android SMS) and paste support ("123 456" -> "123456")
export const OtpInput = ({ value, onChange, label = '6-digit code', autoFocus = true }) => {
    const id = useId()
    const clean = (v) => String(v || '').replace(/\D/g, '').slice(0, 6)
    return (
        <div className='mt-4'>
            <label htmlFor={id} className='block text-xs font-medium text-neutral-600 mb-1'>{label}</label>
            <input
                id={id} value={value} autoFocus={autoFocus}
                onChange={e => onChange(clean(e.target.value))}
                onPaste={e => { e.preventDefault(); onChange(clean(e.clipboardData.getData('text'))) }}
                inputMode='numeric' autoComplete='one-time-code' pattern='\d{6}' maxLength={6} required
                aria-describedby={`${id}-hint`}
                className='w-full border rounded-full px-4 py-2 text-center text-lg tracking-[0.5em] outline-none focus:ring-2 focus:ring-blue-500'
            />
            <p id={`${id}-hint`} className='text-xs mt-1 text-neutral-500'>Enter or paste the code we sent you.</p>
        </div>
    )
}

// "Resend code" with a visible countdown; disabled until `until` (epoch ms) has passed
export const ResendButton = ({ until = 0, onResend, disabled }) => {
    const [now, setNow] = useState(() => Date.now())
    useEffect(() => {
        const t = setInterval(() => setNow(Date.now()), 1000)
        return () => clearInterval(t)
    }, [])
    const left = Math.max(0, Math.ceil((until - now) / 1000))
    return (
        <button type='button' onClick={onResend} disabled={disabled || left > 0}
            className='text-sm text-blue-600 disabled:text-neutral-400 mt-3' aria-live='polite'>
            {left > 0 ? `Resend code in ${left}s` : 'Resend code'}
        </button>
    )
}

export const ChannelToggle = ({ value, onChange }) => (
    <div role='radiogroup' aria-label='Send code by' className='flex gap-2 mt-4'>
        {[['email', 'Email'], ['sms', 'Mobile']].map(([v, l]) => (
            <button key={v} type='button' role='radio' aria-checked={value === v} onClick={() => onChange(v)}
                className={`flex-1 rounded-full border py-1.5 text-sm ${value === v ? 'bg-blue-600 text-white border-blue-600' : 'text-neutral-600'}`}>{l}</button>
        ))}
    </div>
)

export const LinkButton = ({ children, ...props }) => (
    <button type='button' className='text-sm text-blue-600 hover:underline' {...props}>{children}</button>
)
