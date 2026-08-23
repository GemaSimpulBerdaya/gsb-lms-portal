import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import Student from "@/models/Student";
import { Attendance } from "@/models/Attendance";
import { Schedule } from "@/models/Schedule";
import type { AnyBulkWriteOperation, Types } from "mongoose";
import mongoose from "mongoose";
import { escapeRegex } from "@/lib/regex";

interface AttendanceUpdate {
  studentId: string;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS";
  notes?: string;
}

interface IStudentLean {
  _id: Types.ObjectId | string;
  name: string;
  region: string;
  fase: string;
  parentName?: string;
}

interface IAttendanceLean {
  _id: Types.ObjectId | string;
  teamAccountId: Types.ObjectId | string;
  studentId: Types.ObjectId | string;
  week: number;
  semester: string;
  date: Date;
  status: string;
  notes?: string;
}

interface IKbmDateLean {
  week: number;
  date: Date;
}

interface IScheduleLean {
  _id: Types.ObjectId | string;
  teamAccountId: Types.ObjectId | string;
  region: string;
  fase: string;
  semester: string;
  kbmDates?: IKbmDateLean[];
}

/**
 * Parse `YYYY-MM-DD` string dari query/body jadi Date di UTC midnight.
 * Format selain itu kembalikan null supaya caller bisa balas 400.
 */
function parseDateParam(raw: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00.000Z`);
  return isNaN(d.getTime()) ? null : d;
}

function dateKey(d: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(d));
}

function findKbmDate(
  schedule: IScheduleLean,
  week: number,
  date: string
): IKbmDateLean | null {
  return (
    schedule.kbmDates?.find(
      (k) => k.week === week && dateKey(k.date) === date
    ) ?? null
  );
}

export const GET = withVolunteer(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const scheduleId = searchParams.get("scheduleId");
  const week = searchParams.get("week");
  const date = searchParams.get("date");

  if (!scheduleId || !week || !date) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
    return NextResponse.json({ error: "scheduleId tidak valid" }, { status: 400 });
  }

  const parsedDate = parseDateParam(date);
  if (!parsedDate) {
    return NextResponse.json({ error: "Format date harus YYYY-MM-DD" }, { status: 400 });
  }

  await connectDB();

  const schedule = await Schedule.findById(scheduleId)
    .select("teamAccountId region fase semester kbmDates")
    .lean<IScheduleLean>();
  if (!schedule) {
    return NextResponse.json({ error: "Schedule tidak ditemukan" }, { status: 404 });
  }
  if (String(schedule.teamAccountId) !== String(session.id)) {
    return NextResponse.json({ error: "Akun ini bukan pemilik schedule" }, { status: 403 });
  }

  const parsedWeek = parseInt(week, 10);
  const kbm = findKbmDate(schedule, parsedWeek, date);
  if (!kbm) {
    return NextResponse.json(
      { error: "Pertemuan tidak ditemukan di jadwal ini" },
      { status: 404 }
    );
  }

  // Get all students for this region and fase
  const students = await Student.find({
    region: { $regex: new RegExp(`^${escapeRegex(schedule.region.trim())}$`, "i") },
    fase: { $regex: new RegExp(`^${escapeRegex(schedule.fase.trim())}$`, "i") },
  })
    .select("name region fase parentName")
    .sort({ name: 1 })
    .lean<IStudentLean[]>();

  // Get attendance records for this week
  const attendances = await Attendance.find({
    teamAccountId: session.id,
    week: parsedWeek,
    semester: schedule.semester,
    date: parsedDate,
    $or: [
      { scheduleId },
      { scheduleId: { $exists: false } },
    ],
  }).lean<IAttendanceLean[]>();

  // Map attendance to students
  const attendanceMap = new Map<string, IAttendanceLean>();
  attendances.forEach((a) => {
    attendanceMap.set(a.studentId.toString(), a);
  });

  const studentsWithAttendance = students.map((s) => ({
    ...s,
    attendance: attendanceMap.get(s._id.toString()) || null,
  }));

  return NextResponse.json({ data: studentsWithAttendance });
});

export const POST = withVolunteer(async (request, session) => {
  const { scheduleId, week, date, attendances } = await request.json();

  if (!scheduleId || !week || !date || !attendances || !Array.isArray(attendances)) {
    return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
  }
  if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
    return NextResponse.json({ error: "scheduleId tidak valid" }, { status: 400 });
  }

  const parsedDate = parseDateParam(date);
  if (!parsedDate) {
    return NextResponse.json({ error: "Format date harus YYYY-MM-DD" }, { status: 400 });
  }

  await connectDB();

  const schedule = await Schedule.findById(scheduleId)
    .select("teamAccountId region fase semester kbmDates")
    .lean<IScheduleLean>();
  if (!schedule) {
    return NextResponse.json({ error: "Schedule tidak ditemukan" }, { status: 404 });
  }
  if (String(schedule.teamAccountId) !== String(session.id)) {
    return NextResponse.json({ error: "Akun ini bukan pemilik schedule" }, { status: 403 });
  }

  const parsedWeek = parseInt(String(week), 10);
  const kbm = findKbmDate(schedule, parsedWeek, date);
  if (!kbm) {
    return NextResponse.json(
      { error: "Pertemuan tidak ditemukan di jadwal ini" },
      { status: 404 }
    );
  }

  const allowedStudents = await Student.find({
    region: { $regex: new RegExp(`^${escapeRegex(schedule.region.trim())}$`, "i") },
    fase: { $regex: new RegExp(`^${escapeRegex(schedule.fase.trim())}$`, "i") },
  })
    .select("_id")
    .lean<{ _id: Types.ObjectId | string }[]>();
  const allowedStudentIds = new Set(allowedStudents.map((s) => String(s._id)));
  for (const a of attendances as AttendanceUpdate[]) {
    if (!allowedStudentIds.has(String(a.studentId))) {
      return NextResponse.json(
        { error: `Siswa ${a.studentId} bukan bagian dari jadwal ini` },
        { status: 400 }
      );
    }
  }

  const bulkOps: AnyBulkWriteOperation[] = attendances.map((a: AttendanceUpdate) => ({
    updateOne: {
      filter: {
        teamAccountId: session.id,
        studentId: a.studentId,
        week: parsedWeek,
        semester: schedule.semester,
        date: parsedDate,
        $or: [
          { scheduleId: new mongoose.Types.ObjectId(scheduleId) },
          { scheduleId: { $exists: false } },
        ],
      },
      update: {
        $set: {
          scheduleId: new mongoose.Types.ObjectId(scheduleId),
          status: a.status,
          notes: a.notes || "",
        },
      },
      upsert: true,
    },
  }));

  if (bulkOps.length > 0) {
    await Attendance.bulkWrite(bulkOps);
  }

  return NextResponse.json({ message: "Presensi berhasil disimpan" });
});
