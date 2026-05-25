import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";
import { getSessionUser } from "@/lib/session";

/**
 * POST /api/dev/migrate-volunteers
 *
 * One-shot migration: untuk setiap akun `Relawan` yang punya `name` (legacy
 * single-person) tapi `members[]` masih kosong, bikin 1 record `Volunteer`
 * di registry + push ke `members[]` dengan role FACILITATOR.
 *
 * SAFE TO RE-RUN. Skip akun yang sudah punya members[] >= 1 atau yang `name`
 * kosong. Match volunteer existing by case-insensitive `name` exact match
 * supaya re-run tidak duplikat.
 *
 * Hanya admin. Endpoint di /api/dev/* sengaja tidak production-ready (admin
 * jalanin manual sekali, lalu file ini bisa dihapus / diabaikan).
 *
 * Response: { migrated, skipped, total }
 */
export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const teams = await Relawan.find({ role: "RELAWAN" });
    let migrated = 0;
    let skipped = 0;
    const log: { team: string; action: string; volunteerId?: string }[] = [];

    for (const team of teams) {
      const teamLabel = team.teamName || team.email;
      // Skip kalau sudah ada members.
      if (team.members && team.members.length > 0) {
        skipped++;
        log.push({ team: teamLabel, action: "skip (members ada)" });
        continue;
      }
      const legacyName = team.name?.trim();
      if (!legacyName) {
        skipped++;
        log.push({ team: teamLabel, action: "skip (name kosong)" });
        continue;
      }

      // Cari volunteer existing by name (case-insensitive).
      let vol = await Volunteer.findOne({
        name: { $regex: `^${escapeRegex(legacyName)}$`, $options: "i" },
      });
      if (!vol) {
        vol = await Volunteer.create({
          name: legacyName,
          isActive: true,
          notes: `Auto-migrated dari Relawan.name (akun: ${team.email})`,
        });
      }

      // Kalau orang ini sudah anggota tim lain, skip — admin perlu handle manual.
      const otherTeam = await Relawan.findOne({
        role: "RELAWAN",
        _id: { $ne: team._id },
        "members.volunteerId": vol._id,
      }).select({ _id: 1, teamName: 1 });
      if (otherTeam) {
        skipped++;
        log.push({
          team: teamLabel,
          action: `skip (${vol.name} sudah di tim "${otherTeam.teamName}")`,
          volunteerId: String(vol._id),
        });
        continue;
      }

      team.members.push({
        volunteerId: vol._id,
        role: "FACILITATOR",
        joinedAt: team.createdAt ?? new Date(),
      });
      await team.save();
      migrated++;
      log.push({
        team: teamLabel,
        action: `migrated → FACILITATOR ${vol.name}`,
        volunteerId: String(vol._id),
      });
    }

    return NextResponse.json({
      message: `Migration selesai. ${migrated} dimigrasi, ${skipped} di-skip.`,
      migrated,
      skipped,
      total: teams.length,
      log,
    });
  } catch (err) {
    console.error("POST /api/dev/migrate-volunteers error:", err);
    return NextResponse.json(
      { error: "Migration gagal", detail: String(err) },
      { status: 500 },
    );
  }
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
