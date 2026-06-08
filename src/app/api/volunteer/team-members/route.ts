import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import {
  Relawan,
  normalizeTeamMemberRole,
  type TeamMemberRole,
} from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";

/**
 * GET /api/volunteer/team-members
 *
 * Daftar anggota tim untuk akun relawan (Relawan) yang sedang login.
 * Dipakai di halaman Jadwal untuk memilih "petugas" yang bertugas di tiap
 * pertemuan KBM saat membuat / mengedit jadwal.
 *
 * Nama di-resolve server-side dari registry `Volunteer` supaya client tidak
 * perlu hit endpoint admin (yang akan menolak akun volunteer).
 */
export const GET = withVolunteer(async (_request, user) => {
  try {
    await connectDB();

    const team = await Relawan.findById(user.id)
      .select({ members: 1, teamName: 1, region: 1 })
      .lean();

    const rawMembers =
      ((team as {
        members?: { volunteerId: unknown; role: TeamMemberRole; joinedAt?: Date }[];
      })?.members ?? []);

    const volunteerIds = rawMembers.map((m) =>
      typeof m.volunteerId === "object" && m.volunteerId !== null
        ? (m.volunteerId as { toString(): string }).toString()
        : String(m.volunteerId),
    );

    const volunteerDocs = await Volunteer.find({ _id: { $in: volunteerIds } })
      .select({ name: 1 })
      .lean();
    const nameById = new Map<string, string>();
    for (const v of volunteerDocs as { _id: unknown; name?: string }[]) {
      nameById.set(String(v._id), v.name ?? "");
    }

    const members = rawMembers.map((m) => ({
      volunteerId: String(m.volunteerId),
      role: normalizeTeamMemberRole(m.role) ?? "FASILITATOR",
      name: nameById.get(String(m.volunteerId)) ?? "(tanpa nama)",
    }));

    return NextResponse.json({
      teamName: (team as { teamName?: string })?.teamName ?? "",
      region: (team as { region?: string })?.region ?? "",
      members,
    });
  } catch (err) {
    console.error("GET /api/volunteer/team-members error:", err);
    return NextResponse.json(
      { error: "Gagal memuat anggota tim" },
      { status: 500 },
    );
  }
});
