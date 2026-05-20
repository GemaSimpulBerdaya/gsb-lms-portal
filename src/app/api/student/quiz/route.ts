import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getStudentSession } from "@/lib/student-session";
import { Quiz, UserProgress } from "@/models/SMA";

/**
 * GET /api/student/quiz?moduleId=...
 * Mengambil pertanyaan kuis untuk suatu modul (Tanpa kunci jawaban)
 */
export async function GET(request: Request) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const moduleId = searchParams.get("moduleId");

  if (!moduleId) return NextResponse.json({ error: "moduleId wajib diisi" }, { status: 400 });

  try {
    await connectDB();
    const quiz = await Quiz.findOne({ moduleId }).select("-questions.correctAnswer");
    
    if (!quiz) return NextResponse.json({ error: "Kuis tidak ditemukan untuk modul ini" }, { status: 404 });

    return NextResponse.json(quiz);
  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : "Terjadi kesalahan") }, { status: 500 });
  }
}

/**
 * POST /api/student/quiz
 * Mengirim jawaban kuis dan mendapatkan skor
 */
export async function POST(request: Request) {
  const session = await getStudentSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { moduleId, answers } = await request.json(); // answers = [index_jawaban1, index_jawaban2, ...]

  if (!moduleId || !answers) return NextResponse.json({ error: "moduleId dan answers wajib diisi" }, { status: 400 });

  try {
    await connectDB();
    const quiz = await Quiz.findOne({ moduleId });
    if (!quiz) return NextResponse.json({ error: "Kuis tidak ditemukan" }, { status: 404 });

    // Hitung Skor
    let correctCount = 0;
    quiz.questions.forEach((q, index: number) => {
      if (answers[index] === q.correctAnswer) {
        correctCount++;
      }
    });

    const score = Math.round((correctCount / quiz.questions.length) * 100);
    const passed = score >= quiz.passingScore;

    // Simpan Progres ke UserProgress
    await UserProgress.findOneAndUpdate(
      { externalUserId: session.id },
      { 
        $addToSet: { completedModules: moduleId },
        $push: { 
          quizScores: { 
            moduleId, 
            score, 
            passed, 
            attemptedAt: new Date() 
          } 
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      score,
      passed,
      message: passed ? "Selamat! Anda lulus kuis ini." : "Maaf, nilai Anda belum mencukupi. Silakan coba lagi."
    });

  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : "Terjadi kesalahan") }, { status: 500 });
  }
}
