import multer from "multer";
import path from "path";

// In-memory upload for enquiry documents (resume / JD). Files are validated and
// then streamed to Cloudinary; nothing is written to local disk.
export const MAX_DOC_SIZE = 5 * 1024 * 1024 // 5 MB

export const ALLOWED_DOC_TYPES = {
    '.pdf': ['application/pdf'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const allowedMimes = ALLOWED_DOC_TYPES[ext]
    if (!allowedMimes || !allowedMimes.includes(file.mimetype)) {
        const err = new Error('Only PDF or DOCX files are allowed')
        err.code = 'INVALID_FILE_TYPE'
        return cb(err)
    }
    cb(null, true)
}

const enquiryUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_DOC_SIZE, files: 1, fields: 40, fieldSize: 20 * 1024 },
    fileFilter,
})

// Verify file signature (magic bytes) so a renamed file can't slip through
export const hasValidSignature = (file) => {
    if (!file?.buffer || file.buffer.length < 4) return false
    const ext = path.extname(file.originalname || '').toLowerCase()
    const b = file.buffer
    if (ext === '.pdf') return b.slice(0, 4).toString('latin1') === '%PDF'
    if (ext === '.docx') return b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04 // ZIP "PK\x03\x04"
    return false
}

// Wrap multer.single so upload errors come back as {success:false, message}
export const singleDocUpload = (fieldName) => (req, res, next) => {
    enquiryUpload.single(fieldName)(req, res, (err) => {
        if (!err) return next()
        if (err.code === 'INVALID_FILE_TYPE') {
            return res.status(400).json({ success: false, message: err.message })
        }
        if (err instanceof multer.MulterError) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? 'File is too large. Maximum size is 5 MB'
                : err.code === 'LIMIT_UNEXPECTED_FILE'
                    ? 'Unexpected file field'
                    : 'File upload failed'
            return res.status(400).json({ success: false, message })
        }
        return res.status(400).json({ success: false, message: 'Invalid upload request' })
    })
}

export default enquiryUpload
