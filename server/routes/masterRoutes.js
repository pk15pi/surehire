import express from 'express'
import {
    activateMaster, createMaster, deactivateMaster, deleteMaster, getMaster, listMaster, listMasterTypes, publicMasterList, updateMaster,
} from '../master/masterController.js'

// Admin router factory (mounted under /api/admin/master after protectAdmin)
export const createAdminMasterRouter = () => {
    const router = express.Router()
    router.get('/', listMasterTypes)
    router.get('/:type', listMaster)
    router.post('/:type', createMaster)
    router.get('/:type/:id', getMaster)
    router.patch('/:type/:id', updateMaster)
    router.delete('/:type/:id', deleteMaster)
    router.post('/:type/:id/activate', activateMaster)
    router.post('/:type/:id/deactivate', deactivateMaster)
    return router
}

// Public read-only router (mounted under /api/master)
export const createPublicMasterRouter = () => {
    const router = express.Router()
    router.get('/:type', publicMasterList)
    return router
}
