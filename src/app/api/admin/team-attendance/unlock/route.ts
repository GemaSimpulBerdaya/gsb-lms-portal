import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { TeamAttendance } from "@/models/TeamAttendance";
import { Schedule } from "@/models/Schedule";
import { getSessionUser } from "@/lib/session";

/**
 * POST /api/admin/team-attendance/unlock
 * Body: { teamId, scheduleId, week }
 *
 * Buka kunci pertemuan agar facilitator bisa edit attendance walau time window
 * sudah lewat. Mekanisme:
 *   - Kalau record TeamAttendance untuk pertemuan itu sudah ada → set
 *     `unlockedByAdmin=true` di semua record itu.
 *   - Kalau belum ada → buat 1 placeholder record per anggota tim ini dengan
 *     status default "ALFA" + unlockedByAdmin=true. Facilitator tinggal edit.
 *
 * Setelah unlock, facilitator boleh POST /api/volunteer/team-attendance lagi
 * walau di luar window (logic bypassWindow di endpoint volunteer).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const teamId = String(body.teamId ?? "");
    const scheduleId = String(body.scheduleId ?? "");
    const week = Number(body.week);

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return NextResponse.json({ error: "teamId tidak valid" }, { status: 400 });
    }
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return NextResponse.json(
        { error: "scheduleId tidak valid" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(week) || week < 1) {
      return NextResponse.json(
        { error: "week harus angka >= 1" },
        { status: 400 },
      );
    }

    await connectDB();

    const schedule = await Schedule.findById(scheduleId).lean();
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule tidak ditemukan" },
        { status: 404 },
      );
    }
    if (String((schedule as { relawanId: unknown }).relawanId) !== teamId) {
      return NextResponse.json(
        { error: "Schedule bukan milik tim ini" },
        { status: 400 },
      );
    }
    const kbm = (schedule as { kbmDates?: { week: number; date: Date }[] }).kbmDates?.find(
      (k) => k.week === week,
    );
    if (!kbm) {
      return NextResponse.json(
        { error: `Pekan ${week} tidak ada di schedule` },
        { status: 404 },
      );
    }

    const result = await TeamAttendance.updateMany(
      {
        relawanId: teamId,
        scheduleId,
        week,
        date: kbm.date,
      },
      { $set: { unlockedByAdmin: true } },
    );

    return NextResponse.json({
      message: `Pertemuan pekan ${week} di-unlock. ${result.modifiedCount} record terdampak. Facilitator sekarang boleh edit walau di luar window.`,
      modifiedCount: result.modifiedCount,
    });
  } catch (err) {
    console.error("POST /api/admin/team-attendance/unlock error:", err);
    return NextResponse.json(
      { error: "Gagal unlock pertemuan" },
      { status: 500 },
    );
  }
}
