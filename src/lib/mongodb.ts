import mongoose from "mongoose";

const MONGODB_OLD_URI = process.env.MONGODB_OLD_URI!;
const MONGODB_LMS_URI = process.env.MONGODB_LMS_URI!;

if (!MONGODB_OLD_URI || !MONGODB_LMS_URI) {
  throw new Error("Please define the MONGODB_OLD_URI and MONGODB_LMS_URI environment variables inside .env.local");
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = {
    authConn: null,
    lmsConn: null,
    authPromise: null,
    lmsPromise: null,
  };
}

async function connectToDatabases() {
  if (cached.authConn && cached.lmsConn) {
    return { authConn: cached.authConn, lmsConn: cached.lmsConn };
  }

  // Database Connection for Auth (DB Lama)
  if (!cached.authPromise) {
    cached.authPromise = mongoose.createConnection(MONGODB_OLD_URI).asPromise();
  }

  // Database Connection for LMS (DB Baru)
  if (!cached.lmsPromise) {
    cached.lmsPromise = mongoose.createConnection(MONGODB_LMS_URI).asPromise();
  }

  cached.authConn = await cached.authPromise;
  cached.lmsConn = await cached.lmsPromise;

  return { authConn: cached.authConn, lmsConn: cached.lmsConn };
}

export default connectToDatabases;
