import React, { useState } from 'react'
import { X } from 'lucide-react'

// Simple multi-entry input: Enter (or comma for short tags) adds an item.
const TagInput = ({ id, value = [], onChange, placeholder, maxItems = 50, maxLength = 60, allowComma = true, invalid }) => {
    const [draft, setDraft] = useState('')

    const add = (raw) => {
        const item = raw.trim().slice(0, maxLength)
        if (!item) return
        if (value.some(v => v.toLowerCase() === item.toLowerCase()) || value.length >= maxItems) { setDraft(''); return }
        onChange([...value, item])
        setDraft('')
    }

    const onKeyDown = (e) => {
        if (e.key === 'Enter' || (allowComma && e.key === ',')) {
            e.preventDefault()
            add(draft)
        } else if (e.key === 'Backspace' && !draft && value.length) {
            onChange(value.slice(0, -1))
        }
    }

    return (
        <div className={`border-2 rounded px-2 py-1.5 bg-white ${invalid ? 'border-red-400' : 'border-gray-300'}`}>
            {value.length > 0 && (
                <ul className={`flex gap-1.5 mb-1.5 ${allowComma ? 'flex-wrap' : 'flex-col'}`}>
                    {value.map((v, i) => (
                        <li key={v} className='flex items-center gap-1 bg-blue-50 border border-blue-200 rounded px-2 py-0.5 text-sm'>
                            <span className='break-words'>{v}</span>
                            <button type='button' aria-label={`Remove ${v}`} onClick={() => onChange(value.filter((_, j) => j !== i))} className='text-gray-500 hover:text-red-600 ml-auto'>
                                <X size={12} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <input id={id} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={onKeyDown} onBlur={() => add(draft)}
                placeholder={value.length >= maxItems ? 'Limit reached' : placeholder} disabled={value.length >= maxItems}
                className='w-full outline-none text-sm py-0.5' maxLength={maxLength} />
        </div>
    )
}

export default TagInput
