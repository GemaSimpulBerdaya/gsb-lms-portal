import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { getSessionUser } from "@/lib/session";
import { isAdminRole, isTeamAccountRole, isTimPekanRole } from "@/lib/roles";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface Ctx {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || !isAdminRole(user.role)) return null;
  return user;
}

/**
 * PATCH /api/admin/volunteers/[id]
 * Update field akun tim: teamName, region, name, email, password (opsional).
 * Tidak menyentuh members[] — pakai endpoint /members untuk itu.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    await connectDB();
    const body = await request.json();
    const existingTeam = await Relawan.findById(id).select({ role: 1, region: 1 });
    if (!existingTeam) {
      return NextResponse.json(
        { error: "Akun tim tidak ditemukan" },
        { status: 404 },
      );
    }

    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.teamName === "string") update.teamName = body.teamName.trim();
    if (typeof body.region === "string") update.region = body.region.trim();
    if (typeof body.role === "string") {
      const role = body.role.trim().toUpperCase();
      if (!isTeamAccountRole(role)) {
        return NextResponse.json(
          { error: "Jenis akun tidak valid" },
          { status: 400 },
        );
      }
      update.role = role;
    }
    if (typeof body.email === "string" && body.email.trim()) {
      const e = body.email.trim().toLowerCase();
      const dupe = await Relawan.findOne({ email: e, _id: { $ne: id } });
      if (dupe) {
        return NextResponse.json(
          { error: "Email sudah terdaftar di akun lain" },
          { status: 400 },
        );
      }
      update.email = e;
    }
    if (typeof body.password === "string" && body.password.trim()) {
      update.password = await bcrypt.hash(body.password, 10);
    }

    const nextRole = typeof update.role === "string" ? update.role : existingTeam.role;
    const nextRegion =
      typeof update.region === "string" ? update.region : (existingTeam.region ?? "");
    if (isTimPekanRole(nextRole)) {
      if (!nextRegion.trim()) {
        return NextResponse.json(
          { error: "Lokasi Belajar wajib diisi untuk akun Tim Pekan" },
          { status: 400 },
        );
      }
      const duplicateTeam = await Relawan.findOne({
        _id: { $ne: id },
        role: nextRole,
        region: { $regex: new RegExp(`^${escapeRegex(nextRegion.trim())}$`, "i") },
      }).select({ _id: 1, teamName: 1, region: 1 });
      if (duplicateTeam) {
        return NextResponse.json(
          {
            error: `Akun ${String(nextRole).replaceAll("_", " ")} untuk ${duplicateTeam.region ?? nextRegion} sudah ada.`,
          },
          { status: 400 },
        );
      }
    }

    const updated = await Relawan.findByIdAndUpdate(id, update, { new: true });
    if (!updated) {
      return NextResponse.json(
        { error: "Akun tim tidak ditemukan" },
        { status: 404 },
      );
    }
    return NextResponse.json({ volunteer: updated });
  } catch (err) {
    console.error("PATCH /api/admin/volunteers/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal update akun tim" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/volunteers/[id]
 * Hapus akun tim. Members[] otomatis ikut hilang. Volunteer registry TIDAK
 * disentuh (orang-orang tetap ada di registry, hanya tidak punya tim aktif).
 */
export async function DELETE(_request: Request, { params }: Ctx) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    await connectDB();
    const deleted = await Relawan.findByIdAndDelete(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Akun tim tidak ditemukan" },
        { status: 404 },
      );
    }
    return NextResponse.json({ message: "Akun tim berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /api/admin/volunteers/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus akun tim" },
      { status: 500 },
    );
  }
}
