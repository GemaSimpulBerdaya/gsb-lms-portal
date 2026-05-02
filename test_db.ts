import mongoose from "mongoose";
import connectDB from "./src/lib/mongodb.js";
import { Schedule } from "./src/models/Schedule.js";

async function run() {
  await connectDB();
  const indexes = await Schedule.collection.indexes();
  console.log(indexes);
  process.exit(0);
}
run();
