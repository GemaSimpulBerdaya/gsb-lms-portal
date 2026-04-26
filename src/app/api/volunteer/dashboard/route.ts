import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Relawan } from "@/models/Relawan";
import { Report } from "@/models/Report";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [relawan, totalLaporan, totalLaporanBulanIni, laporanTerakhir] = await Promise.all([
    Relawan.findById(session.id).select("-password"),
    Report.countDocuments({ relawanId: session.id }),
    Report.countDocuments({ relawanId: session.id, date: { $gte: startOfMonth } }),
    Report.find({ relawanId: session.id })
      .sort({ date: -1 })
      .limit(3)
      .select("title date location"),
  ]);

  if (!relawan) {
    return NextResponse.json({ error: "Relawan tidak ditemukan" }, { status: 404 });
  }

  return NextResponse.json({
    user: {
      id: relawan._id,
      email: relawan.email,
      teamName: relawan.teamName,
      region: relawan.region,
      role: relawan.role,
    },
    stats: {
      totalLaporan,
      totalLaporanBulanIni,
    },
    laporanTerakhir,
  });
}
