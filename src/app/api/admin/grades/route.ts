import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import AnakDidik from "@/models/AnakDidik";
import { NilaiOffline } from "@/models/Relawan";
import { Attendance } from "@/models/Attendance";
import { Schedule } from "@/models/Schedule";

type WeeklyGrade = {
  scoreConcept: number;
  scoreQuiz: number;
  scoreAttitude: number;
  score: number;
  title: string;
};

type UasComponent = {
  subject: string;
  title: string;
  score: number;
  maxScore: number;
  notes?: string;
};

type AttendanceDayRec = {
  week: number;
  date: string;
  status: string;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
};

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const semester = searchParams.get("semester");
  const region = searchParams.get("region");
  const level = searchParams.get("level");

  if (!semester) {
    return NextResponse.json({ error: "Semester is required" }, { status: 400 });
  }

  await connectDB();

  try {
    // 1. Fetch Students
    const studentFilter: Record<string, unknown> = {};
    if (region && region !== "ALL") {
      studentFilter.region = { $regex: new RegExp(`^${region.trim()}$`, "i") };
    }
    if (level && level !== "ALL") {
      studentFilter.category = { $regex: new RegExp(`^${level.trim()}$`, "i") };
    }

    const students = await AnakDidik.find(studentFilter).sort({ name: 1 }).lean();
    const studentIds = students.map((s) => s._id);

    // 2. Grades & Attendance
    const [grades, attendance, schedules] = await Promise.all([
      NilaiOffline.find({ anakDidikId: { $in: studentIds }, semester }).lean(),
      Attendance.find({ anakDidikId: { $in: studentIds }, semester }).lean(),
      Schedule.find({ semester }).lean(),
    ]);

    // Build map region+level -> schedule for kbmDates lookup
    const scheduleMap = new Map<string, (typeof schedules)[number]>();
    for (const s of schedules) {
      scheduleMap.set(`${(s.region || "").toLowerCase()}|${(s.level || "").toLowerCase()}`, s);
    }

    // 4. Map per student
    const reportData = students.map((student) => {
      const studentGrades = grades.filter(
        (g) => g.anakDidikId.toString() === student._id.toString()
      );
      const studentAttendance = attendance.filter(
        (a) => a.anakDidikId.toString() === student._id.toString()
      );

      const weeklyGrades: Record<number, WeeklyGrade> = {};
      let utsScore = 0;
      let uasScore = 0; // total akumulasi UAS (legacy)

      // UAS components
      const uasLiterasiKognitif: UasComponent[] = [];
      const uasLiterasiAfektif: UasComponent[] = [];
      const uasBahasaInggris: UasComponent[] = [];
      const tryouts: Array<{ week: number; tryoutNumber: number; score: number }> = [];

      studentGrades.forEach((g) => {
        const titleUpper = (g.title || "").toUpperCase();

        if (g.type === "TUGAS" && g.week) {
          weeklyGrades[g.week] = {
            scoreConcept: g.scoreConcept || 0,
            scoreQuiz: g.scoreQuiz || 0,
            scoreAttitude: g.scoreAttitude || 0,
            score: g.score,
            title: g.title || `KBM #${g.week}`,
          };
        } else if (g.type === "UTS" || titleUpper === "UTS") {
          utsScore = g.score;
        } else if (g.type === "UAS") {
          const comp: UasComponent = {
            subject: g.subject || "LAIN",
            title: g.title || "",
            score: g.score,
            maxScore: g.maxScore || 100,
            notes: g.notes,
          };
          uasScore += g.score;
          if (["NUMERASI", "SAINS", "BINDO"].includes(g.subject || "")) {
            uasLiterasiKognitif.push(comp);
          } else if (["MANDIRI", "BERNALAR_KRITIS", "KREATIF"].includes(g.subject || "")) {
            uasLiterasiAfektif.push(comp);
          } else if (g.subject === "BING") {
            uasBahasaInggris.push(comp);
          } else if (titleUpper === "UAS") {
            // legacy: simpan sebagai skor tunggal
            uasScore = g.score;
          }
        } else if (g.type === "TRYOUT") {
          tryouts.push({
            week: g.week || 0,
            tryoutNumber: g.tryoutNumber || 1,
            score: g.score,
          });
        }
      });

      // Attendance summary + daily list (untuk Lampiran 2)
      const attendanceSummary = {
        HADIR: studentAttendance.filter((a) => a.status === "HADIR").length,
        IZIN: studentAttendance.filter((a) => a.status === "IZIN").length,
        SAKIT: studentAttendance.filter((a) => a.status === "SAKIT").length,
        ALFA: studentAttendance.filter((a) => a.status === "ALFA").length,
        ASINKRONUS: studentAttendance.filter((a) => a.status === "ASINKRONUS").length,
        total: studentAttendance.length,
      };

      const attendanceDays: AttendanceDayRec[] = studentAttendance
        .sort((a, b) => (a.week || 0) - (b.week || 0))
        .map((a) => {
          const wk = a.week;
          const wg = wk ? weeklyGrades[wk] : null;
          return {
            week: wk,
            date: a.date,
            status: a.status,
            scoreConcept: wg?.scoreConcept,
            scoreQuiz: wg?.scoreQuiz,
            scoreAttitude: wg?.scoreAttitude,
          };
        });

      // Rata-rata skor mingguan (untuk predikat)
      const tasks = Object.values(weeklyGrades);
      const avgConcept = tasks.length > 0 ? tasks.reduce((a, t) => a + t.scoreConcept, 0) / tasks.length : 0;
      const avgQuiz = tasks.length > 0 ? tasks.reduce((a, t) => a + t.scoreQuiz, 0) / tasks.length : 0;
      const avgAttitude = tasks.length > 0 ? tasks.reduce((a, t) => a + t.scoreAttitude, 0) / tasks.length : 0;
      const finalScore = Math.round((avgConcept + avgQuiz + avgAttitude) / 3);

      // Akumulasi poin KBM (sesuai format PDF raport: jumlah poin bukan rata-rata)
      const totalKbmConcept = tasks.reduce((a, t) => a + t.scoreConcept, 0);
      const totalKbmQuiz = tasks.reduce((a, t) => a + t.scoreQuiz, 0);
      const totalKbmAttitude = tasks.reduce((a, t) => a + t.scoreAttitude, 0);
      const totalKbm = totalKbmConcept + totalKbmQuiz + totalKbmAttitude;

      // Total UAS per group
      const sumComp = (arr: UasComponent[]) => arr.reduce((a, c) => a + c.score, 0);
      const sumMax = (arr: UasComponent[]) => arr.reduce((a, c) => a + c.maxScore, 0);

      // KBM schedule dates (Lampiran 1)
      const schedKey = `${(student.region || "").toLowerCase()}|${(student.category || "").toLowerCase()}`;
      const sched = scheduleMap.get(schedKey);
      const kbmDates = sched?.kbmDates || [];

      return {
        _id: student._id,
        name: student.name,
        category: student.category,
        region: student.region,
        parentName: student.parentName,

        // Profil Raport
        profile: {
          gender: student.gender || "",
          birthPlace: student.birthPlace || "",
          birthDate: student.birthDate || null,
          schoolOrigin: student.schoolOrigin || "",
          phone: student.phone || "",
          address: student.address || "",
          studentCode: student.studentCode || "",
          kodeKelas: student.kodeKelas || "",
          pic: student.pic || "",
        },

        weeklyGrades,
        utsScore,
        uasScore,

        // UAS breakdown
        uas: {
          literasiKognitif: uasLiterasiKognitif,
          literasiAfektif: uasLiterasiAfektif,
          bahasaInggris: uasBahasaInggris,
          totals: {
            kognitifSiswa: sumComp(uasLiterasiKognitif),
            kognitifMax: sumMax(uasLiterasiKognitif),
            afektifSiswa: sumComp(uasLiterasiAfektif),
            afektifMax: sumMax(uasLiterasiAfektif),
            bingSiswa: sumComp(uasBahasaInggris),
            bingMax: sumMax(uasBahasaInggris),
          },
        },

        tryouts,

        kbmDates,

        attendanceSummary,
        attendanceDays,

        summary: {
          avgConcept: Math.round(avgConcept),
          avgQuiz: Math.round(avgQuiz),
          avgAttitude: Math.round(avgAttitude),
          finalScore,
          totalKbmConcept,
          totalKbmQuiz,
          totalKbmAttitude,
          totalKbm,
        },
      };
    });

    return NextResponse.json({
      semester,
      totalStudents: students.length,
      data: reportData,
    });
  } catch (error) {
    console.error("ADMIN GRADES GET ERROR:", error);
    return NextResponse.json({ error: "Gagal mengambil data rekap nilai" }, { status: 500 });
  }
}
