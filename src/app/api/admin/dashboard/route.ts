import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Relawan } from "@/models/Relawan";
import AnakDidik from "@/models/AnakDidik";
import { Module } from "@/models/Core";
import { Report } from "@/models/Report";

/**
 * GET /api/admin/dashboard
 * Mengambil statistik ringkas untuk Dashboard Admin Pusat
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    await connectDB();

    // Jalankan semua query secara paralel untuk kecepatan
    const [totalRelawan, totalAnakDidik, totalModul, recentReports] = await Promise.all([
      Relawan.countDocuments({ role: "RELAWAN" }),
      AnakDidik.countDocuments({}),
      Module.countDocuments({}),
      Report.find({}).sort({ createdAt: -1 }).limit(5).populate("relawanId", "email teamName")
    ]);

    // Hitung laporan hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const reportsToday = await Report.countDocuments({ createdAt: { $gte: today } });

    return NextResponse.json({
      stats: {
        totalRelawan,
        totalAnakDidik,
        totalModul,
        reportsToday
      },
      recentReports
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
