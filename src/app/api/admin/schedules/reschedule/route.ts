import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { Schedule } from "@/models/Schedule";
import { computeActiveWeek } from "@/lib/schedule";
import {
  findSavedVolunteerWeekConflict,
  volunteerWeekConflictMessage,
} from "@/lib/scheduleAssignments";

export const PATCH = withAdmin(async (request) => {
  try {
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

    const schedule = await Schedule.findById(scheduleId);
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

    if (!target.originalDate) {
      target.originalDate = target.date;
    }
    target.date = parsed;
    target.rescheduleReason =
      typeof reason === "string" ? reason.trim() : "";
    target.rescheduledAt = new Date();

    schedule.kbmDates.sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    schedule.kbmDates.forEach((k, i) => {
      k.week = i + 1;
    });

    const assignmentConflict = await findSavedVolunteerWeekConflict({
      semester: schedule.semester,
      meetings: schedule.kbmDates,
      excludeScheduleId: String(schedule._id),
    });
    if (assignmentConflict) {
      return NextResponse.json(
        { error: volunteerWeekConflictMessage(assignmentConflict) },
        { status: 409 }
      );
    }

    schedule.activeWeek = computeActiveWeek(schedule.kbmDates);
    await schedule.save();

    return NextResponse.json({ schedule: schedule.toObject() });
  } catch (err) {
    console.error("PATCH /api/admin/schedules/reschedule error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
});
