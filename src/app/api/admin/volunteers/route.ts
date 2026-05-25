import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";
import { getSessionUser } from "@/lib/session";

/**
 * GET /api/admin/volunteers
 * List akun tim. Tiap entry di-enrich dengan `memberDetails`:
 * array { volunteerId, name, role, joinedAt }, supaya UI admin tidak perlu
 * fetch registry manual untuk setiap tim.
 */
export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const volunteers = await Relawan.find({ role: "RELAWAN" })
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
        members?: { volunteerId: unknown; role: string; joinedAt?: Date }[];
      };
      const memberDetails = (tv.members ?? []).map((m) => {
        const reg = registryMap.get(String(m.volunteerId));
        return {
          volunteerId: String(m.volunteerId),
          name: reg?.name ?? "(tidak ditemukan)",
          isActive: reg?.isActive ?? false,
          role: m.role,
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
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, email, teamName, region, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan Password wajib diisi" },
        { status: 400 },
      );
    }

    await connectDB();

    const existing = await Relawan.findOne({ email });
    if (existing) {
      return NextResponse.json(
        { error: "Email sudah terdaftar" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newVolunteer = await Relawan.create({
      name,
      email,
      password: hashedPassword,
      teamName,
      region,
      role: "RELAWAN",
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
