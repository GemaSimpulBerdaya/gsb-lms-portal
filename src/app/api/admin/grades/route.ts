import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { aggregateReports } from "@/lib/reportAggregator";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const semester = searchParams.get("semester");
  const region = searchParams.get("region");
  const level = searchParams.get("level");
  const studentId = searchParams.get("studentId");

  if (!semester) {
    return NextResponse.json({ error: "Semester is required" }, { status: 400 });
  }

  await connectDB();

  try {
    const reports = await aggregateReports({ semester, region, level, studentId });

    // Backward-compat shim untuk UI lama (`/admin/grades/page.tsx`) yang
    // masih expect `weeklyGrades` sebagai Record<number,…>, plus `summary`
    // dan `uasScore` ringkas. Shape baru (penilaian, kehadiran, …) tetap
    // dikirim — UI bisa migrasi bertahap.
    const data = reports.map((r) => {
      const weeklyGradesByNum: Record<
        number,
        {
          scoreConcept: number;
          scoreQuiz: number;
          scoreAttitude: number;
          score: number;
          title: string;
        }
      > = {};
      for (const wg of r.weeklyGrades) {
        weeklyGradesByNum[wg.week] = {
          scoreConcept: wg.scoreConcept,
          scoreQuiz: wg.scoreQuiz,
          scoreAttitude: wg.scoreAttitude,
          score: wg.score,
          title: wg.title,
        };
      }

      const taskCount = r.weeklyGrades.length || 1;
      const totalConcept = r.penilaian.kbm.konsep.siswa;
      const totalQuiz = r.penilaian.kbm.kuis.siswa;
      const totalAttitude = r.penilaian.kbm.sikap.siswa;

      const uasScore =
        r.penilaian.uasLiterasi.kognitifTotal.siswa +
        r.penilaian.uasLiterasi.afektifTotal.siswa +
        r.penilaian.uasBahasaInggrisTotal.siswa;

      return {
        ...r,
        weeklyGrades: weeklyGradesByNum, // legacy shape
        weeklyGradesList: r.weeklyGrades, // shape baru (per-week, akumulasi)
        meetings: r.meetings, // raw per-pertemuan
        uasScore,
        summary: {
          avgConcept: Math.round(totalConcept / taskCount),
          avgQuiz: Math.round(totalQuiz / taskCount),
          avgAttitude: Math.round(totalAttitude / taskCount),
          finalScore: r.penilaian.persentase,
          totalKbmConcept: totalConcept,
          totalKbmQuiz: totalQuiz,
          totalKbmAttitude: totalAttitude,
          totalKbm: totalConcept + totalQuiz + totalAttitude,
        },
      };
    });

    return NextResponse.json({
      semester,
      totalStudents: data.length,
      data,
    });
  } catch (error) {
    console.error("ADMIN GRADES GET ERROR:", error);
    return NextResponse.json(
      { error: "Gagal mengambil data rekap nilai" },
      { status: 500 }
    );
  }
}
