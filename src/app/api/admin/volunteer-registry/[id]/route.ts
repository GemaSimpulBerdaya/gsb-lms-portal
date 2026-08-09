import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import mongoose from "mongoose";
import { Volunteer } from "@/models/Volunteer";
import { TeamAccount } from "@/models/TeamAccount";
import { TeamAttendance } from "@/models/TeamAttendance";
import { withAdmin } from "@/lib/apiAuth";
import { TEAM_ACCOUNT_ROLES } from "@/lib/roles";
import { syncVolunteerTeamAssignments } from "@/lib/syncVolunteerTeamAssignments";

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/volunteer-registry/[id]
 * Detail registry + ringkasan kehadiran lifetime.
 */
export const GET = withAdmin<Ctx>(async (_req, _session, { params }) => {
  try {
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
    const team = await TeamAccount.findOne({
      role: { $in: TEAM_ACCOUNT_ROLES },
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

    return NextResponse.json({
      registryEntry: volunteer,
      volunteer,
      currentTeam,
      stats,
    });
  } catch (err) {
    console.error("GET /api/admin/volunteer-registry/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal memuat detail relawan" },
      { status: 500 },
    );
  }
});

/**
 * PATCH /api/admin/volunteer-registry/[id]
 * Update field registry. Field allowlist: name, phone, email, joinedYear,
 * isActive, notes.
 */
export const PATCH = withAdmin<Ctx>(async (request, _session, { params }) => {
  try {
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
    if (typeof body.assignmentRegion === "string") update.assignmentRegion = body.assignmentRegion.trim();
    if (Array.isArray(body.assignmentRoles)) {
      const roles = body.assignmentRoles.map((role: unknown) => String(role).trim()).filter(Boolean);
      update.assignmentRole = roles.join(" & ");
      update.assignmentRoles = roles;
    }
    if (typeof body.assignmentFase === "string") update.assignmentFase = body.assignmentFase.trim();
    if (typeof body.assignmentWeek === "string") update.assignmentWeek = body.assignmentWeek.trim();
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
    const placementChanged =
      typeof body.assignmentRegion === "string" ||
      Array.isArray(body.assignmentRoles) ||
      typeof body.isActive === "boolean";
    if (placementChanged) {
      await syncVolunteerTeamAssignments([updated._id]);
    }
    return NextResponse.json({ registryEntry: updated, volunteer: updated });
  } catch (err) {
    console.error("PATCH /api/admin/volunteer-registry/[id] error:", err);
    return NextResponse.json(
      { error: "Gagal update relawan" },
      { status: 500 },
    );
  }
});

/**
 * DELETE /api/admin/volunteer-registry/[id]
 * Soft delete: set isActive=false. Tidak benar-benar hapus untuk menjaga
 * referential integrity dengan TeamAttendance.
 *
 * Kalau ?force=true, hard delete tapi cek dulu: tidak boleh ada attendance
 * record yang refer ke orang ini (proteksi data).
 */
export const DELETE = withAdmin<Ctx>(async (request, _session, { params }) => {
  try {
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
      await TeamAccount.updateMany(
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
    await TeamAccount.updateMany(
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
});
