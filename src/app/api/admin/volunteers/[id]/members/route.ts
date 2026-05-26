import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { Relawan, TEAM_MEMBER_ROLES, type TeamMemberRole } from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";
import { getSessionUser } from "@/lib/session";

interface Ctx {
  params: Promise<{ id: string }>;
}

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

function isValidRole(role: unknown): role is TeamMemberRole {
  return typeof role === "string" && (TEAM_MEMBER_ROLES as string[]).includes(role);
}

/**
 * GET /api/admin/volunteers/[id]/members
 * List anggota tim ini, plus detail dari registry (name, isActive).
 */
export async function GET(_req: Request, { params }: Ctx) {
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
    const team = await Relawan.findById(id)
      .select({ members: 1, teamName: 1, region: 1 })
      .lean();
    if (!team) {
      return NextResponse.json(
        { error: "Akun tim tidak ditemukan" },
        { status: 404 },
      );
    }

    const memberIds: mongoose.Types.ObjectId[] =
      (
        (team as { members?: { volunteerId: mongoose.Types.ObjectId }[] }).members ?? []
      ).map((m) => m.volunteerId);
    const registry = await Volunteer.find({ _id: { $in: memberIds } })
      .select({ _id: 1, name: 1, phone: 1, email: 1, isActive: 1 })
      .lean();
    const map = new Map(registry.map((r) => [String(r._id), r]));

    const detailed =
      ((team as {
        members?: {
          volunteerId: unknown;
          role: string;
          joinedAt?: Date;
          _id?: unknown;
        }[];
      }).members ?? []).map((m) => ({
        memberId: String(m._id),
        volunteerId: String(m.volunteerId),
        role: m.role,
        joinedAt: m.joinedAt,
        registry: map.get(String(m.volunteerId)) ?? null,
      }));

    return NextResponse.json({
      teamName: (team as { teamName?: string }).teamName,
      region: (team as { region?: string }).region,
      members: detailed,
    });
  } catch (err) {
    console.error("GET /api/admin/volunteers/[id]/members error:", err);
    return NextResponse.json(
      { error: "Gagal memuat anggota tim" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/admin/volunteers/[id]/members
 * Body: { volunteerId, role, transferFromTeamId? }
 *
 * Tambah orang ke tim ini. Aturan:
 *   - 1 orang hanya boleh di 1 tim aktif.
 *   - Kalau sudah ada di tim lain, request HARUS sertakan
 *     `transferFromTeamId === <currentTeamId>` sebagai konfirmasi pindah.
 *     Server akan: pull dari tim lama, push ke tim ini.
 *   - Kalau orang itu isActive=false → tolak (admin harus aktifkan dulu di
 *     /admin/volunteer-registry).
 */
export async function POST(request: Request, { params }: Ctx) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }

    const body = await request.json();
    const volunteerId = String(body.volunteerId ?? "");
    const role = body.role;
    const transferFromTeamId =
      typeof body.transferFromTeamId === "string"
        ? body.transferFromTeamId
        : null;

    if (!mongoose.Types.ObjectId.isValid(volunteerId)) {
      return NextResponse.json(
        { error: "volunteerId tidak valid" },
        { status: 400 },
      );
    }
    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: `Role harus salah satu dari ${TEAM_MEMBER_ROLES.join(", ")}` },
        { status: 400 },
      );
    }

    await connectDB();

    // Pastikan target team & target volunteer eksis.
    const [team, vol] = await Promise.all([
      Relawan.findById(id),
      Volunteer.findById(volunteerId),
    ]);
    if (!team) {
      return NextResponse.json(
        { error: "Akun tim tidak ditemukan" },
        { status: 404 },
      );
    }
    if (!vol) {
      return NextResponse.json(
        { error: "Relawan tidak ditemukan di registry" },
        { status: 404 },
      );
    }
    if (!vol.isActive) {
      return NextResponse.json(
        {
          error:
            "Relawan ini berstatus tidak aktif. Aktifkan dulu di Volunteer Registry sebelum dimasukkan ke tim.",
        },
        { status: 400 },
      );
    }

    // Sudah anggota tim ini?
    if (team.members.some((m) => String(m.volunteerId) === volunteerId)) {
      return NextResponse.json(
        { error: "Orang ini sudah jadi anggota tim ini" },
        { status: 400 },
      );
    }

    // Cek tim lain yang sudah punya orang ini.
    const currentTeam = await Relawan.findOne({
      role: "RELAWAN",
      _id: { $ne: id },
      "members.volunteerId": volunteerId,
    }).select({ _id: 1, teamName: 1, region: 1 });

    if (currentTeam) {
      // Konfirmasi pindah wajib.
      if (transferFromTeamId !== String(currentTeam._id)) {
        return NextResponse.json(
          {
            error: "TRANSFER_REQUIRED",
            message: `Orang ini sudah anggota tim "${currentTeam.teamName ?? currentTeam._id}". Konfirmasi pindah dengan kirim transferFromTeamId.`,
            currentTeam: {
              id: String(currentTeam._id),
              teamName: currentTeam.teamName,
              region: currentTeam.region,
            },
          },
          { status: 409 },
        );
      }
      // Pull dari tim lama.
      await Relawan.updateOne(
        { _id: currentTeam._id },
        { $pull: { members: { volunteerId } } },
      );
    }

    // Push ke tim ini.
    team.members.push({
      volunteerId: new mongoose.Types.ObjectId(volunteerId),
      role,
      joinedAt: new Date(),
    });
    await team.save();

    return NextResponse.json({
      message: currentTeam
        ? `Berhasil pindahkan dari tim "${currentTeam.teamName}" ke tim ini`
        : "Anggota berhasil ditambahkan",
      members: team.members,
    });
  } catch (err) {
    console.error("POST /api/admin/volunteers/[id]/members error:", err);
    return NextResponse.json(
      { error: "Gagal menambahkan anggota tim" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/volunteers/[id]/members
 * Body: { volunteerId, role }
 * Update role anggota yang sudah ada di tim ini.
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

    const body = await request.json();
    const volunteerId = String(body.volunteerId ?? "");
    const role = body.role;
    if (!mongoose.Types.ObjectId.isValid(volunteerId)) {
      return NextResponse.json(
        { error: "volunteerId tidak valid" },
        { status: 400 },
      );
    }
    if (!isValidRole(role)) {
      return NextResponse.json(
        { error: `Role harus salah satu dari ${TEAM_MEMBER_ROLES.join(", ")}` },
        { status: 400 },
      );
    }

    await connectDB();
    const result = await Relawan.updateOne(
      { _id: id, "members.volunteerId": volunteerId },
      { $set: { "members.$.role": role } },
    );
    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di tim ini" },
        { status: 404 },
      );
    }
    return NextResponse.json({ message: "Role anggota diupdate" });
  } catch (err) {
    console.error("PATCH /api/admin/volunteers/[id]/members error:", err);
    return NextResponse.json(
      { error: "Gagal update role anggota" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/volunteers/[id]/members?volunteerId=<id>
 * Hapus anggota dari tim. Volunteer registry TIDAK disentuh, history
 * TeamAttendance tetap utuh.
 */
export async function DELETE(request: Request, { params }: Ctx) {
  try {
    const user = await requireAdmin();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
    }
    const { searchParams } = new URL(request.url);
    const volunteerId = searchParams.get("volunteerId") ?? "";
    if (!mongoose.Types.ObjectId.isValid(volunteerId)) {
      return NextResponse.json(
        { error: "volunteerId tidak valid" },
        { status: 400 },
      );
    }

    await connectDB();
    const result = await Relawan.updateOne(
      { _id: id },
      { $pull: { members: { volunteerId } } },
    );
    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: "Anggota tidak ditemukan di tim ini" },
        { status: 404 },
      );
    }
    return NextResponse.json({ message: "Anggota dihapus dari tim" });
  } catch (err) {
    console.error("DELETE /api/admin/volunteers/[id]/members error:", err);
    return NextResponse.json(
      { error: "Gagal menghapus anggota dari tim" },
      { status: 500 },
    );
  }
}
