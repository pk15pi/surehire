// Admin tabs: URL path -> API submission type
export const ADMIN_TABS = [
    { path: 'calls', type: 'call', label: 'Calls', title: 'Call requests' },
    { path: 'enquiries', type: 'enquiry', label: 'Quick enquiries', title: 'Quick enquiries' },
    { path: 'hire-requests', type: 'hire', label: 'Hire requests', title: 'Hire requests' },
    { path: 'candidates', type: 'candidate', label: 'Candidates', title: 'Candidate submissions' },
]

// Which field is the "headline" for each type
export const PRIMARY_FIELDS = {
    call: (i) => i.name,
    enquiry: (i) => i.name,
    hire: (i) => `${i.companyName} - ${i.roleTitle}`,
    candidate: (i) => `${i.fullName} - ${i.discipline}`,
}

// Fields shown in the details panel, in order
export const DETAIL_FIELDS = {
    call: ['email', 'phone', 'iAm', 'preferredTime', 'preferredDate', 'preferredStartTime', 'preferredEndTime', 'timezone', 'description', 'sourcePage'],
    enquiry: ['email', 'phone', 'iAm', 'subject', 'message', 'sourcePage'],
    hire: ['contactName', 'designation', 'email', 'phone', 'roleTitle', 'industry', 'numberOfPositions', 'location', 'experience', 'employmentType', 'urgency', 'description', 'sourcePage'],
    candidate: ['email', 'phone', 'currentLocation', 'industry', 'discipline', 'totalExperience', 'currentRole', 'noticePeriod', 'linkedinUrl', 'message', 'consent', 'sourcePage'],
}

export const FILE_FIELD = { hire: 'jdFile', candidate: 'resume' }

export const humanize = (s) => String(s)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^./, c => c.toUpperCase())
