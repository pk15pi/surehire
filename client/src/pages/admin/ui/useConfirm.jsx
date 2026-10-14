import React, { useState } from 'react'
import { ConfirmDialog } from './AdminUI'

// ---------------------------------------------------------------------------
// Confirm dialog: const [confirm, dialog] = useConfirm(); ... if (await confirm({...}))
// ---------------------------------------------------------------------------
export const useConfirm = () => {
    const [req, setReq] = useState(null)
    const confirm = (opts) => new Promise(resolve => setReq({ ...opts, resolve }))
    const close = (value) => { req?.resolve(value); setReq(null) }
    const dialog = req ? <ConfirmDialog {...req} onClose={close} /> : null
    return [confirm, dialog]
}
