import connectDB from "../src/lib/mongodb";
import { Report } from "../src/models/Report";

async function check() {
  await connectDB();
  const count = await Report.countDocuments();
  const samples = await Report.find().limit(5).lean();
  console.log("Total Reports in DB:", count);
  console.log("Sample Reports:", JSON.stringify(samples, null, 2));
  process.exit(0);
}

check();
