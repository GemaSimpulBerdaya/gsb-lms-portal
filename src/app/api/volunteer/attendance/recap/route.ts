import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Attendance } from "@/models/Attendance";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const region = searchParams.get("region");
  const semester = searchParams.get("semester");
  const week = searchParams.get("week");

  if (!region || !semester) {
    return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
  }

  await connectDB();

  // Fetch all attendances for this volunteer and semester
  const query: any = {
    relawanId: session.id,
    semester
  };
  if (week) query.week = parseInt(week);

  const attendances = await Attendance.find(query)
    .populate({ path: "anakDidikId", select: "name region category", match: { region: { $regex: new RegExp(`^${region.trim()}$`, "i") } } })
    .lean();

  // Filter out attendances where anakDidik is null (didn't match region)
  const validAttendances = attendances.filter((a: any) => a.anakDidikId !== null);

  // Group by week and date
  const summaryMap = new Map();

  validAttendances.forEach((a: any) => {
    const key = `${a.week}_${a.date}`;
    if (!summaryMap.has(key)) {
      summaryMap.set(key, {
        week: a.week,
        date: a.date,
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
