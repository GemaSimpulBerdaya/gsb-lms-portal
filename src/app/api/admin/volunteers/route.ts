import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";
import { getSessionUser } from "@/lib/session";
import {
  isAdminRole,
  isLocationTeamRole,
  isTeamAccountRole,
  isTimPekanRole,
  LOCATION_TEAM_ROLE,
  TEAM_ACCOUNT_ROLES,
  TIM_PEKAN_ROLES,
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
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const volunteers = await Relawan.find({ role: { $in: TEAM_ACCOUNT_ROLES } })
      .sort({ createdAt: -1 })
      .lean();

    // Kumpulkan semua volunteerId dari members[].
    const allMemberIds: mongoose.Types.ObjectId[] = volunteers.flatMap(
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

    const enriched = volunteers.map((v) => {
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

    return NextResponse.json({ volunteers: enriched });
  } catch (error) {
    console.error("Fetch Volunteers Error:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data relawan" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/volunteers
 * Buat akun tim baru. Body: { email, password, teamName?, region?, name? }.
 * `members` belum di-set di sini — setelah akun dibuat, admin tambah members
 * via PATCH /api/admin/volunteers/[id]/members.
 */
export async function POST(request: Request) {
  try {
    const user = await getSessionUser();
    if (!user || !isAdminRole(user.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    const isFieldTeam = isLocationTeamRole(role) || isTimPekanRole(role);
    if (isFieldTeam && !normalizedRegion) {
      return NextResponse.json(
        { error: "Lokasi Belajar wajib diisi untuk akun Tim Lokasi" },
        { status: 400 },
      );
    }

    await connectDB();

    const existing = await Relawan.findOne({ email: normalizedEmail });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 },
      );
    }
    if (isFieldTeam) {
      const duplicateTeam = await Relawan.findOne({
        role: { $in: [LOCATION_TEAM_ROLE, ...TIM_PEKAN_ROLES] },
        region: { $regex: new RegExp(`^${escapeRegex(normalizedRegion)}$`, "i") },
      }).select({ _id: 1, teamName: 1, region: 1 });
      if (duplicateTeam) {
        return NextResponse.json(
          {
            error: `Akun Tim Lokasi untuk ${duplicateTeam.region ?? normalizedRegion} sudah ada.`,
          },
          { status: 400 },
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newVolunteer = await Relawan.create({
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
      volunteer: newVolunteer,
    });
  } catch (error) {
    console.error("Create Volunteer Error:", error);
    return NextResponse.json(
      { error: "Gagal menambah relawan" },
      { status: 500 },
    );
  }
}
