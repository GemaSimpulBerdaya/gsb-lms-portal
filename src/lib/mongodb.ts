import mongoose from "mongoose";

const MONGODB_LMS_URI = process.env.MONGODB_LMS_URI!;

if (!MONGODB_LMS_URI) {
  throw new Error("Please define the MONGODB_LMS_URI environment variable inside .env.local");
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongoose: MongooseCache | undefined;
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached!.conn) return cached!.conn;

  if (!cached!.promise) {
    cached!.promise = mongoose.connect(MONGODB_LMS_URI);
  }

  cached!.conn = await cached!.promise;
  return cached!.conn;
}

export default connectDB;
