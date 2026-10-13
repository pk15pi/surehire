import { useEffect } from 'react'

const BASE_TITLE = 'SureHire'

const setMeta = (name, content) => {
    let el = document.querySelector(`meta[name="${name}"]`)
    if (!el) {
        el = document.createElement('meta')
        el.setAttribute('name', name)
        document.head.appendChild(el)
    }
    el.setAttribute('content', content)
    return el
}

// Simple per-page <title> / meta description (no extra dependency)
const usePageMeta = (title, description, { noIndex = false } = {}) => {
    useEffect(() => {
        document.title = title ? `${title} | ${BASE_TITLE}` : BASE_TITLE
        if (description) setMeta('description', description)
        const robots = noIndex ? setMeta('robots', 'noindex, nofollow') : null
        return () => {
            document.title = BASE_TITLE
            if (robots) robots.remove()
        }
    }, [title, description, noIndex])
}

export default usePageMeta
