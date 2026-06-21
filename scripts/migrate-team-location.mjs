import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config({ path: ".env.local" });

const LEGACY_WEEK_ROLES = [
  "TIM_PEKAN_1",
  "TIM_PEKAN_2",
  "TIM_PEKAN_3",
  "TIM_PEKAN_4",
];
const LOCATION_TEAM_ROLE = "TIM_LOKASI";
const FIELD_MEMBER_ROLES = new Set(["FASILITATOR", "PENGAJAR", "DOKUMENTASI"]);
const TEAM_ACCOUNT_COLLECTION =
  process.env.MONGODB_TEAM_ACCOUNT_COLLECTION || "volunteers";

function normalizeMemberRole(role) {
  const normalized = String(role || "").trim().toUpperCase();
  if (normalized === "FACILITATOR" || normalized === "FASILITATOR") return "FASILITATOR";
  if (FIELD_MEMBER_ROLES.has(normalized)) return normalized;
  return "FASILITATOR";
}

function normalizeRegion(region) {
  return String(region || "").trim();
}

function regionKey(region) {
  return normalizeRegion(region).toLowerCase();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function main() {
  const uri = process.env.MONGODB_LMS_URI;
  if (!uri) throw new Error("MONGODB_LMS_URI is missing");

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const volunteers = db.collection(TEAM_ACCOUNT_COLLECTION);
  const schedules = db.collection("schedules");

  const legacyTeams = await volunteers
    .find({ role: { $in: LEGACY_WEEK_ROLES } })
    .sort({ region: 1, role: 1, createdAt: 1 })
    .toArray();

  const byRegion = new Map();
  for (const team of legacyTeams) {
    const region = normalizeRegion(team.region);
    if (!region) {
      console.log(`skip ${team.email || team._id}: empty region`);
      continue;
    }
    const key = regionKey(region);
    if (!byRegion.has(key)) byRegion.set(key, { region, teams: [] });
    byRegion.get(key).teams.push(team);
  }

  const summary = [];

  for (const { region, teams } of byRegion.values()) {
    let target = await volunteers.findOne({
      role: LOCATION_TEAM_ROLE,
      region: { $regex: `^${escapeRegex(region)}$`, $options: "i" },
    });

    if (!target) {
      target = teams[0];
      await volunteers.updateOne(
        { _id: target._id },
        {
          $set: {
            role: LOCATION_TEAM_ROLE,
            region,
            teamName: target.teamName || `Tim ${region}`,
            name: target.teamName || `Tim ${region}`,
          },
        },
      );
      target = await volunteers.findOne({ _id: target._id });
    }

    const memberById = new Map();
    for (const member of target.members || []) {
      memberById.set(String(member.volunteerId), {
        ...member,
        role: normalizeMemberRole(member.role),
        joinedAt: member.joinedAt || new Date(),
      });
    }

    for (const team of teams) {
      for (const member of team.members || []) {
        const id = String(member.volunteerId);
        if (!memberById.has(id)) {
          memberById.set(id, {
            volunteerId: member.volunteerId,
            role: normalizeMemberRole(member.role),
            joinedAt: member.joinedAt || team.createdAt || new Date(),
          });
        }
      }
    }

    const sourceIds = teams
      .map((team) => team._id)
      .filter((id) => String(id) !== String(target._id));

    const movedSchedules = sourceIds.length
      ? await schedules.updateMany(
          { teamAccountId: { $in: sourceIds } },
          { $set: { teamAccountId: target._id, region } },
        )
      : { modifiedCount: 0 };

    await schedules.updateMany(
      { teamAccountId: target._id },
      { $set: { region } },
    );

    await volunteers.updateOne(
      { _id: target._id },
      {
        $set: {
          role: LOCATION_TEAM_ROLE,
          region,
          teamName: target.teamName || `Tim ${region}`,
          name: target.teamName || `Tim ${region}`,
          members: Array.from(memberById.values()),
        },
      },
    );

    const deleted = sourceIds.length
      ? await volunteers.deleteMany({ _id: { $in: sourceIds } })
      : { deletedCount: 0 };

    summary.push({
      region,
      target: target.email || String(target._id),
      mergedTeams: teams.length,
      members: memberById.size,
      schedulesMoved: movedSchedules.modifiedCount,
      deletedTeams: deleted.deletedCount,
    });
  }

  const locationCursor = volunteers.find({
    role: LOCATION_TEAM_ROLE,
    region: { $type: "string", $ne: "" },
  });
  for await (const team of locationCursor) {
    const region = normalizeRegion(team.region);
    const cleanName = `Tim ${region}`;
    await volunteers.updateOne(
      { _id: team._id },
      { $set: { teamName: cleanName, name: cleanName, region } },
    );
  }

  const remainingLegacy = await volunteers.countDocuments({ role: { $in: LEGACY_WEEK_ROLES } });
  const locationTeams = await volunteers.countDocuments({ role: LOCATION_TEAM_ROLE });

  console.log(JSON.stringify({ summary, remainingLegacy, locationTeams }, null, 2));
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
