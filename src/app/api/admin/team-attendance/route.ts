import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { TeamAttendance } from "@/models/TeamAttendance";
import { Relawan } from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";
import { withAdmin } from "@/lib/apiAuth";
import { TEAM_ATTENDANCE_WINDOW } from "@/lib/teamAttendance";

/**
 * GET /api/admin/team-attendance
 *   ?semester=...&teamId=<relawanId>&volunteerId=...&week=N&from=ISO&to=ISO
 *
 * Reporting kehadiran tim untuk admin. Tiap row di-enrich dengan:
 *   - team:      { id, teamName, region }
 *   - volunteer: { id, name }
 *   - anomaly:   { lateInput, frequentEdits, unlocked }
 *
 * Filter optional. Default: semester aktif (kalau ada) atau no filter.
 */
export const GET = withAdmin(async (request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const filter: Record<string, unknown> = {};
    const semester = searchParams.get("semester");
    if (semester) filter.semester = semester;
    const teamId = searchParams.get("teamId");
    if (teamId && mongoose.Types.ObjectId.isValid(teamId)) {
      filter.relawanId = new mongoose.Types.ObjectId(teamId);
    }
    const volunteerId = searchParams.get("volunteerId");
    if (volunteerId && mongoose.Types.ObjectId.isValid(volunteerId)) {
      filter.volunteerId = new mongoose.Types.ObjectId(volunteerId);
    }
    const week = searchParams.get("week");
    if (week) {
      const w = Number(week);
      if (Number.isFinite(w)) filter.week = w;
    }
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (from || to) {
      filter.date = {
        ...(from && { $gte: new Date(from) }),
        ...(to && { $lte: new Date(to) }),
      };
    }

    const records = await TeamAttendance.find(filter)
      .sort({ date: -1, week: -1 })
      .limit(2000)
      .lean();

    // Batch fetch enrichment data.
    const teamIds = [...new Set(records.map((r) => String(r.relawanId)))];
    const volIds = [...new Set(records.map((r) => String(r.volunteerId)))];

    const [teams, vols] = await Promise.all([
      Relawan.find({ _id: { $in: teamIds } })
        .select({ _id: 1, teamName: 1, region: 1 })
        .lean(),
      Volunteer.find({ _id: { $in: volIds } })
        .select({ _id: 1, name: 1, isActive: 1 })
        .lean(),
    ]);
    const teamMap = new Map(teams.map((t) => [String(t._id), t]));
    const volMap = new Map(vols.map((v) => [String(v._id), v]));

    const lateThresholdMs =
      TEAM_ATTENDANCE_WINDOW.latestHoursAfter * 3_600_000;

    const enriched = records.map((r) => {
      const team = teamMap.get(String(r.relawanId)) as
        | { teamName?: string; region?: string }
        | undefined;
      const vol = volMap.get(String(r.volunteerId)) as
        | { name?: string; isActive?: boolean }
        | undefined;

      const lateMs =
        new Date(r.markedAt).getTime() - new Date(r.date).getTime();
      const lateInput = lateMs > lateThresholdMs;
      const editHistory =
        (r as { editHistory?: unknown[] }).editHistory ?? [];
      const frequentEdits = editHistory.length >= 3;
      const unlocked = !!(r as { unlockedByAdmin?: boolean }).unlockedByAdmin;

      return {
        ...r,
        team: {
          id: String(r.relawanId),
          teamName: team?.teamName,
          region: team?.region,
        },
        volunteer: {
          id: String(r.volunteerId),
          name: vol?.name,
          isActive: vol?.isActive,
        },
        anomaly: { lateInput, frequentEdits, unlocked },
      };
    });

    return NextResponse.json({ records: enriched, total: enriched.length });
  } catch (err) {
    console.error("GET /api/admin/team-attendance error:", err);
    return NextResponse.json(
      { error: "Gagal memuat data kehadiran tim" },
      { status: 500 },
    );
  }
});

/**
 * PATCH /api/admin/team-attendance
 * Body: { recordId, status?, notes? } — admin override edit langsung.
 *
 * Push editHistory dengan `by = admin id`. Field `unlockedByAdmin` di-set true
 * supaya dashboard menampilkan badge "Diedit admin".
 */
export const PATCH = withAdmin(async (request, user) => {
  try {
    const body = await request.json();
    const recordId = String(body.recordId ?? "");
    if (!mongoose.Types.ObjectId.isValid(recordId)) {
      return NextResponse.json(
        { error: "recordId tidak valid" },
        { status: 400 },
      );
    }

    await connectDB();
    const rec = await TeamAttendance.findById(recordId);
    if (!rec) {
      return NextResponse.json(
        { error: "Record tidak ditemukan" },
        { status: 404 },
      );
    }

    const newStatus = body.status ?? rec.status;
    const newNotes = typeof body.notes === "string" ? body.notes : rec.notes;
    const changed = newStatus !== rec.status || newNotes !== rec.notes;
    if (!changed) {
      return NextResponse.json({ message: "Tidak ada perubahan", record: rec });
    }

    rec.editHistory.push({
      at: new Date(),
      by: new mongoose.Types.ObjectId(user.id),
      prevStatus: rec.status,
      newStatus,
      prevNotes: rec.notes,
      newNotes,
    });
    rec.status = newStatus;
    rec.notes = newNotes;
    rec.unlockedByAdmin = true;
    await rec.save();

    return NextResponse.json({ message: "Record di-update admin", record: rec });
  } catch (err) {
    console.error("PATCH /api/admin/team-attendance error:", err);
    return NextResponse.json(
      { error: "Gagal update record kehadiran" },
      { status: 500 },
    );
  }
});
