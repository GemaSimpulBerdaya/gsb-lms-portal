import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getStudentSession } from "@/lib/student-session";
import { Module } from "@/models/Module";
import { UserProgress } from "@/models/UserProgress";
import { getActiveSemester } from "@/lib/semester";

/**
 * GET /api/student/progress
 * Ringkasan progress siswa: completed modules, quiz scores, unlock status
 */
export async function GET() {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Portal siswa hanya menampilkan modul SNBT semester aktif.
    const activeSemester = await getActiveSemester();
    const allModules = await Module.find({ programType: "SNBT", semester: activeSemester })
      .select("title slug description subject order prerequisiteModule fileUrl")
      .sort({ order: 1 });

    // Ambil progress user
    const progress = await UserProgress.findOne({ externalUserId: session.id });

    const activeModuleIds = new Set(allModules.map((module) => module._id.toString()));
    const completedIds = (progress?.completedModules || [])
      .map((moduleId) => moduleId.toString())
      .filter((moduleId) => activeModuleIds.has(moduleId));
    const quizScores = (progress?.quizScores || []).filter((score) =>
      activeModuleIds.has(score.moduleId.toString())
    );

    // Map unlock status tiap modul
    const modulesWithStatus = allModules.map((mod) => {
      const isCompleted = completedIds.includes(mod._id.toString());
      const scores = quizScores
        .filter((qs) => qs.moduleId.toString() === mod._id.toString())
        .map((qs) => ({
          score: qs.score,
          passed: qs.passed,
          attemptedAt: qs.attemptedAt,
        }));

      // Unlock logic: no prereq OR prereq is completed
      const isUnlocked =
        !mod.prerequisiteModule ||
        completedIds.includes(mod.prerequisiteModule.toString());

      return {
        _id: mod._id,
        title: mod.title,
        slug: mod.slug,
        description: mod.description,
        subject: mod.subject,
        order: mod.order,
        fileUrl: mod.fileUrl,
        isCompleted,
        isUnlocked,
        scores,
        bestScore: scores.length > 0 ? Math.max(...scores.map((s) => s.score)) : null,
      };
    });

    // Kelompokkan per subject
    const groupedBySubject = modulesWithStatus.reduce<
      Record<string, typeof modulesWithStatus>
    >((acc, mod) => {
      const subject = mod.subject || "Umum";
      if (!acc[subject]) acc[subject] = [];
      acc[subject].push(mod);
      return acc;
    }, {});

    // Statistik
    const totalModules = allModules.length;
    const completedCount = modulesWithStatus.filter((module) => module.isCompleted).length;
    const attemptedModuleIds = new Set(quizScores.map((score) => score.moduleId.toString()));
    const inProgress = [...attemptedModuleIds].filter((moduleId) => !completedIds.includes(moduleId)).length;

    return NextResponse.json({
      studentName: session.name,
      stats: {
        totalModules,
        completedCount,
        inProgressCount: Math.max(0, inProgress),
        unlockedCount: modulesWithStatus.filter((m) => m.isUnlocked).length,
        overallProgress: totalModules > 0 ? Math.round((completedCount / totalModules) * 100) : 0,
      },
      modules: modulesWithStatus,
      groupedModules: groupedBySubject,
      recentScores: quizScores
        .sort((a, b) => new Date(b.attemptedAt).getTime() - new Date(a.attemptedAt).getTime())
        .slice(0, 10)
        .map((qs) => {
          const mod = allModules.find((m) => m._id.toString() === qs.moduleId.toString());
          return {
            moduleTitle: mod?.title || "Unknown",
            subject: mod?.subject || "Umum",
            score: qs.score,
            passed: qs.passed,
            attemptedAt: qs.attemptedAt,
          };
        }),
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Terjadi kesalahan" },
      { status: 500 }
    );
  }
}
