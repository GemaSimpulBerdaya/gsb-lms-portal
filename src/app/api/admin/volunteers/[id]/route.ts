import { NextResponse } from "next/server";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { getSessionUser } from "@/lib/session";

interface Ctx {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
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
    const update: Record<string, unknown> = {};
    if (typeof body.name === "string") update.name = body.name.trim();
    if (typeof body.teamName === "string") update.teamName = body.teamName.trim();
    if (typeof body.region === "string") update.region = body.region.trim();
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
