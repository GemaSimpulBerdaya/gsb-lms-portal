import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import StudentPortfolio from "@/models/StudentPortfolio";
import "@/models/Student";
import "@/models/Schedule";
import "@/models/TeamAccount";

export const GET = withAdmin(async (request) => {
  try {
    await connectDB();
    const { searchParams } = request.nextUrl;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 15));
    const semester = searchParams.get("semester")?.trim();
    const scheduleId = searchParams.get("scheduleId")?.trim();
    const studentId = searchParams.get("studentId")?.trim();
    const search = searchParams.get("search")?.trim();

    const filter: Record<string, unknown> = {};
    if (semester) filter.semester = semester;
    if (scheduleId && Types.ObjectId.isValid(scheduleId)) filter.scheduleId = scheduleId;
    if (studentId && Types.ObjectId.isValid(studentId)) filter.studentId = studentId;
    if (search) filter.title = { $regex: search, $options: "i" };

    const optionFilter = semester ? { semester } : {};
    const [items, total, optionItems] = await Promise.all([
      StudentPortfolio.find(filter)
        .populate("studentId", "name region fase studentCode")
        .populate("scheduleId", "region fase semester")
        .populate("teamAccountId", "teamName name email region")
        .sort({ date: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      StudentPortfolio.countDocuments(filter),
      StudentPortfolio.find(optionFilter)
        .select("studentId scheduleId")
        .populate("studentId", "name region fase studentCode")
        .populate("scheduleId", "region fase semester")
        .lean(),
    ]);

    const schedules = new Map<string, { _id: string; region: string; fase: string }>();
    const students = new Map<string, { _id: string; name: string; region: string; fase: string }>();
    for (const item of optionItems) {
      const schedule = item.scheduleId as unknown as { _id?: unknown; region?: string; fase?: string } | null;
      const student = item.studentId as unknown as { _id?: unknown; name?: string; region?: string; fase?: string } | null;
      if (schedule?._id) {
        const id = String(schedule._id);
        schedules.set(id, { _id: id, region: schedule.region || "-", fase: schedule.fase || "-" });
      }
      if (student?._id) {
        const id = String(student._id);
        students.set(id, { _id: id, name: student.name || "Siswa Terhapus", region: student.region || "-", fase: student.fase || "-" });
      }
    }

    return NextResponse.json({
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      options: {
        schedules: Array.from(schedules.values()).sort((a, b) => a.region.localeCompare(b.region, "id-ID") || a.fase.localeCompare(b.fase, "id-ID")),
        students: Array.from(students.values()).sort((a, b) => a.name.localeCompare(b.name, "id-ID")),
      },
    });
  } catch (error) {
    console.error("ADMIN STUDENT PORTFOLIOS GET ERROR:", error);
    return NextResponse.json({ error: "Gagal mengambil karya siswa" }, { status: 500 });
  }
});
