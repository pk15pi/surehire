import MasterItem from '../models/MasterItem.js'
import Location from '../models/Location.js'
import Client from '../models/Client.js'
import ExperienceLevel from '../models/ExperienceLevel.js'
import { normalizeKey } from '../utils/normalize.js'

// ---------------------------------------------------------------------------
// Master-data registry: one config per URL type drives the generic admin
// controller, the public read endpoint, job reference validation and the UI.
//   model       mongoose model
//   itemType    discriminator value for MasterItem-backed lists
//   jobField    Job field referencing this list (array fields end with "Ids")
//   fields      editable fields: { kind, required, max, min, ... }
//   publicFields fields exposed by GET /api/master/:type (active only)
//   refs        other collections referencing this list (counted as usage)
// ---------------------------------------------------------------------------

const common = {
    name: { kind: 'string', required: true, max: 150 },
    description: { kind: 'string', max: 1000 },
    displayOrder: { kind: 'number', min: -100000, max: 100000, integer: true },
}

const nameKey = (doc) => normalizeKey(doc.name)

const simple = (itemType, label, singular, jobField, extra = {}) => ({
    model: MasterItem, itemType, label, singular, jobField,
    fields: { ...common, ...(extra.fields || {}) },
    keyOf: nameKey,
    publicFields: ['name', ...(extra.publicFields || [])],
    searchFields: ['name', 'description', ...(extra.searchFields || [])],
    refs: extra.refs || [],
    validate: extra.validate,
})

export const MASTER_TYPES = {
    categories: simple('category', 'Job categories', 'Job category', 'categoryId', {
        refs: [{ model: MasterItem, field: 'categoryId', label: 'skill(s)', filter: { type: 'skill' } }],
    }),
    'employment-types': simple('employmentType', 'Employment types', 'Employment type', 'employmentTypeId'),
    'workplace-types': simple('workplaceType', 'Workplace types', 'Workplace type', 'workplaceTypeId'),
    industries: simple('industry', 'Industries', 'Industry', 'industryId', {
        refs: [{ model: Client, field: 'industryId', label: 'client(s)' }],
    }),
    departments: simple('department', 'Departments', 'Department', 'departmentId'),
    currencies: simple('currency', 'Currencies', 'Currency', 'currencyId', {
        fields: { code: { kind: 'string', required: true, max: 3, pattern: /^[A-Za-z]{3}$/, patternMessage: 'Code must be a 3-letter ISO code (e.g. INR)', upper: true } },
        publicFields: ['code'], searchFields: ['code'],
    }),
    'salary-periods': simple('salaryPeriod', 'Salary periods', 'Salary period', 'salaryPeriodId'),
    skills: simple('skill', 'Skills', 'Skill', 'skillIds', {
        fields: { categoryId: { kind: 'ref', type: 'categories' } },
        publicFields: ['categoryId'],
    }),
    'experience-levels': {
        model: ExperienceLevel, label: 'Experience levels', singular: 'Experience level', jobField: 'experienceLevelId',
        fields: {
            ...common,
            minYears: { kind: 'number', min: 0, max: 60 },
            maxYears: { kind: 'number', min: 0, max: 60 },
        },
        keyOf: nameKey,
        publicFields: ['name', 'minYears', 'maxYears'],
        searchFields: ['name', 'description'],
        refs: [],
        validate: (doc) => (doc.minYears != null && doc.maxYears != null && doc.minYears > doc.maxYears)
            ? { maxYears: 'Maximum years must be greater than or equal to minimum years' } : null,
    },
    locations: {
        model: Location, label: 'Locations', singular: 'Location', jobField: 'locationIds',
        fields: {
            ...common,
            city: { kind: 'string', max: 100 },
            state: { kind: 'string', max: 100 },
            country: { kind: 'string', max: 100 },
            postalCode: { kind: 'string', max: 20 },
            address: { kind: 'string', max: 500 },
        },
        // Same city/state/country = same location, whatever the display name
        keyOf: (doc) => doc.city ? [doc.city, doc.state, doc.country].map(normalizeKey).join('|') : normalizeKey(doc.name),
        publicFields: ['name', 'city', 'state', 'country'],
        searchFields: ['name', 'city', 'state', 'country', 'postalCode'],
        refs: [],
    },
    clients: {
        model: Client, label: 'Clients', singular: 'Client', jobField: 'clientId',
        fields: {
            ...common,
            code: { kind: 'string', required: true, max: 30, pattern: /^[A-Za-z0-9][A-Za-z0-9_-]{0,29}$/, patternMessage: 'Code may contain letters, digits, - and _', upper: true },
            contactPerson: { kind: 'string', max: 150 },
            email: { kind: 'string', max: 254, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, patternMessage: 'Enter a valid email address' },
            phone: { kind: 'string', max: 40, pattern: /^[0-9+()\-.\s]{5,40}$/, patternMessage: 'Enter a valid phone number' },
            website: { kind: 'string', max: 300, pattern: /^https?:\/\/[^\s]+$/i, patternMessage: 'Website must start with http:// or https://' },
            industryId: { kind: 'ref', type: 'industries' },
            address: { kind: 'string', max: 500 },
            confidential: { kind: 'boolean' },
            internalNotes: { kind: 'string', max: 10000 },
        },
        keyOf: nameKey,
        adminSelect: '+internalNotes',
        // Only id + name of non-confidential clients are public
        publicFields: ['name'],
        publicFilter: { confidential: { $ne: true } },
        searchFields: ['name', 'code', 'contactPerson', 'email'],
        refs: [],
    },
}

export const typeFilter = (cfg) => (cfg.itemType ? { type: cfg.itemType } : {})
export const getMasterConfig = (type) => (Object.prototype.hasOwnProperty.call(MASTER_TYPES, type) ? MASTER_TYPES[type] : null)
