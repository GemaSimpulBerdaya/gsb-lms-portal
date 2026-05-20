import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getStudentSession } from "@/lib/student-session";
import { UserProgress } from "@/models/SMA";

/**
 * GET /api/student/progress
 * Mengambil ringkasan progres belajar siswa SMA
 */
export async function GET() {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await connectDB();

    // Ambil progres siswa berdasarkan ID external mereka
    const progress = await UserProgress.findOne({ externalUserId: session.id })
      .populate("completedModules", "title category subCategory");

    if (!progress) {
      return NextResponse.json({
        studentName: session.name,
        completedModules: [],
        quizHistory: [],
        message: "Anda belum memulai pembelajaran."
      });
    }

    return NextResponse.json({
      studentName: session.name,
      totalCompleted: progress.completedModules.length,
      completedModules: progress.completedModules,
      quizHistory: progress.quizScores.sort((a: { attemptedAt: number }, b: { attemptedAt: number }) => b.attemptedAt - a.attemptedAt)
    });

  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : "Terjadi kesalahan") }, { status: 500 });
  }
}
