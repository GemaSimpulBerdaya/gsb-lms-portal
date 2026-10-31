import assert from "node:assert/strict";
import { MongoClient, ObjectId } from "mongodb";
import { SignJWT } from "jose";

// Isolated fixtures only. Never load .env.local or accept a remote database.
const uri = "mongodb://127.0.0.1:27028/gsb_lms_schedule_regression?directConnection=true";
const base = "http://127.0.0.1:3028";
const client = new MongoClient(uri);
await client.connect();
try {
  const db = client.db();
  const region = "Offline Sasak Panjang";
  const fase = "FASE TUNAS & PUCUK";
  const semester = `test-${new ObjectId()}`;
  const volunteerId = new ObjectId();
  const inactiveId = new ObjectId();
  const otherId = new ObjectId();
  const teamId = new ObjectId();
  await db.collection("settings").updateOne({ key: "faseConfig" }, { $set: { value: { [fase]: {} } } }, { upsert: true });
  await db.collection("team_accounts").insertOne({ _id: teamId, region, role: "TIM_PEKAN", teamName: "Regression test", members: [] });
  await db.collection("volunteers").insertMany([
    { _id: volunteerId, name: "Test All Regions", assignmentRegion: "Semua Lokasi", assignmentRole: "Pengajar", isActive: true },
    { _id: inactiveId, name: "Test Inactive", assignmentRegion: "Semua Lokasi", isActive: false },
    { _id: otherId, name: "Test Other Region", assignmentRegion: "Offline Depok", isActive: true },
  ]);
  const token = await new SignJWT({ id: String(new ObjectId()), role: "ADMIN", email: "test@example.invalid" })
    .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("10m")
    .sign(new TextEncoder().encode("gsb-local-regression-only-secret"));
  async function api(path, method = "GET", body) {
    const response = await fetch(base + path, { method, headers: { "Content-Type": "application/json", Cookie: `gsb_lms_session=${token}` }, body: body ? JSON.stringify(body) : undefined });
    const data = await response.json();
    assert(response.ok, `${method} ${path}: ${response.status} ${JSON.stringify(data)}`);
    return data;
  }
  const options = await api(`/api/admin/team-members-by-region?region=${encodeURIComponent(region)}`);
  assert(options.members.some((m) => m.volunteerId === String(volunteerId)));
  console.log("PASS picker includes all-region volunteer without team membership");
  const payload = { region, fase, semester, kbmDates: [{ week: 1, date: "2026-11-01", topic: "Regression", petugas: [volunteerId, inactiveId, otherId].map(String) }] };
  await api("/api/admin/schedules", "POST", payload);
  let saved = await db.collection("schedules").findOne({ semester });
  assert(saved);
  assert.deepEqual(saved.kbmDates[0].petugas.map(String), [String(volunteerId)]);
  console.log("PASS POST persists all-region ID; rejects inactive and unrelated-region IDs (DB read-back)");
  await api("/api/admin/schedules", "PUT", { ...payload, id: String(saved._id), kbmDates: [{ ...payload.kbmDates[0], topic: "Updated regression" }] });
  saved = await db.collection("schedules").findOne({ _id: saved._id });
  assert.deepEqual(saved.kbmDates[0].petugas.map(String), [String(volunteerId)]);
  assert.equal(saved.kbmDates[0].topic, "Updated regression");
  console.log("PASS PUT retains all-region ID (DB read-back)");
  const list = await api(`/api/admin/schedules?semester=${encodeURIComponent(semester)}`);
  const schedule = list.schedules.find((s) => s._id === String(saved._id));
  assert(schedule.kbmDates[0].petugas.includes(String(volunteerId)));
  assert.equal(options.members.find((m) => m.volunteerId === String(volunteerId)).name, "Test All Regions");
  console.log("PASS GET returns assignment and member API resolves display name");
} finally {
  await client.close();
}
