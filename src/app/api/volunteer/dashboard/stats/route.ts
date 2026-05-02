import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Schedule } from "@/models/Schedule";
import AnakDidik from "@/models/AnakDidik";
import { Report } from "@/models/Report";
import { Types } from "mongoose";

export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const semester = searchParams.get("semester");

  try {
    await connectDB();

    const relawanObjectId = new Types.ObjectId(session.id);
    const baseFilter: any = { relawanId: relawanObjectId };
    if (semester) baseFilter.semester = semester;

    const [totalSchedules, totalReports, schedules] = await Promise.all([
      Schedule.countDocuments(baseFilter),
      Report.countDocuments(baseFilter),
      Schedule.find(baseFilter).lean(),
    ]);

    // Count students across all unique regions and levels taught by this volunteer
    const taughtCombinations = (schedules as any[]).map(s => ({
      region: s.region,
      level: s.level
    }));

    // Remove duplicates
    const uniqueCombinations = taughtCombinations.filter((v, i, a) => 
      a.findIndex(t => t.region === v.region && t.level === v.level) === i
    );

    // Get students data
    let students: any[] = [];
    let totalStudents = 0;
    if (uniqueCombinations.length > 0) {
      const orQuery = uniqueCombinations.map(c => ({
        region: { $regex: c.region.trim(), $options: "i" },
        category: c.level.toUpperCase()
      }));
      
      students = await AnakDidik.find({ $or: orQuery })
        .select("name region category")
        .sort({ name: 1 })
        .lean();
      
      totalStudents = students.length;
    }

    return NextResponse.json({
      stats: {
        totalSchedules,
        totalReports,
        totalStudents,
      },
      students,
      recentSchedules: (schedules as any[]).slice(0, 5), // last 5 schedules
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });

  } catch (error: any) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
