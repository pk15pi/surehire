// Client-side checks mirroring the server rules (server remains authoritative)
export const validateJobForm = (f, { legacyLocation } = {}) => {
    const e = {}
    if (!f.title.trim()) e.title = 'Title is required'
    if (!f.description) e.description = 'Description is required'
    if (f.referenceId && !/^SH-JOB-\d{6}-[A-Z0-9]{4,8}$/i.test(f.referenceId.trim())) e.referenceId = 'Use the format SH-JOB-YYMMDD-XXXX'
    if (f.workplaceType !== 'Remote' && !f.city.trim() && !legacyLocation) e.city = 'City is required for on-site and hybrid jobs'
    const n = (v) => (v === '' || v === null || v === undefined ? null : Number(v))
    for (const k of ['experienceMin', 'experienceMax', 'salaryMin', 'salaryMax', 'vacancies']) {
        if (f[k] !== '' && !Number.isFinite(Number(f[k]))) e[k] = 'Must be a number'
        else if (n(f[k]) !== null && n(f[k]) < 0) e[k] = 'Must not be negative'
    }
    if (f.vacancies !== '' && !e.vacancies && (!Number.isInteger(Number(f.vacancies)) || Number(f.vacancies) < 1)) e.vacancies = 'At least 1'
    if (!e.experienceMax && n(f.experienceMin) !== null && n(f.experienceMax) !== null && n(f.experienceMin) > n(f.experienceMax)) e.experienceMax = 'Must be ≥ minimum experience'
    if (!f.salaryUndisclosed && !e.salaryMax && n(f.salaryMin) !== null && n(f.salaryMax) !== null && n(f.salaryMin) > n(f.salaryMax)) e.salaryMax = 'Must be ≥ minimum salary'
    if (f.currency && !/^[A-Za-z]{3}$/.test(f.currency)) e.currency = '3-letter code, e.g. INR'
    if (f.publishAt && f.expiresAt && f.expiresAt <= f.publishAt) e.expiresAt = 'Must be after the publish date'
    return e
}
