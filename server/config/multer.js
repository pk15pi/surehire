import multer from "multer";
import path from "path";

// Disk (tmp) uploads that are forwarded to Cloudinary. Vercel rejects request
// bodies over 4.5 MB before they reach the function, so cap files at 4 MB to
// return a clear error instead of an opaque platform 413.
export const MAX_UPLOAD_SIZE = 4 * 1024 * 1024

const storage = multer.diskStorage({})

const makeUpload = (allowed, label) => multer({
    storage,
    limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase()
        if (allowed[ext] && allowed[ext].includes(file.mimetype)) return cb(null, true)
        const err = new Error(`Only ${label} files are allowed`)
        err.code = 'INVALID_FILE_TYPE'
        cb(err)
    },
})

// Company logo (recruiter registration)
export const imageUpload = makeUpload({
    '.png': ['image/png'], '.jpg': ['image/jpeg'], '.jpeg': ['image/jpeg'], '.webp': ['image/webp'], '.gif': ['image/gif'],
}, 'PNG, JPG, GIF or WEBP image')

// Candidate profile resume (used for "Apply Now")
export const resumeUpload = makeUpload({ '.pdf': ['application/pdf'] }, 'PDF')

// Wrap multer.single so errors come back as {success:false, message}
export const single = (uploader, field) => (req, res, next) => {
    uploader.single(field)(req, res, (err) => {
        if (!err) return next()
        const message = err.code === 'INVALID_FILE_TYPE' ? err.message
            : err.code === 'LIMIT_FILE_SIZE' ? 'File is too large. Maximum size is 4 MB'
            : 'File upload failed'
        return res.status(400).json({ success: false, message })
    })
}

const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_SIZE, files: 1 } })

export default upload
