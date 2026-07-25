import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { Report } from "@/models/Report";

export const GET = withAdmin(async (request) => {
  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const semester = searchParams.get("semester");
  const teamAccountId = searchParams.get("teamAccountId");
  const skip = (page - 1) * limit;

  await connectDB();

  const query: Record<string, unknown> = {};
  if (semester) query.semester = semester;
  if (teamAccountId) query.teamAccountId = teamAccountId;

  try {
    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("teamAccountId", "name email") // Populasikan info relawan
        .sort({ date: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Report.countDocuments(query),
    ]);

    return NextResponse.json({
      total,
      page,
      totalPages: Math.ceil(total / limit),
      reports,
    });
  } catch (error: unknown) {
    console.error("ADMIN REPORTS GET ERROR:", error);
    return NextResponse.json({ error: "Gagal mengambil data laporan" }, { status: 500 });
  }
});
