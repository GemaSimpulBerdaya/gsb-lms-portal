import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { Volunteer } from "@/models/Volunteer";
import { Relawan } from "@/models/Relawan";
import { TeamAttendance } from "@/models/TeamAttendance";
import { getSessionUser } from "@/lib/session";

interface Ctx {
  params: Promise<{ id: string }>;
}

async function ensureAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "SUPER_ADMIN") {
    return null;
  }
  return user;
}

/**
 * GET /api/admin/volunteer-registry/[id]
 * Detail registry + ringkasan kehadiran lifetime.
 */
export async function GET(_req: Request, { params }: Ctx) {
  try {
    const user = await ensureAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    await connectDB();
    const volunteer = await Volunteer.findById(id).lean();
    if (!volunteer) {
      return NextResponse.json(
        { error: "Relawan tidak ditemukan" },
        { status: 404 },
      );
    }

    // Tim aktif saat ini.
    const team = await Relawan.findOne({
      role: "RELAWAN",
      "members.volunteerId": id,
    })
      .select({ _id: 1, teamName: 1, region: 1, members: 1 })
      .lean();

    let currentTeam: {
      id: string;
      teamName?: string;
      region?: string;
      role: string;
      joinedAt?: Date;
    } | null = null;
    if (team) {
      const t = team as {
        _id: unknown;
        teamName?: string;
        region?: string;
        members?: {
          volunteerId: unknown;
          role: string;
          joinedAt?: Date;
        }[];
      };
      const m = t.members?.find((x) => String(x.volunteerId) === id);
      if (m) {
        currentTeam = {
          id: String(t._id),
          teamName: t.teamName,
          region: t.region,
          role: m.role,
          joinedAt: m.joinedAt,
        };
      }
    }

    // Stat lifetime kehadiran (ringkas).
    const stats = await TeamAttendance.aggregate([
      { $match: { volunteerId: new mongoose.Types.ObjectId(id) } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);

    return NextResponse.json({ volunteer, currentTeam, stats });
  } catch (err) {
    console.error("GET /api/admin/volunteer-registry/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat detail relawan" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/volunteer-registry/[id]
 * Update field registry. Field allowlist: name, phone, email, joinedYear,
 * isActive, notes.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  try {
    const user = await ensureAdmin();
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
    if (typeof body.name === "string" && body.name.trim()) {
      update.name = body.name.trim();
    }
    if (typeof body.phone === "string") update.phone = body.phone.trim();
    if (typeof body.email === "string") {
      const e = body.email.trim().toLowerCase();
      update.email = e || undefined;
      if (e) {
        const dupe = await Volunteer.findOne({
          email: e,
          _id: { $ne: id },
        });
        if (dupe) {
          return NextResponse.json(
            { error: "Email kontak sudah dipakai oleh relawan lain" },
            { status: 400 },
          );
        }
      }
    }
    if (typeof body.joinedYear === "number") update.joinedYear = body.joinedYear;
    if (typeof body.isActive === "boolean") update.isActive = body.isActive;
    if (typeof body.notes === "string") update.notes = body.notes;

    const updated = await Volunteer.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!updated) {
      return NextResponse.json(
        { error: "Relawan tidak ditemukan" },
        { status: 404 },
      );
    }
    return NextResponse.json({ volunteer: updated });
  } catch (err) {
    console.error("PATCH /api/admin/volunteer-registry/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal update relawan" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/volunteer-registry/[id]
 * Soft delete: set isActive=false. Tidak benar-benar hapus untuk menjaga
 * referential integrity dengan TeamAttendance.
 *
 * Kalau ?force=true, hard delete tapi cek dulu: tidak boleh ada attendance
 * record yang refer ke orang ini (proteksi data).
 */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const user = await ensureAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    await connectDB();
    const { searchParams } = new URL(request.url);
    const force = searchParams.get("force") === "true";

    if (force) {
      const refCount = await TeamAttendance.countDocuments({ volunteerId: id });
      if (refCount > 0) {
        return NextResponse.json(
          {
            error: `Tidak bisa hapus permanen: relawan ini punya ${refCount} record kehadiran. Pakai soft delete (isActive=false) saja.`,
          },
          { status: 400 },
        );
      }
      // Cabut dari tim manapun.
      await Relawan.updateMany(
        { "members.volunteerId": id },
        { $pull: { members: { volunteerId: id } } },
      );
      await Volunteer.findByIdAndDelete(id);
      return NextResponse.json({ message: "Relawan dihapus permanen" });
    }

    const updated = await Volunteer.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );
    if (!updated) {
      return NextResponse.json(
        { error: "Relawan tidak ditemukan" },
        { status: 404 },
      );
    }
    // Kalau di-deactivate, otomatis cabut dari tim aktif (mencegah orang
    // alumni masih ke-list di anggota tim).
    await Relawan.updateMany(
      { "members.volunteerId": id },
      { $pull: { members: { volunteerId: id } } },
    );
    return NextResponse.json({
      message: "Relawan dinonaktifkan & dilepas dari tim aktif",
    });
  } catch (err) {
    console.error("DELETE /api/admin/volunteer-registry/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus relawan" },
      { status: 500 },
    );
  }
}
