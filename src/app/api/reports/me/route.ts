import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Types } from "mongoose";
import { Report } from "@/models/Report";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const semester = searchParams.get("semester");
  const scheduleId = searchParams.get("scheduleId");
  const region = searchParams.get("region");
  const fase = searchParams.get("fase");
  const month = searchParams.get("month");
  const keyword = searchParams.get("q")?.trim();
  const skip = (page - 1) * limit;

  await connectDB();

  const relawanObjectId = new Types.ObjectId(session.id);
  const query: Record<string, unknown> = { teamAccountId: relawanObjectId };

  if (semester) {
    query.semester = semester;
  }

  if (semester && month && /^(0[1-9]|1[0-2])$/.test(month)) {
    const [year] = semester.split("-");
    const monthIndex = Number(month) - 1;
    query.date = {
      $gte: new Date(Number(year), monthIndex, 1),
      $lt: new Date(Number(year), monthIndex + 1, 1),
    };
  }

  if (scheduleId && Types.ObjectId.isValid(scheduleId)) {
    const scheduleObjectId = new Types.ObjectId(scheduleId);
    const scheduleFallback = region && fase
      ? [
          { region, fase },
          { location: `${region} - ${fase}` },
        ]
      : [];

    query.$or = [
      { scheduleId: scheduleObjectId },
      ...scheduleFallback,
    ];
  }

  if (keyword) {
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$and = [
      ...((query.$and as Record<string, unknown>[] | undefined) ?? []),
      {
        $or: [
          { title: { $regex: escapedKeyword, $options: "i" } },
          { description: { $regex: escapedKeyword, $options: "i" } },
          { location: { $regex: escapedKeyword, $options: "i" } },
        ],
      },
    ];
  }

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select("title description date photoUrl photoUrls location region fase scheduleId semester createdAt")
      .lean(),

    Report.countDocuments(query),
  ]);

  return NextResponse.json({
    total,
    page,
    totalPages: Math.ceil(total / limit),
    reports: reports.map((r) => ({ ...r, level: r.fase })),
  });
}
