import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { TeamAccount, normalizeTeamMemberRole, type TeamMemberRole } from "@/models/TeamAccount";
import { Volunteer } from "@/models/Volunteer";
import {
  mapAssignmentRolesToTeamMemberRole,
  VOLUNTEER_ALL_REGIONS,
} from "@/lib/volunteerRegistryImportMapping";

/**
 * GET /api/admin/team-members-by-region?region=XXX
 *
 * Admin butuh daftar anggota tim untuk dipilih di modal "Tambah/Edit Jadwal".
 * Karena Admin bukan relawan, nggak bisa pakai /api/volunteer/team-members.
 * API ini cari tim (Relawan) berdasarkan region, lalu resolve nama anggota dari Volunteer registry.
 */
export const GET = withAdmin(async (request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const region = searchParams.get("region");

    if (!region) {
      return NextResponse.json(
        { error: "Parameter 'region' wajib diisi" },
        { status: 400 }
      );
    }

    // Cari tim (Relawan) yang region-nya match — exclude akun admin/super_admin
    const team = await TeamAccount.findOne({
      region,
      role: { $nin: ["SUPER_ADMIN", "ADMIN", "TIM_AKADEMIK"] },
    })
      .select({ members: 1, teamName: 1, region: 1 })
      .lean();

    const rawMembers =
      ((team as {
        members?: { volunteerId: unknown; role: TeamMemberRole; joinedAt?: Date }[];
      })?.members ?? []);

    const volunteerIds = rawMembers.map((m) =>
      typeof m.volunteerId === "object" && m.volunteerId !== null
        ? (m.volunteerId as { toString(): string }).toString()
        : String(m.volunteerId)
    );

    // Resolve nama dari Volunteer registry
    const volunteerDocs = await Volunteer.find({
      isActive: true,
      $or: [
        { _id: { $in: volunteerIds } },
        { assignmentRegion: { $in: [region, VOLUNTEER_ALL_REGIONS] } },
      ],
    })
      .select({ name: 1, assignmentRole: 1, assignmentRoles: 1 })
      .lean();

    const nameById = new Map<string, string>();
    for (const v of volunteerDocs as { _id: unknown; name?: string }[]) {
      nameById.set(String(v._id), v.name ?? "");
    }

    const members: { volunteerId: string; role: string; name: string }[] = rawMembers.map((m) => ({
      volunteerId: String(m.volunteerId),
      role: normalizeTeamMemberRole(m.role) ?? "FASILITATOR",
      name: nameById.get(String(m.volunteerId)) ?? "(tanpa nama)",
    }));
    const existingIds = new Set(members.map((member) => member.volunteerId));
    for (const volunteer of volunteerDocs as {
      _id: unknown;
      name?: string;
      assignmentRole?: string;
      assignmentRoles?: string[];
    }[]) {
      const volunteerId = String(volunteer._id);
      if (existingIds.has(volunteerId)) continue;
      members.push({
        volunteerId,
        role: mapAssignmentRolesToTeamMemberRole(
          volunteer.assignmentRoles?.length
            ? volunteer.assignmentRoles
            : volunteer.assignmentRole,
        ),
        name: volunteer.name ?? "(tanpa nama)",
      });
    }

    return NextResponse.json({
      teamName: (team as { teamName?: string } | null)?.teamName ?? "",
      region,
      members,
    });
  } catch (err) {
    console.error("GET /api/admin/team-members-by-region error:", err);
    return NextResponse.json(
      { error: "Gagal memuat anggota tim" },
      { status: 500 }
    );
  }
});
