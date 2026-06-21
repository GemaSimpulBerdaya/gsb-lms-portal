import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { Report } from "@/models/Report";

export const GET = withAdmin(async () => {
  await connectDB();

  try {
    const reports = await Report.find({})
      .populate("teamAccountId", "name teamName")
      .sort({ date: -1 })
      .limit(5)
      .lean();

    return NextResponse.json({ reports });
  } catch (error: unknown) {
    console.error("ADMIN DASHBOARD REPORTS GET ERROR:", error);
    return NextResponse.json({ error: "Gagal mengambil laporan terbaru" }, { status: 500 });
  }
});
