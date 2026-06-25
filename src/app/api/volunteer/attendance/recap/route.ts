import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { Attendance } from "@/models/Attendance";
import { Schedule } from "@/models/Schedule";
import type { Types } from "mongoose";
import mongoose from "mongoose";

interface PopulatedAttendance {
  _id: Types.ObjectId | string;
  studentId: {
    _id: Types.ObjectId | string;
    name: string;
    region: string;
    fase: string;
  } | null;
  week: number;
  date: Date;
  status: string;
  notes?: string;
  semester: string;
}

export const GET = withVolunteer(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get("scheduleId");
  const week = searchParams.get("week");
  const date = searchParams.get("date");

  if (!scheduleId) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
    return NextResponse.json({ error: "scheduleId tidak valid" }, { status: 400 });
  }

  await connectDB();

  const schedule = await Schedule.findById(scheduleId)
    .select("teamAccountId region fase semester")
    .lean<{ teamAccountId: Types.ObjectId | string; region: string; fase: string; semester: string }>();
  if (!schedule) {
    return NextResponse.json({ error: "Schedule tidak ditemukan" }, { status: 404 });
  }
  if (String(schedule.teamAccountId) !== String(session.id)) {
    return NextResponse.json({ error: "Akun ini bukan pemilik schedule" }, { status: 403 });
  }

  // Fetch all attendances for this volunteer and semester
  const query: Record<string, unknown> = {
    teamAccountId: session.id,
    semester: schedule.semester,
    $or: [
      { scheduleId: new mongoose.Types.ObjectId(scheduleId) },
      { scheduleId: { $exists: false } },
    ],
  };
  if (week) query.week = parseInt(week);
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // Match exact tanggal pertemuan (UTC midnight, format input attendance)
    const target = new Date(`${date}T00:00:00.000Z`);
    if (!isNaN(target.getTime())) {
      query.date = target;
    }
  }

  const attendances = await Attendance.find(query)
    .populate({
      path: "studentId",
      select: "name region fase",
      match: {
        region: { $regex: new RegExp(`^${schedule.region.trim()}$`, "i") },
        fase: { $regex: new RegExp(`^${schedule.fase.trim()}$`, "i") },
      },
    })
    .lean<PopulatedAttendance[]>();

  // Filter out attendances where student is null (didn't match region)
  const validAttendances = attendances.filter((a) => a.studentId !== null);

  // Group by week and date
  const summaryMap = new Map();

  validAttendances.forEach((a) => {
    if (!a.studentId) return;
    const dateKey = a.date instanceof Date ? a.date.toISOString() : String(a.date);
    const key = `${a.week}_${dateKey}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        week: a.week,
        date: dateKey,
        hadir: 0,
        izin: 0,
        sakit: 0,
        alfa: 0,
        asinkronus: 0,
        total: 0,
        details: []
      });
    }

    const stat = summaryMap.get(key);
    stat.total += 1;
    if (a.status === "HADIR") stat.hadir += 1;
    else if (a.status === "IZIN") stat.izin += 1;
    else if (a.status === "SAKIT") stat.sakit += 1;
    else if (a.status === "ALFA") stat.alfa += 1;
    else if (a.status === "ASINKRONUS") stat.asinkronus += 1;

    stat.details.push({
      id: a.studentId._id,
      name: a.studentId.name,
      status: a.status,
      notes: a.notes
    });
  });

  const summary = Array.from(summaryMap.values()).sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return NextResponse.json({ summary });
});
