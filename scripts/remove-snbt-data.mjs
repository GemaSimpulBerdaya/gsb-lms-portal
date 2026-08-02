import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });

const execute = process.argv.includes("--execute");
const SNBT = /snbt/i;

async function main() {
  const uri = process.env.MONGODB_LMS_URI;
  if (!uri) throw new Error("MONGODB_LMS_URI is missing");

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const students = db.collection("students");
  const modules = db.collection("modules");
  const schedules = db.collection("schedules");

  const snbtStudents = await students
    .find({ $or: [{ fase: SNBT }, { region: SNBT }, { program: SNBT }, { kodeKelas: SNBT }] })
    .project({ _id: 1 })
    .toArray();
  const snbtModules = await modules
    .find({ $or: [{ programType: "SNBT" }, { learningLocation: SNBT }, { fase: SNBT }] })
    .project({ _id: 1 })
    .toArray();
  const snbtSchedules = await schedules
    .find({ $or: [{ region: SNBT }, { fase: SNBT }] })
    .project({ _id: 1 })
    .toArray();

  const studentIds = snbtStudents.map(({ _id }) => _id);
  const moduleIds = snbtModules.map(({ _id }) => _id);
  const scheduleIds = snbtSchedules.map(({ _id }) => _id);

  const targets = [
    ["students", { _id: { $in: studentIds } }],
    ["modules", { _id: { $in: moduleIds } }],
    ["schedules", { _id: { $in: scheduleIds } }],
    ["materi_ajar", { $or: [{ programType: "SNBT" }, { learningLocation: SNBT }, { fase: SNBT }] }],
    ["offline_grades", { $or: [{ studentId: { $in: studentIds } }, { moduleId: { $in: moduleIds } }, { scheduleId: { $in: scheduleIds } }, { type: { $in: ["TUGAS_SNBT", "TRYOUT"] } }] }],
    ["attendances", { $or: [{ studentId: { $in: studentIds } }, { scheduleId: { $in: scheduleIds } }] }],
    ["student_portfolios", { $or: [{ studentId: { $in: studentIds } }, { scheduleId: { $in: scheduleIds } }] }],
    ["reports", { $or: [{ scheduleId: { $in: scheduleIds } }, { region: SNBT }, { location: SNBT }, { fase: SNBT }] }],
    ["quizzes", { moduleId: { $in: moduleIds } }],
    ["userprogresses", {}],
  ];

  const counts = {};
  for (const [name, filter] of targets) {
    counts[name] = await db.collection(name).countDocuments(filter);
  }

  const faseConfig = await db.collection("settings").findOne({ key: "faseConfig" });
  const availableRegions = await db.collection("settings").findOne({ key: "availableRegions" });
  counts["settings.faseConfig SNBT keys"] = Object.keys(faseConfig?.value || {}).filter((key) => SNBT.test(key)).length;
  counts["settings.availableRegions SNBT values"] = Array.isArray(availableRegions?.value)
    ? availableRegions.value.filter((value) => SNBT.test(String(value))).length
    : 0;

  console.log(JSON.stringify({ mode: execute ? "execute" : "dry-run", counts }, null, 2));
  if (!execute) return;

  const deleted = {};
  for (const [name, filter] of targets) {
    deleted[name] = (await db.collection(name).deleteMany(filter)).deletedCount;
  }

  if (faseConfig?.value && typeof faseConfig.value === "object") {
    const value = Object.fromEntries(
      Object.entries(faseConfig.value).filter(([key]) => !SNBT.test(key)),
    );
    await db.collection("settings").updateOne({ key: "faseConfig" }, { $set: { value } });
  }
  if (Array.isArray(availableRegions?.value)) {
    const value = availableRegions.value.filter((item) => !SNBT.test(String(item)));
    await db.collection("settings").updateOne({ key: "availableRegions" }, { $set: { value } });
  }

  console.log(JSON.stringify({ deleted }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
