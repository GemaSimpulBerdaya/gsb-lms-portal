import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { Schedule } from "@/models/Schedule";
import Student from "@/models/Student";
import { Report } from "@/models/Report";
import { Attendance } from "@/models/Attendance";

import { NilaiOffline } from "@/models/NilaiOffline";
import StudentPortfolio from "@/models/StudentPortfolio";
import { Types } from "mongoose";
import { escapeRegex } from "@/lib/regex";

interface IStudentLean {
  _id: Types.ObjectId | string;
  name: string;
  region: string;
  fase: string;
}

interface IScheduleLean {
  _id: Types.ObjectId | string;
  region: string;
  fase: string;
  semester: string;
  activeWeek?: number;
  kbmDates?: {
    week: number;
    date: Date;
    topic?: string;
  }[];
  updatedAt?: Date;
  createdAt?: Date;
}

interface IReportLean {
  _id: Types.ObjectId | string;
  title: string;
  date: Date;
  region?: string;
  fase?: string;
  location?: string;
  photoUrls?: string[];
  photoUrl?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IAttendanceLean {
  _id: Types.ObjectId | string;
  week: number;
  date: Date;
  status: string;
  createdAt?: Date;
  updatedAt?: Date;
}


interface INilaiOfflineLean {
  _id: Types.ObjectId | string;
  title: string;
  type: "TUGAS" | "UAS";
  week?: number | null;
  score: number;
  subject?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface IPortfolioLean {
  _id: Types.ObjectId | string;
  title: string;
  region: string;
  fase: string;
  week?: number;
  date?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type RecentActivity = {
  id: string;
  type: "report" | "schedule" | "attendance" | "grade" | "portfolio";
  title: string;
  meta: string;
  dateLabel: string;
  href: string;
  occurredAt: string;
};

type UpcomingAgenda = {
  id: string;
  scheduleId: string;
  region: string;
  fase: string;
  week: number;
  date: string;
  topic: string;
  petugas?: string;
};

type WeeklyChecklist = {
  id: string;
  scheduleId: string;
  title: string;
  week: number;
  date: string;
  items: {
    report: boolean;
    studentAttendance: boolean;

    grade: boolean;
  };
};

const formatDateShort = (value?: Date) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const isoTime = (value?: Date) => new Date(value || 0).toISOString();

export const GET = withVolunteer(async (request, session) => {
  const { searchParams } = new URL(request.url);
  const semester = searchParams.get("semester");

  try {
    await connectDB();

    const relawanObjectId = new Types.ObjectId(session.id);
    const baseFilter: Record<string, unknown> = { teamAccountId: relawanObjectId };
    if (semester) baseFilter.semester = semester;

    const [
      totalSchedules,
      totalReports,
      schedules,
      recentReports,
      recentAttendances,

      recentGrades,
      recentPortfolios,
    ] = await Promise.all([
      Schedule.countDocuments(baseFilter),
      Report.countDocuments(baseFilter),
      Schedule.find(baseFilter).populate("kbmDates.petugas", "name").lean<IScheduleLean[]>(),
      Report.find(baseFilter)
        .sort({ createdAt: -1 })
        .limit(5)
        .select("title date region fase location photoUrl photoUrls createdAt updatedAt")
        .lean<IReportLean[]>(),
      Attendance.find(baseFilter)
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("week date status createdAt updatedAt")
        .lean<IAttendanceLean[]>(),

      NilaiOffline.find(baseFilter)
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title type week score subject createdAt updatedAt")
        .lean<INilaiOfflineLean[]>(),
      StudentPortfolio.find(baseFilter)
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title region fase week date createdAt updatedAt")
        .lean<IPortfolioLean[]>(),
    ]);

    // Count students across all unique regions and fases taught by this volunteer
    const taughtCombinations = schedules.map((s) => ({
      region: s.region,
      fase: s.fase
    }));

    // Remove duplicates
    const uniqueCombinations = taughtCombinations.filter((v, i, a) =>
      a.findIndex(t => t.region === v.region && t.fase === v.fase) === i
    );

    // Get students data
    let students: Array<{ _id: string; name: string; region: string; fase: string }> = [];
    let totalStudents = 0;
    if (uniqueCombinations.length > 0) {
      // Escape fase dan gunakan pencocokan case-insensitive untuk data legacy.
      // karena casing Student.fase di DB campur.
      const orQuery = uniqueCombinations.map(c => ({
        region: { $regex: new RegExp(`^${escapeRegex(c.region.trim())}$`, "i") },
        fase: { $regex: new RegExp(`^${escapeRegex(c.fase.trim())}$`, "i") }
      }));

      const studentDocs = await Student.find({ $or: orQuery })
        .select("name region fase")
        .sort({ name: 1 })
        .lean<IStudentLean[]>();

      students = studentDocs.map((s) => ({
        _id: String(s._id),
        name: s.name,
        region: s.region,
        fase: s.fase
      }));

      totalStudents = students.length;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const upcomingAgenda: UpcomingAgenda[] = (schedules as any[])
      .flatMap((schedule) => {
        const scheduleId = String(schedule._id);
        return (schedule.kbmDates || []).map((kbm: any) => ({
          id: `${scheduleId}-${kbm.week}`,
          scheduleId,
          region: schedule.region,
          fase: schedule.fase,
          week: kbm.week,
          date: new Date(kbm.date).toISOString(),
          topic: kbm.topic || "Belum ada topik",
          petugas: kbm.petugas?.map((p: any) => p.name).join(", ") || "Belum ditentukan",
        }));
      })
      .filter((item) => new Date(item.date).getTime() >= todayStart.getTime())
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 4);

    const activeSchedules = schedules
      .slice()
      .sort((a, b) => `${a.region}-${a.fase}`.localeCompare(`${b.region}-${b.fase}`))
      .slice(0, 4);

    const weeklyChecklist: WeeklyChecklist[] = await Promise.all(
      activeSchedules.map(async (schedule) => {
        const week = schedule.activeWeek || 1;
        const kbm = (schedule.kbmDates || []).find((date) => date.week === week);
        const kbmDate = kbm?.date ? new Date(kbm.date) : undefined;
        const matchingStudents = students.filter(
          (student) =>
            student.region.trim().toLowerCase().includes(schedule.region.trim().toLowerCase()) &&
            student.fase.toUpperCase() === schedule.fase.toUpperCase()
        );
        const studentIds = matchingStudents.map((student) => new Types.ObjectId(student._id));

        const attendanceFilter: Record<string, unknown> = {
          teamAccountId: relawanObjectId,
          semester,
          week,
          $or: [
            { scheduleId: new Types.ObjectId(String(schedule._id)) },
            { scheduleId: { $exists: false } },
          ],
        };

        const gradeFilter: Record<string, unknown> = {
          teamAccountId: relawanObjectId,
          semester,
          type: "TUGAS",
          week,
        };
        const reportFilter: Record<string, unknown> = {
          teamAccountId: relawanObjectId,
          semester,
          $or: [
            { scheduleId: new Types.ObjectId(String(schedule._id)) },
            { region: schedule.region, fase: schedule.fase },
            { location: `${schedule.region} - ${schedule.fase}` },
          ],
        };

        if (kbmDate) {
          attendanceFilter.date = kbmDate;

        }
        if (studentIds.length > 0) {
          attendanceFilter.studentId = { $in: studentIds };
          gradeFilter.studentId = { $in: studentIds };
        }

        const [attendanceCount, gradeCount, reportCount] = await Promise.all([
          Attendance.countDocuments(attendanceFilter),
          NilaiOffline.countDocuments(gradeFilter),
          Report.countDocuments(reportFilter),
        ]);

        return {
          id: `checklist-${String(schedule._id)}`,
          scheduleId: String(schedule._id),
          title: `${schedule.region} - ${schedule.fase}`,
          week,
          date: kbmDate ? kbmDate.toISOString() : "",
          items: {
            report: reportCount > 0,
            studentAttendance: studentIds.length > 0 ? attendanceCount >= studentIds.length : attendanceCount > 0,

            grade: studentIds.length > 0 ? gradeCount >= studentIds.length : gradeCount > 0,
          },
        };
      })
    );

    const scheduleActivities: RecentActivity[] = schedules
      .slice()
      .sort((a, b) => {
        const aDate = a.updatedAt || a.createdAt || new Date(0);
        const bDate = b.updatedAt || b.createdAt || new Date(0);
        return new Date(bDate).getTime() - new Date(aDate).getTime();
      })
      .slice(0, 5)
      .map((s) => ({
        id: `schedule-${String(s._id)}`,
        type: "schedule",
        title: "Jadwal mengajar diperbarui",
        meta: `${s.region} - ${s.fase} · Pekan ${s.activeWeek || 1}`,
        dateLabel: `Update ${formatDateShort(s.updatedAt || s.createdAt)}`,
        href: "/schedule",
        occurredAt: isoTime(s.updatedAt || s.createdAt),
      }));

    const recentActivities: RecentActivity[] = [
      ...recentReports.map((r) => ({
        id: `report-${String(r._id)}`,
        type: "report" as const,
        title: "Laporan KBM dibuat",
        meta: `${r.title} · ${r.region && r.fase ? `${r.region} - ${r.fase}` : r.location || "Tanpa lokasi"} · ${r.photoUrls?.length || (r.photoUrl ? 1 : 0)} foto`,
        dateLabel: `KBM ${formatDateShort(r.date)}`,
        href: "/reporting",
        occurredAt: isoTime(r.createdAt || r.updatedAt),
      })),
      ...scheduleActivities,
      ...recentAttendances.map((a) => ({
        id: `attendance-${String(a._id)}`,
        type: "attendance" as const,
        title: "Presensi siswa diinput",
        meta: `Pekan ${a.week} · Status ${a.status}`,
        dateLabel: `KBM ${formatDateShort(a.date)}`,
        href: "/attendance",
        occurredAt: isoTime(a.updatedAt || a.createdAt),
      })),

      ...recentGrades.map((g) => ({
        id: `grade-${String(g._id)}`,
        type: "grade" as const,
        title: "Nilai siswa diinput",
        meta: `${g.type === "UAS" ? `UAS ${g.subject || ""}` : `Tugas pekan ${g.week || "-"}`} · Nilai ${g.score}`,
        dateLabel: `Update ${formatDateShort(g.updatedAt || g.createdAt)}`,
        href: "/evaluation",
        occurredAt: isoTime(g.updatedAt || g.createdAt),
      })),
      ...recentPortfolios.map((p) => ({
        id: `portfolio-${String(p._id)}`,
        type: "portfolio" as const,
        title: "Karya siswa ditambahkan",
        meta: `${p.title} · ${p.region} - ${p.fase}${p.week ? ` · Pekan ${p.week}` : ""}`,
        dateLabel: p.date ? `KBM ${formatDateShort(p.date)}` : `Update ${formatDateShort(p.updatedAt || p.createdAt)}`,
        href: "/portfolio",
        occurredAt: isoTime(p.updatedAt || p.createdAt || p.date),
      })),
    ]
      .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
      .slice(0, 8);

    return NextResponse.json({
      stats: {
        totalSchedules,
        totalReports,
        totalStudents,
      },
      students,
      upcomingAgenda,
      weeklyChecklist,
      recentActivities,
    }, {
      headers: {
        "Cache-Control": "no-store, max-age=0"
      }
    });

  } catch (error: unknown) {
    console.error("Dashboard stats error:", error);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
});
