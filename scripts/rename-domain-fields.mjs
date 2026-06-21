import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config({ path: ".env.local" });

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");

const uri = process.env.MONGODB_LMS_URI;
if (!uri) {
  console.error("MONGODB_LMS_URI is required");
  process.exit(1);
}

const RENAMES = [
  { collection: "schedules", from: "relawanId", to: "teamAccountId" },
  { collection: "attendances", from: "relawanId", to: "teamAccountId" },
  { collection: "attendances", from: "anakDidikId", to: "studentId" },
  { collection: "team_attendances", from: "relawanId", to: "teamAccountId" },
  { collection: "reports", from: "relawanId", to: "teamAccountId" },
  { collection: "offline_grades", from: "relawanId", to: "teamAccountId" },
  { collection: "offline_grades", from: "anakDidikId", to: "studentId" },
  { collection: "student_portfolios", from: "relawanId", to: "teamAccountId" },
  { collection: "student_portfolios", from: "anakDidikId", to: "studentId" },
];

const NEW_INDEXES = [
  {
    collection: "schedules",
    key: { teamAccountId: 1, region: 1, fase: 1, semester: 1 },
    options: { unique: true, name: "uniq_schedule_team_region_fase_semester" },
  },
  {
    collection: "attendances",
    key: { studentId: 1, scheduleId: 1, week: 1, semester: 1, date: 1 },
    options: {
      unique: true,
      name: "uniq_attendance_per_schedule_per_pertemuan",
      partialFilterExpression: { scheduleId: { $exists: true } },
    },
  },
  {
    collection: "attendances",
    key: { teamAccountId: 1, semester: 1 },
  },
  {
    collection: "attendances",
    key: { scheduleId: 1, semester: 1, week: 1, date: 1 },
  },
  {
    collection: "attendances",
    key: { semester: 1, date: -1 },
  },
  {
    collection: "team_attendances",
    key: { volunteerId: 1, scheduleId: 1, week: 1, date: 1 },
    options: {
      unique: true,
      name: "uniq_team_attendance_per_pertemuan_per_anggota",
    },
  },
  {
    collection: "team_attendances",
    key: { volunteerId: 1, semester: 1, date: -1 },
  },
  {
    collection: "team_attendances",
    key: { teamAccountId: 1, semester: 1, date: -1 },
  },
  {
    collection: "team_attendances",
    key: { semester: 1, markedAt: -1 },
  },
  {
    collection: "reports",
    key: { teamAccountId: 1, semester: 1, date: -1 },
  },
  {
    collection: "reports",
    key: { semester: 1, date: -1 },
  },
  {
    collection: "offline_grades",
    key: { studentId: 1, type: 1, semester: 1, week: 1 },
    options: {
      unique: true,
      partialFilterExpression: { type: "TUGAS" },
      name: "uniq_tugas_per_pekan",
    },
  },
  {
    collection: "offline_grades",
    key: { studentId: 1, type: 1, semester: 1, subject: 1 },
    options: {
      unique: true,
      partialFilterExpression: { type: "UAS" },
      name: "uniq_uas_per_subject",
    },
  },
  {
    collection: "offline_grades",
    key: { teamAccountId: 1, semester: 1 },
  },
  {
    collection: "offline_grades",
    key: { studentId: 1, semester: 1 },
  },
  {
    collection: "student_portfolios",
    key: { studentId: 1, semester: 1, date: -1 },
  },
  {
    collection: "student_portfolios",
    key: { teamAccountId: 1, semester: 1 },
  },
];

async function collectionExists(db, name) {
  const collections = await db
    .listCollections({ name }, { nameOnly: true })
    .toArray();
  return collections.length > 0;
}

async function inspectRename(db, rename) {
  const exists = await collectionExists(db, rename.collection);
  if (!exists) return { ...rename, collectionExists: false };

  const collection = db.collection(rename.collection);
  const indexes = await collection.indexes();
  const oldIndexes = indexes
    .filter((idx) => Object.prototype.hasOwnProperty.call(idx.key ?? {}, rename.from))
    .map((idx) => idx.name)
    .filter((name) => name && name !== "_id_");

  const [sourceOnly, targetOnly, both] = await Promise.all([
    collection.countDocuments({
      [rename.from]: { $exists: true },
      [rename.to]: { $exists: false },
    }),
    collection.countDocuments({
      [rename.from]: { $exists: false },
      [rename.to]: { $exists: true },
    }),
    collection.countDocuments({
      [rename.from]: { $exists: true },
      [rename.to]: { $exists: true },
    }),
  ]);

  return {
    ...rename,
    collectionExists: true,
    sourceOnly,
    targetOnly,
    both,
    oldIndexes,
    canApply: sourceOnly > 0,
  };
}

async function dropOldIndexes(db, plans) {
  const dropped = [];
  const byCollection = new Map();

  for (const plan of plans) {
    if (!plan.collectionExists || !plan.oldIndexes?.length) continue;
    if (!byCollection.has(plan.collection)) byCollection.set(plan.collection, new Set());
    for (const name of plan.oldIndexes) byCollection.get(plan.collection).add(name);
  }

  for (const [collectionName, indexNames] of byCollection) {
    const collection = db.collection(collectionName);
    for (const indexName of indexNames) {
      try {
        await collection.dropIndex(indexName);
        dropped.push({ collection: collectionName, index: indexName });
      } catch (err) {
        if (err?.codeName !== "IndexNotFound") throw err;
      }
    }
  }

  return dropped;
}

async function applyRename(db, plan) {
  if (!plan.collectionExists || !plan.canApply) return null;
  const result = await db.collection(plan.collection).updateMany(
    {
      [plan.from]: { $exists: true },
      [plan.to]: { $exists: false },
    },
    { $rename: { [plan.from]: plan.to } },
  );
  return {
    collection: plan.collection,
    from: plan.from,
    to: plan.to,
    matched: result.matchedCount,
    modified: result.modifiedCount,
  };
}

async function createNewIndexes(db) {
  const created = [];
  for (const spec of NEW_INDEXES) {
    if (!(await collectionExists(db, spec.collection))) continue;
    const name = await db
      .collection(spec.collection)
      .createIndex(spec.key, spec.options ?? {});
    created.push({ collection: spec.collection, index: name });
  }
  return created;
}

async function main() {
  if (args.has("--help") || args.has("-h")) {
    console.log(`
Usage:
  node scripts/rename-domain-fields.mjs
  node scripts/rename-domain-fields.mjs --apply

Default mode is dry-run.
This renames document fields only when the new field is not already present.
Documents with both old and new fields are reported as conflicts and skipped.
It also drops old indexes that reference legacy fields before renaming and
recreates the current indexes after renaming.
`);
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const db = client.db();
    const plans = [];
    for (const rename of RENAMES) {
      plans.push(await inspectRename(db, rename));
    }

    console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", plans }, null, 2));

    if (!apply) {
      console.log("dry-run only: re-run with --apply to execute.");
      return;
    }

    const results = [];
    const droppedIndexes = await dropOldIndexes(db, plans);
    for (const plan of plans) {
      const result = await applyRename(db, plan);
      if (result) results.push(result);
    }
    const createdIndexes = await createNewIndexes(db);
    console.log(
      JSON.stringify({ droppedIndexes, applied: results, createdIndexes }, null, 2),
    );
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
