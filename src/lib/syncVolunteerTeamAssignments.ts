import mongoose, { Types } from "mongoose";
import { TeamAccount } from "@/models/TeamAccount";
import { Volunteer } from "@/models/Volunteer";
import { LOCATION_TEAM_ROLE } from "@/lib/roles";
import { mapAssignmentRolesToTeamMemberRole } from "@/lib/volunteerRegistryImportMapping";

const normalizeRegion = (value: unknown) => String(value ?? "").trim().toLowerCase();

/** Sinkronkan lokasi dan role registry ke TeamAccount.members[]. */
export async function syncVolunteerTeamAssignments(
  volunteerIds: (Types.ObjectId | string)[],
) {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const volunteers = await Volunteer.find({ _id: { $in: volunteerIds } })
        .select({ _id: 1, isActive: 1, assignmentRegion: 1, assignmentRole: 1, assignmentRoles: 1 })
        .session(session)
        .lean();
      const teams = await TeamAccount.find({ role: LOCATION_TEAM_ROLE })
        .select({ _id: 1, region: 1 })
        .session(session)
        .lean();
      const teamByRegion = new Map(
        teams.map((team) => [normalizeRegion(team.region), team]),
      );

      for (const volunteer of volunteers) {
        const volunteerId = volunteer._id;
        const targetTeam = volunteer.isActive
          ? teamByRegion.get(normalizeRegion(volunteer.assignmentRegion))
          : undefined;
        if (volunteer.isActive && !targetTeam) {
          throw new Error(
            `Akun Tim Kelas untuk ${volunteer.assignmentRegion || "lokasi relawan"} belum tersedia`,
          );
        }

        await TeamAccount.updateMany(
          {
            role: LOCATION_TEAM_ROLE,
            ...(targetTeam ? { _id: { $ne: targetTeam._id } } : {}),
            "members.volunteerId": volunteerId,
          },
          { $pull: { members: { volunteerId } } },
          { session },
        );

        if (!targetTeam) continue;

        const role = mapAssignmentRolesToTeamMemberRole(
          volunteer.assignmentRoles?.length
            ? volunteer.assignmentRoles
            : volunteer.assignmentRole,
        );
        const existing = await TeamAccount.updateOne(
          { _id: targetTeam._id, "members.volunteerId": volunteerId },
          { $set: { "members.$.role": role } },
          { session },
        );
        if (existing.matchedCount === 0) {
          await TeamAccount.updateOne(
            { _id: targetTeam._id, "members.volunteerId": { $ne: volunteerId } },
            {
              $push: {
                members: { volunteerId, role, joinedAt: new Date() },
              },
            },
            { session },
          );
        }
      }
    });
  } finally {
    await session.endSession();
  }
}