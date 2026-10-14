import React from 'react'
import { X } from 'lucide-react'
import { masterLabel } from '../../../admin/useMasters'

// Options = active records + the current value(s) even if inactive/unknown,
// so editing a job never silently replaces an existing reference.
const optionLabel = (m, type) => `${masterLabel(m, type)}${m.active === false ? ' (inactive)' : ''}`

export const MasterSelect = ({ id, items = [], type, value, onChange, placeholder = 'Not specified', className, disabled, invalid, describedBy }) => {
    const options = items.filter(m => m.active !== false || String(m._id) === String(value))
    const known = !value || items.some(m => String(m._id) === String(value))
    return (
        <select id={id} value={value || ''} onChange={e => onChange(e.target.value)} disabled={disabled} className={className}
            aria-invalid={invalid || undefined} aria-describedby={describedBy}>
            <option value=''>{placeholder}</option>
            {!known && <option value={value}>(unknown value)</option>}
            {options.map(m => <option key={m._id} value={m._id}>{optionLabel(m, type)}</option>)}
        </select>
    )
}

export const MasterMultiSelect = ({ id, items = [], type, value = [], onChange, placeholder = 'Add...', className, disabled, invalid, describedBy }) => {
    const byId = new Map(items.map(m => [String(m._id), m]))
    const selected = new Set(value.map(String))
    const available = items.filter(m => m.active !== false && !selected.has(String(m._id)))
    return (
        <div>
            {value.length > 0 && (
                <ul className='flex flex-wrap gap-2 mb-2' aria-label='Selected'>
                    {value.map(v => {
                        const m = byId.get(String(v))
                        return (
                            <li key={v} className={`flex items-center gap-1 text-sm rounded px-2 py-0.5 ${m?.active === false ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-blue-50 text-blue-800'}`}>
                                {m ? optionLabel(m, type) : '(unknown value)'}
                                <button type='button' disabled={disabled} onClick={() => onChange(value.filter(x => String(x) !== String(v)))} aria-label={`Remove ${m ? masterLabel(m, type) : 'value'}`} className='hover:text-red-600'><X size={14} /></button>
                            </li>
                        )
                    })}
                </ul>
            )}
            <select id={id} value='' disabled={disabled || !available.length} onChange={e => e.target.value && onChange([...value, e.target.value])}
                className={className} aria-invalid={invalid || undefined} aria-describedby={describedBy}>
                <option value=''>{available.length ? placeholder : 'No more options'}</option>
                {available.map(m => <option key={m._id} value={m._id}>{masterLabel(m, type)}</option>)}
            </select>
        </div>
    )
}
