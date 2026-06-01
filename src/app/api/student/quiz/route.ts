import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getStudentSession } from "@/lib/student-session";
import { Quiz } from "@/models/Quiz";
import { Module } from "@/models/Module";
import { UserProgress } from "@/models/UserProgress";
import mongoose from "mongoose";

/**
 * GET /api/student/quiz?moduleId=...
 * Ambil soal kuis (tanpa correctAnswer) untuk modul tertentu
 */
export async function GET(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");

  if (!moduleId) {
    return NextResponse.json({ error: "moduleId wajib diisi" }, { status: 400 });
  }

  try {
    await connectDB();

    const quiz = await Quiz.findOne({ moduleId: new mongoose.Types.ObjectId(moduleId) });
    if (!quiz) {
      return NextResponse.json({ error: "Kuis belum tersedia untuk modul ini" }, { status: 404 });
    }

    // Strip correctAnswer + explanation dari response
    const safeQuestions = quiz.questions.map((q) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
    }));

    // Cek apakah user sudah pernah mencoba kuis ini
    const progress = await UserProgress.findOne({ externalUserId: session.id });
    const previousAttempt = progress?.quizScores?.find(
      (qs) => qs.moduleId.toString() === moduleId
    );

    return NextResponse.json({
      quizId: quiz._id,
      moduleId: quiz.moduleId,
      questions: safeQuestions,
      totalQuestions: quiz.questions.length,
      passingScore: quiz.passingScore,
      previousAttempt: previousAttempt
        ? {
            score: previousAttempt.score,
            passed: previousAttempt.passed,
            attemptedAt: previousAttempt.attemptedAt,
          }
        : null,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/student/quiz
 * Submit jawaban kuis, hitung skor, simpan progress
 * Body: { moduleId, answers: [{ questionId, selectedAnswer }] }
 */
export async function POST(req: NextRequest) {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { moduleId, answers } = body;

    if (!moduleId || !answers || !Array.isArray(answers)) {
      return NextResponse.json(
        { error: "moduleId dan answers (array) wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();

    // Validasi modul exist
    const module = await Module.findById(moduleId);
    if (!module) {
      return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });
    }

    // Validasi prerequisite module sudah lulus
    if (module.prerequisiteModule) {
      const progress = await UserProgress.findOne({ externalUserId: session.id });
      const prereqPassed = progress?.completedModules?.some(
        (cm) => cm.toString() === module.prerequisiteModule?.toString()
      );
      if (!prereqPassed) {
        return NextResponse.json(
          { error: "Selesaikan modul sebelumnya terlebih dahulu" },
          { status: 403 }
        );
      }
    }

    // Ambil kuis + correct answers
    const quiz = await Quiz.findOne({ moduleId: new mongoose.Types.ObjectId(moduleId) });
    if (!quiz) {
      return NextResponse.json({ error: "Kuis tidak ditemukan" }, { status: 404 });
    }

    // Hitung skor
    let correctCount = 0;
    const results = quiz.questions.map((q) => {
      const userAnswer = answers.find(
        (a: { questionId: string; selectedAnswer: number }) =>
          a.questionId === q._id?.toString()
      );
      const isCorrect = userAnswer?.selectedAnswer === q.correctAnswer;
      if (isCorrect) correctCount++;
      return {
        questionId: q._id,
        question: q.question,
        options: q.options,
        correctAnswer: q.correctAnswer, // dikembalikan setelah submit
        selectedAnswer: userAnswer?.selectedAnswer ?? null,
        isCorrect,
        explanation: q.explanation || null,
      };
    });

    const totalQuestions = quiz.questions.length;
    const score = Math.round((correctCount / totalQuestions) * 100);
    const passed = score >= quiz.passingScore;

    // Simpan progress
    const progressData = {
      moduleId: new mongoose.Types.ObjectId(moduleId),
      score,
      passed,
      attemptedAt: new Date(),
    };

    const existingProgress = await UserProgress.findOne({ externalUserId: session.id });

    if (existingProgress) {
      // Push quiz score
      existingProgress.quizScores.push(progressData as any);

      // Kalau lulus, tambahkan ke completedModules (kalau belum ada)
      if (passed) {
        const alreadyCompleted = existingProgress.completedModules.some(
          (cm) => cm.toString() === moduleId
        );
        if (!alreadyCompleted) {
          existingProgress.completedModules.push(new mongoose.Types.ObjectId(moduleId));
        }
      }

      await existingProgress.save();
    } else {
      // Buat baru
      await UserProgress.create({
        externalUserId: session.id,
        completedModules: passed ? [new mongoose.Types.ObjectId(moduleId)] : [],
        quizScores: [progressData],
      });
    }

    return NextResponse.json({
      score,
      passed,
      passingScore: quiz.passingScore,
      totalQuestions,
      correctCount,
      results,
      message: passed
        ? "Selamat! Kamu lulus kuis ini. Modul selanjutnya sudah terbuka. 🎉"
        : `Skor kamu ${score}, belum mencapai passing score ${quiz.passingScore}. Coba lagi! 💪`,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
      { status: 500 }
    );
  }
}
