import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Report } from "@/models/Report";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const semester = searchParams.get("semester");
  const relawanId = searchParams.get("relawanId");
  const skip = (page - 1) * limit;

  await connectDB();

  const query: any = {};
  if (semester) query.semester = semester;
  if (relawanId) query.relawanId = relawanId;

  try {
    const [reports, total] = await Promise.all([
      Report.find(query)
        .populate("relawanId", "name email") // Populasikan info relawan
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
  } catch (error: any) {
    console.error("ADMIN REPORTS GET ERROR:", error);
    return NextResponse.json({ error: "Gagal mengambil data laporan" }, { status: 500 });
  }
}
