import './config/instrument.js'
import 'dotenv/config'
import connectDB from './config/db.js'
import connectCloudinary from './config/cloudinary.js'
import { createApp } from './app.js'

// Express app (routes/middleware live in app.js so tests can import them)
const app = createApp()

// Connect to Databse
await connectDB()
await connectCloudinary()

// Port
const PORT = process.env.PORT || 3000

app.listen(PORT,() => {
    console.log(`Server is running on port ${PORT}`);
    
})

// Exported for Vercel's @vercel/node runtime
export default app
