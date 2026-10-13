import mongoose from "mongoose";

// Connect to the MongoDB database. Safe to call many times: the connection
// promise is cached (also across warm serverless invocations on Vercel).
const cache = globalThis.__surehireMongo || (globalThis.__surehireMongo = { promise: null, listener: false })

const connectDB = async () => {

    if (mongoose.connection.readyState === 1) return mongoose.connection

    if (!cache.listener) {
        mongoose.connection.on('connected',() => console.log("Database Connected"))
        cache.listener = true
    }

    if (!cache.promise) {
        cache.promise = mongoose.connect(`${process.env.MONGODB_URI}/job-portal`)
            .catch((err) => { cache.promise = null; throw err })
    }

    await cache.promise
    return mongoose.connection

}

export default connectDB
