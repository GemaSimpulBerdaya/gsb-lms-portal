import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { TeamAttendance } from "@/models/TeamAttendance";
import { TeamAccount } from "@/models/TeamAccount";
import { Volunteer } from "@/models/Volunteer";
import { Schedule } from "@/models/Schedule";
import { withAdmin } from "@/lib/apiAuth";

function asValidObjectId(value: unknown) {
  const id = String(value ?? "");
  return mongoose.Types.ObjectId.isValid(id)
    ? new mongoose.Types.ObjectId(id)
    : null;
}

/**
 * GET /api/admin/team-attendance
 *   ?semester=...&teamId=<teamAccountId>&volunteerId=...&week=N&from=ISO&to=ISO
 *
 * Reporting kehadiran tim untuk admin. Tiap row di-enrich dengan:
 *   - team:      { id, teamName, region }
 *   - volunteer: { id, name }
 *   - schedule:  { id, region, fase }
 *   - anomaly:   { frequentEdits, unlocked }
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
      filter.teamAccountId = new mongoose.Types.ObjectId(teamId);
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
    const teamIds = [
      ...new Set(
        records
          .map((r) => asValidObjectId(r.teamAccountId))
          .filter((id): id is mongoose.Types.ObjectId => id !== null)
          .map((id) => String(id)),
      ),
    ];
    const volIds = [
      ...new Set(
        records
          .map((r) => asValidObjectId(r.volunteerId))
          .filter((id): id is mongoose.Types.ObjectId => id !== null)
          .map((id) => String(id)),
      ),
    ];
    const scheduleIds = [
      ...new Set(
        records
          .map((r) => asValidObjectId(r.scheduleId))
          .filter((id): id is mongoose.Types.ObjectId => id !== null)
          .map((id) => String(id)),
      ),
    ];

    const [teams, vols, schedules] = await Promise.all([
      TeamAccount.find({ _id: { $in: teamIds } })
        .select({ _id: 1, teamName: 1, region: 1 })
        .lean(),
      Volunteer.find({ _id: { $in: volIds } })
        .select({ _id: 1, name: 1, isActive: 1 })
        .lean(),
      Schedule.find({ _id: { $in: scheduleIds } })
        .select({ _id: 1, region: 1, fase: 1 })
        .lean(),
    ]);
    const teamMap = new Map(teams.map((t) => [String(t._id), t]));
    const volMap = new Map(vols.map((v) => [String(v._id), v]));
    const scheduleMap = new Map(schedules.map((schedule) => [String(schedule._id), schedule]));

    const enriched = records.map((r) => {
      const team = teamMap.get(String(r.teamAccountId)) as
        | { teamName?: string; region?: string }
        | undefined;
      const vol = volMap.get(String(r.volunteerId)) as
        | { name?: string; isActive?: boolean }
        | undefined;
      const schedule = scheduleMap.get(String(r.scheduleId)) as
        | { region?: string; fase?: string }
        | undefined;

      const editHistory =
        (r as { editHistory?: unknown[] }).editHistory ?? [];
      const frequentEdits = editHistory.length >= 3;
      const unlocked = !!(r as { unlockedByAdmin?: boolean }).unlockedByAdmin;

      return {
        ...r,
        team: {
          id: String(r.teamAccountId),
          teamName: team?.teamName,
          region: team?.region,
        },
        volunteer: {
          id: String(r.volunteerId),
          name: vol?.name,
          isActive: vol?.isActive,
        },
        schedule: {
          id: String(r.scheduleId),
          region: schedule?.region,
          fase: schedule?.fase,
        },
        anomaly: { frequentEdits, unlocked },
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
