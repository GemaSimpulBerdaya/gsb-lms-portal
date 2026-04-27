import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Report } from "@/models/Report";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  await connectDB();

  const [reports, total] = await Promise.all([
    Report.find({ relawanId: session.id })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select("title description date photoUrl location createdAt"),
    Report.countDocuments({ relawanId: session.id }),
  ]);

  return NextResponse.json({
    total,
    page,
    totalPages: Math.ceil(total / limit),
    reports,
  });
}
