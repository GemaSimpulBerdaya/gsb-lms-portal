import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { TeamAccount } from "@/models/TeamAccount";
import { Report } from "@/models/Report";

export const GET = withVolunteer(async (_request, session) => {
  await connectDB();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [relawan, totalLaporan, totalLaporanBulanIni, laporanTerakhir] = await Promise.all([
    TeamAccount.findById(session.id).select("-password"),
    Report.countDocuments({ teamAccountId: session.id }),
    Report.countDocuments({ teamAccountId: session.id, date: { $gte: startOfMonth } }),
    Report.find({ teamAccountId: session.id })
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
});
