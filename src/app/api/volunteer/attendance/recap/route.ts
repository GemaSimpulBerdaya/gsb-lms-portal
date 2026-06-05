import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { canAccessVolunteerPortal } from "@/lib/roles";
import { Attendance } from "@/models/Attendance";
import type { Types } from "mongoose";

interface PopulatedAttendance {
  _id: Types.ObjectId | string;
  anakDidikId: {
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

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || !canAccessVolunteerPortal(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region");
  const semester = searchParams.get("semester");
  const week = searchParams.get("week");
  const date = searchParams.get("date");

  if (!region || !semester) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  await connectDB();

  // Fetch all attendances for this volunteer and semester
  const query: Record<string, unknown> = {
    relawanId: session.id,
    semester
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
    .populate({ path: "anakDidikId", select: "name region fase", match: { region: { $regex: new RegExp(`^${region.trim()}$`, "i") } } })
    .lean<PopulatedAttendance[]>();

  // Filter out attendances where anakDidik is null (didn't match region)
  const validAttendances = attendances.filter((a) => a.anakDidikId !== null);

  // Group by week and date
  const summaryMap = new Map();

  validAttendances.forEach((a) => {
    if (!a.anakDidikId) return;
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

    stat.details.push({
      id: a.anakDidikId._id,
      name: a.anakDidikId.name,
      status: a.status,
      notes: a.notes
    });
  });

  const summary = Array.from(summaryMap.values()).sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    return new Date(a.date).getTime() - new Date(b.date).getTime();
  });

  return NextResponse.json({ summary });
}
