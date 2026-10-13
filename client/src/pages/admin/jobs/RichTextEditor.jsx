import React, { useEffect, useRef } from 'react'
import Quill from 'quill'

const isEmpty = (html) => !html || html.replace(/<(.|\n)*?>/g, '').replace(/&nbsp;/g, '').trim() === ''

// Thin Quill wrapper (same editor/theme as the recruiter AddJob page).
// `value` is applied once on mount; afterwards Quill owns the content.
const RichTextEditor = ({ id, value, onChange, invalid, placeholder }) => {
    const editorRef = useRef(null)
    const quillRef = useRef(null)
    const onChangeRef = useRef(onChange)
    const initialValue = useRef(value)

    useEffect(() => { onChangeRef.current = onChange }, [onChange])

    useEffect(() => {
        if (quillRef.current || !editorRef.current) return
        const quill = new Quill(editorRef.current, {
            theme: 'snow',
            placeholder,
            modules: { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] },
        })
        if (initialValue.current) quill.clipboard.dangerouslyPasteHTML(initialValue.current, 'silent')
        quill.on('text-change', () => {
            const html = quill.root.innerHTML
            onChangeRef.current?.(isEmpty(html) ? '' : html)
        })
        if (id) quill.root.setAttribute('id', id)
        quillRef.current = quill
    }, [id, placeholder])

    return (
        <div className={`bg-white rounded ${invalid ? 'ring-2 ring-red-400' : ''}`}>
            <div ref={editorRef} className='min-h-40' />
        </div>
    )
}

export default RichTextEditor
