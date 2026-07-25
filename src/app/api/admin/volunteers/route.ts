import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { TeamAccount } from "@/models/TeamAccount";
import { Volunteer } from "@/models/Volunteer";
import { withAdminRole } from "@/lib/apiAuth";
import {
  isLocationTeamRole,
  isTeamAccountRole,
  FIELD_TEAM_ROLES,
  LOCATION_TEAM_ROLE,
  TEAM_ACCOUNT_ROLES,
} from "@/lib/roles";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * GET /api/admin/volunteers
 * List akun tim. Tiap entry di-enrich dengan `memberDetails`:
 * array { volunteerId, name, role, joinedAt }, supaya UI admin tidak perlu
 * fetch registry manual untuk setiap tim.
 */
export const GET = withAdminRole(async () => {
  try {

    await connectDB();
    const teamAccounts = await TeamAccount.find({ role: { $in: TEAM_ACCOUNT_ROLES } })
      .sort({ createdAt: -1 })
      .lean();

    // Kumpulkan semua volunteerId dari members[].
    const allMemberIds: mongoose.Types.ObjectId[] = teamAccounts.flatMap(
      (v) =>
        (
          (v as { members?: { volunteerId: mongoose.Types.ObjectId }[] }).members ?? []
        ).map((m) => m.volunteerId),
    );
    const registry = await Volunteer.find({ _id: { $in: allMemberIds } })
      .select({ _id: 1, name: 1, isActive: 1 })
      .lean();
    const registryMap = new Map(
      registry.map((r) => [String(r._id), r as { name: string; isActive: boolean }]),
    );

    const enriched = teamAccounts.map((v) => {
      const tv = v as {
        role?: string;
        members?: { volunteerId: unknown; role: string; joinedAt?: Date }[];
      };
      const memberDetails = (tv.members ?? []).map((m) => {
        const reg = registryMap.get(String(m.volunteerId));
        return {
          volunteerId: String(m.volunteerId),
          name: reg?.name ?? "(tidak ditemukan)",
          isActive: reg?.isActive ?? false,
          role: tv.role === "TIM_AKADEMIK" ? "AKADEMIK" : m.role,
          joinedAt: m.joinedAt,
        };
      });
      return { ...v, memberDetails };
    });

    return NextResponse.json({ teamAccounts: enriched, volunteers: enriched });
  } catch (error) {
    console.error("Fetch Team Accounts Error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data akun tim" },
      { status: 500 },
    );
  }
});

/**
 * POST /api/admin/volunteers
 * Buat akun tim baru. Body: { email, password, teamName?, region?, name? }.
 * `members` belum di-set di sini — setelah akun dibuat, admin tambah members
 * via PATCH /api/admin/volunteers/[id]/members.
 */
export const POST = withAdminRole(async (request) => {
  try {

    const body = await request.json();
    const { name, email, teamName, region, password } = body;
    const role = typeof body.role === "string" ? body.role.trim().toUpperCase() : LOCATION_TEAM_ROLE;
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedRegion = typeof region === "string" ? region.trim() : "";

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: "Email dan Password wajib diisi" },
        { status: 400 },
      );
    }
    if (!isTeamAccountRole(role)) {
      return NextResponse.json(
        { error: "Jenis akun tidak valid" },
        { status: 400 },
      );
    }
    const isFieldTeam = isLocationTeamRole(role);
    if (isFieldTeam && !normalizedRegion) {
      return NextResponse.json(
        { error: "Lokasi Belajar wajib diisi untuk akun Tim Kelas" },
        { status: 400 },
      );
    }

    await connectDB();

    const existing = await TeamAccount.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 },
      );
    }
    if (isFieldTeam) {
      const duplicateTeam = await TeamAccount.findOne({
        role: { $in: FIELD_TEAM_ROLES },
        region: { $regex: new RegExp(`^${escapeRegex(normalizedRegion)}$`, "i") },
      }).select({ _id: 1, teamName: 1, region: 1 });
      if (duplicateTeam) {
        return NextResponse.json(
          {
            error: `Akun Tim Kelas untuk ${duplicateTeam.region ?? normalizedRegion} sudah ada.`,
          },
          { status: 400 },
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newTeamAccount = await TeamAccount.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      teamName,
      region: isFieldTeam ? normalizedRegion : "",
      role: isFieldTeam ? LOCATION_TEAM_ROLE : role,
      members: [],
    });

    return NextResponse.json({
      message: "Akun tim berhasil ditambahkan",
      teamAccount: newTeamAccount,
      volunteer: newTeamAccount,
    });
  } catch (error) {
    console.error("Create Team Account Error:", error);
    return NextResponse.json(
      { error: "Gagal menambah akun tim" },
      { status: 500 },
    );
  }
});
