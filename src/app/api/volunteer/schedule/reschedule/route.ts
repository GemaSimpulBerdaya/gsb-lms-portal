import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { canAccessVolunteerPortal } from "@/lib/roles";
import { Schedule } from "@/models/Schedule";
import { computeActiveWeek } from "@/lib/schedule";

/**
 * PATCH /api/volunteer/schedule/reschedule
 *
 * Geser tanggal satu pertemuan (KBM week). Hanya update record itu —
 * pertemuan setelahnya tidak ikut bergeser. Dipakai untuk handle
 * pertemuan yang dipindah karena relawan sakit / libur dadakan.
 *
 * Body:
 *   {
 *     scheduleId: string,
 *     week: number,
 *     newDate: string (ISO yyyy-mm-dd),
 *     reason?: string
 *   }
 *
 * Audit:
 *   - originalDate diset kalau belum pernah ada (preserve tanggal
 *     awal pertama kali generate, biar bisa di-trace)
 *   - rescheduleReason & rescheduledAt selalu ditimpa
 */
export async function PATCH(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session || !canAccessVolunteerPortal(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scheduleId, week, newDate, reason } = body;

    if (!scheduleId || typeof week !== "number" || !newDate) {
      return NextResponse.json(
        { error: "scheduleId, week, dan newDate wajib diisi" },
        { status: 400 }
      );
    }

    const parsed = new Date(newDate);
    if (isNaN(parsed.getTime())) {
      return NextResponse.json(
        { error: "Format tanggal tidak valid" },
        { status: 400 }
      );
    }
    parsed.setHours(0, 0, 0, 0);

    await connectDB();

    const schedule = await Schedule.findOne({
      _id: scheduleId,
      relawanId: session.id,
    });

    if (!schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    const target = schedule.kbmDates.find((k) => k.week === week);
    if (!target) {
      return NextResponse.json(
        { error: `Pertemuan pekan ${week} tidak ditemukan` },
        { status: 404 }
      );
    }

    // Preserve originalDate kalau belum ada (first reschedule)
    if (!target.originalDate) {
      target.originalDate = target.date;
    }
    target.date = parsed;
    target.rescheduleReason =
      typeof reason === "string" ? reason.trim() : "";
    target.rescheduledAt = new Date();

    // Re-sort kbmDates by date supaya order tetap kronologis,
    // re-assign week 1..N kalau urutan berubah karena geser.
    schedule.kbmDates.sort(
      (a, b) =>
        new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    schedule.kbmDates.forEach((k, i) => {
      k.week = i + 1;
    });

    schedule.activeWeek = computeActiveWeek(schedule.kbmDates);
    await schedule.save();

    return NextResponse.json({ schedule: schedule.toObject() });
  } catch (err) {
    console.error("PATCH /schedule/reschedule error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
