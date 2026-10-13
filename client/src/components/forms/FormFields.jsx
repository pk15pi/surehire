import React, { useEffect, useId, useRef } from 'react'
import { CheckCircle2, AlertCircle, RotateCcw, Info } from 'lucide-react'
import { COUNTRY_CODES } from './formOptions'

const baseInput = 'w-full border rounded-md px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100'
const inputClass = (error) => `${baseInput} ${error ? 'border-red-400' : 'border-gray-300'}`

export const Field = ({ label, required, error, htmlFor, children, hint }) => (
    <div className='flex flex-col gap-1'>
        {label && (
            <label htmlFor={htmlFor} className='text-sm font-medium text-gray-700'>
                {label} {required && <span className='text-red-500'>*</span>}
            </label>
        )}
        {children}
        {hint && !error && <p className='text-xs text-gray-500'>{hint}</p>}
        {error && <p className='text-xs text-red-600' role='alert'>{error}</p>}
    </div>
)

export const TextInput = ({ label, name, value, onChange, error, required, type = 'text', placeholder, maxLength, disabled, hint, ...rest }) => (
    <Field label={label} required={required} error={error} htmlFor={name} hint={hint}>
        <input id={name} name={name} type={type} value={value} onChange={onChange} placeholder={placeholder}
            maxLength={maxLength} disabled={disabled} aria-invalid={!!error} className={inputClass(error)} {...rest} />
    </Field>
)

export const TextArea = ({ label, name, value, onChange, error, required, placeholder, maxLength = 2000, rows = 4, disabled }) => (
    <Field label={label} required={required} error={error} htmlFor={name}>
        <textarea id={name} name={name} value={value} onChange={onChange} placeholder={placeholder} rows={rows}
            maxLength={maxLength} disabled={disabled} aria-invalid={!!error} className={inputClass(error)} />
        <p className='text-xs text-gray-400 text-right'>{value.length}/{maxLength}</p>
    </Field>
)

export const SelectInput = ({ label, name, value, onChange, error, required, options, placeholder = 'Select...', disabled }) => (
    <Field label={label} required={required} error={error} htmlFor={name}>
        <select id={name} name={name} value={value} onChange={onChange} disabled={disabled}
            aria-invalid={!!error} className={inputClass(error) + ' bg-white'}>
            <option value=''>{placeholder}</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </Field>
)

export const PhoneInput = ({ label = 'Phone', codeName = 'countryCode', phoneName = 'phone', codeValue, phoneValue, onChange, error, required, disabled }) => (
    <Field label={label} required={required} error={error} htmlFor={phoneName}>
        <div className='flex gap-2'>
            <select name={codeName} value={codeValue} onChange={onChange} disabled={disabled} aria-label='Country code'
                className={`${baseInput} border-gray-300 bg-white w-36 shrink-0`}>
                {COUNTRY_CODES.map(c => <option key={c.label} value={c.code}>{c.label}</option>)}
            </select>
            <input id={phoneName} name={phoneName} type='tel' inputMode='tel' value={phoneValue} onChange={onChange}
                placeholder='Phone number' maxLength={20} disabled={disabled} required={required} aria-required={required || undefined} aria-invalid={!!error} className={inputClass(error)} />
        </div>
    </Field>
)

// Hidden honeypot field to deter bots (real users never see or fill it)
export const Honeypot = ({ value, onChange }) => (
    <div aria-hidden='true' style={{ position: 'absolute', left: '-10000px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor='website'>Website</label>
        <input id='website' name='website' type='text' tabIndex={-1} autoComplete='off' value={value} onChange={onChange} />
    </div>
)

export const SuccessPanel = ({ title = 'Thank you!', message, referenceId, onReset, resetLabel = 'Submit another' }) => (
    <div className='text-center py-8 px-4'>
        <CheckCircle2 className='mx-auto text-green-600' size={48} />
        <h3 className='text-xl font-semibold mt-4'>{title}</h3>
        {message && <p className='text-gray-600 mt-2 text-sm'>{message}</p>}
        {referenceId && (
            <p className='mt-4 text-sm'>
                Your reference ID: <span className='font-mono font-semibold bg-gray-100 px-2 py-1 rounded select-all'>{referenceId}</span>
            </p>
        )}
        <p className='text-xs text-gray-500 mt-2'>Please keep this ID for future communication.</p>
        {onReset && (
            <button type='button' onClick={onReset} className='mt-6 text-blue-600 text-sm underline'>{resetLabel}</button>
        )}
    </div>
)

export const ErrorBanner = ({ message, onRetry, disabled }) => {
    if (!message) return null
    return (
        <div className='flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md p-3' role='alert'>
            <AlertCircle size={18} className='shrink-0 mt-0.5' />
            <p className='flex-1'>{message}</p>
            {onRetry && (
                <button type='button' onClick={onRetry} disabled={disabled} className='flex items-center gap-1 font-medium underline disabled:opacity-50'>
                    <RotateCcw size={14} /> Retry
                </button>
            )}
        </div>
    )
}

export const SubmitButton = ({ submitting, children, className = '' }) => (
    <button type='submit' disabled={submitting}
        className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-md font-medium disabled:opacity-60 disabled:cursor-not-allowed ${className}`}>
        {submitting ? 'Submitting...' : children}
    </button>
)

// "Send via" channel picker (Email via FormSubmit, or WhatsApp click-to-chat)
export const SendViaChoice = ({ value, onChange, disabled, name = 'sendVia' }) => {
    const id = useId()
    const opts = [
        { value: 'email', label: 'Email', hint: 'Sent directly to our team' },
        { value: 'whatsapp', label: 'WhatsApp', hint: 'Opens WhatsApp with your details' },
    ]
    return (
        <fieldset className='flex flex-col gap-1'>
            <legend id={id} className='text-sm font-medium text-gray-700 mb-1'>Send via</legend>
            <div role='radiogroup' aria-labelledby={id} className='grid grid-cols-1 sm:grid-cols-2 gap-2'>
                {opts.map(o => (
                    <label key={o.value} className={`flex items-start gap-2 border rounded-md px-3 py-2 text-sm cursor-pointer ${value === o.value ? 'border-blue-500 bg-blue-50' : 'border-gray-300'}`}>
                        <input type='radio' name={name} value={o.value} checked={value === o.value} disabled={disabled}
                            onChange={() => onChange(o.value)} className='mt-1' />
                        <span><span className='font-medium'>{o.label}</span><span className='block text-xs text-gray-500'>{o.hint}</span></span>
                    </label>
                ))}
            </div>
        </fieldset>
    )
}

// Note shown when WhatsApp is chosen on a form that has a file field
export const WhatsAppFileNote = ({ fileLabel = 'file' }) => (
    <div className='flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-md p-3' role='note'>
        <Info size={16} className='shrink-0 mt-0.5' aria-hidden='true' />
        <p>WhatsApp links can't carry attachments, so your {fileLabel} won't be sent automatically. Please attach it manually in the WhatsApp chat after it opens, or choose Email to upload it here.</p>
    </div>
)

export const WA_DESKTOP_NOTICE = 'To send on WhatsApp from a desktop, you need to be logged in to WhatsApp Web or have the WhatsApp desktop app. Continue?'

// Small accessible confirm dialog shown on desktop before opening WhatsApp
export const WhatsAppConfirmDialog = ({ open, onContinue, onCancel }) => {
    const continueRef = useRef(null)
    const boxRef = useRef(null)
    const titleId = useId()
    const descId = useId()
    useEffect(() => {
        if (!open) return
        const prevFocus = document.activeElement
        continueRef.current?.focus()
        const onKey = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); onCancel() }
            if (e.key === 'Tab' && boxRef.current) {
                const f = boxRef.current.querySelectorAll('button')
                const first = f[0], last = f[f.length - 1]
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
            }
        }
        document.addEventListener('keydown', onKey)
        return () => { document.removeEventListener('keydown', onKey); prevFocus?.focus?.() }
    }, [open, onCancel])
    if (!open) return null
    return (
        <div className='fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4'>
            <div ref={boxRef} role='alertdialog' aria-modal='true' aria-labelledby={titleId} aria-describedby={descId}
                className='bg-white rounded-xl shadow-xl w-full max-w-sm p-5'>
                <h2 id={titleId} className='text-base font-semibold'>Send on WhatsApp</h2>
                <p id={descId} className='text-sm text-gray-600 mt-2'>{WA_DESKTOP_NOTICE}</p>
                <div className='flex justify-end gap-3 mt-5'>
                    <button type='button' onClick={onCancel} className='px-4 py-2 rounded-md border border-gray-300 text-gray-700 text-sm'>Cancel</button>
                    <button type='button' ref={continueRef} onClick={onContinue} className='px-4 py-2 rounded-md bg-green-600 hover:bg-green-700 text-white text-sm font-medium'>Continue</button>
                </div>
            </div>
        </div>
    )
}
