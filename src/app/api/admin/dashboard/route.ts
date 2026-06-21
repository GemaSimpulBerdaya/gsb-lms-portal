import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { TeamAccount } from "@/models/TeamAccount";
import Student from "@/models/Student";
import { Module } from "@/models/Module";
import { Report } from "@/models/Report";

/**
 * GET /api/admin/dashboard
 * Mengambil statistik ringkas untuk Dashboard Admin Pusat
 */
export const GET = withAdmin(async () => {
  try {
    await connectDB();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Jalankan semua query secara paralel untuk kecepatan
      const [totalRelawan, totalStudent, totalModul, totalPpts, reportsToday] = await Promise.all([
        TeamAccount.countDocuments({ role: "RELAWAN" }),
        Student.countDocuments({}),
        Module.countDocuments({ type: "DOCUMENT" }),
        Module.countDocuments({ type: "PPT" }),
        Report.countDocuments({ createdAt: { $gte: today } })
      ]);

      const recentReports = await Report.find({}).sort({ createdAt: -1 }).limit(5).populate("teamAccountId", "email teamName");

    return NextResponse.json({
      stats: {
        totalVolunteers: totalRelawan,
        totalStudents: totalStudent,
        totalModules: totalModul,
        totalPpts: totalPpts,
        totalSchedules: reportsToday
      },
      recentReports
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
