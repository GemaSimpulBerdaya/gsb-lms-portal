import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { AnakDidik } from "@/models/Relawan";
import { Attendance } from "@/models/Attendance";

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

  if (!region || !level || !week || !semester) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  await connectDB();

  // Get all students for this region and level
  const students = await AnakDidik.find({
    region: { $regex: new RegExp(`^${region.trim()}$`, "i") },
    category: level.toUpperCase()
  }).select("name region category parentName").sort({ name: 1 }).lean();

  // Get attendance records for this week
  const attendances = await Attendance.find({
    relawanId: session.id,
    week: parseInt(week, 10),
    semester
  }).lean();

  // Map attendance to students
  const attendanceMap = new Map();
  attendances.forEach((a: any) => {
    attendanceMap.set(a.anakDidikId.toString(), a);
  });

  const studentsWithAttendance = students.map((s: any) => ({
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

  const { week, semester, attendances } = await request.json();

  if (!week || !semester || !attendances || !Array.isArray(attendances)) {
    return NextResponse.json({ error: "Invalid data format" }, { status: 400 });
  }

  await connectDB();

  const bulkOps = attendances.map((a: any) => ({
    updateOne: {
      filter: {
        relawanId: session.id,
        anakDidikId: a.anakDidikId,
        week: parseInt(week, 10),
        semester
      },
      update: {
        $set: {
          status: a.status,
          notes: a.notes || "",
          date: new Date()
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
