import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import AnakDidik from "@/models/AnakDidik";
import { Attendance } from "@/models/Attendance";
import type { AnyBulkWriteOperation, Types } from "mongoose";

interface AttendanceUpdate {
  anakDidikId: string;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS";
  notes?: string;
}

interface IAnakDidikLean {
  _id: Types.ObjectId | string;
  name: string;
  region: string;
  category: string;
  parentName?: string;
}

interface IAttendanceLean {
  _id: Types.ObjectId | string;
  relawanId: Types.ObjectId | string;
  anakDidikId: Types.ObjectId | string;
  week: number;
  semester: string;
  date: Date;
  status: string;
  notes?: string;
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

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region");
  const level = searchParams.get("level");
  const week = searchParams.get("week");
  const semester = searchParams.get("semester");
  const date = searchParams.get("date");

  if (!region || !level || !week || !semester || !date) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  const parsedDate = parseDateParam(date);
  if (!parsedDate) {
    return NextResponse.json({ error: "Format date harus YYYY-MM-DD" }, { status: 400 });
  }

  await connectDB();

  // Get all students for this region and level
  const students = await AnakDidik.find({
    region: { $regex: new RegExp(`^${region.trim()}$`, "i") },
    category: level.toUpperCase()
  }).select("name region category parentName").sort({ name: 1 }).lean<IAnakDidikLean[]>();

  // Get attendance records for this week
  const attendances = await Attendance.find({
    relawanId: session.id,
    week: parseInt(week, 10),
    semester,
    date: parsedDate
  }).lean<IAttendanceLean[]>();

  // Map attendance to students
  const attendanceMap = new Map<string, IAttendanceLean>();
  attendances.forEach((a) => {
    attendanceMap.set(a.anakDidikId.toString(), a);
  });

  const studentsWithAttendance = students.map((s) => ({
    ...s,
    attendance: attendanceMap.get(s._id.toString()) || null
  }));

  return NextResponse.json({ data: studentsWithAttendance });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { week, semester, date, attendances } = await request.json();

  if (!week || !semester || !date || !attendances || !Array.isArray(attendances)) {
    return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
  }

  const parsedDate = parseDateParam(date);
  if (!parsedDate) {
    return NextResponse.json({ error: "Format date harus YYYY-MM-DD" }, { status: 400 });
  }

  await connectDB();

  const bulkOps: AnyBulkWriteOperation[] = attendances.map((a: AttendanceUpdate) => ({
    updateOne: {
      filter: {
        relawanId: session.id,
        anakDidikId: a.anakDidikId,
        week: parseInt(week, 10),
        semester,
        date: parsedDate
      },
      update: {
        $set: {
          status: a.status,
          notes: a.notes || ""
        }
      },
      upsert: true
    }
  }));

  if (bulkOps.length > 0) {
    await Attendance.bulkWrite(bulkOps);
  }

  return NextResponse.json({ message: "Absensi berhasil disimpan" });
}
