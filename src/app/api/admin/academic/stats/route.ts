import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withModuleManager } from "@/lib/apiAuth";
import { Module } from "@/models/Module";
import { Settings } from "@/models/Settings";
import mongoose from "mongoose";

/**
 * GET /api/admin/academic/stats
 *
 * Statistik modul-centric untuk Dashboard Akademik (Tim Akademik & Admin).
 * Sengaja TIDAK menyentuh data operasional (relawan, siswa, kehadiran, nilai)
 * karena akun Tim Akademik tidak punya akses ke domain itu.
 *
 * Scope default ke semester aktif; bisa di-override via ?semester=YYYY-N,
 * atau ?semester=all untuk lintas semester.
 */
export const GET = withModuleManager(async (request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const querySem = searchParams.get("semester");

    const activeSemesterSetting = await Settings.findOne({ key: "activeSemester" }).lean<{
      value: string;
    }>();
    const activeSem = activeSemesterSetting?.value || "2025-1";

    // semester=all → lintas semester; selain itu pakai query atau semester aktif.
    const semesterScope = querySem === "all" ? null : querySem || activeSem;
    const baseFilter: Record<string, unknown> = semesterScope
      ? { semester: semesterScope }
      : {};

    const modules = await Module.find(baseFilter)
      .select("title programType learningLocation fase subject week fileUrl createdAt")
      .sort({ createdAt: -1 })
      .lean<
        Array<{
          _id: mongoose.Types.ObjectId;
          title: string;
          programType: "SNBT" | "OFFLINE";
          learningLocation?: string;
          fase?: string;
          subject?: string;
          week?: number | null;
          fileUrl?: string;
          createdAt: Date;
        }>
      >();

    const moduleIds = modules.map((m) => m._id);

    // Modul yang sudah punya kuis (untuk metrik kelengkapan kurikulum).
    let quizModuleIds = new Set<string>();
    try {
      const Quiz = mongoose.models.Quiz || (await import("@/models/Quiz")).Quiz;
      const quizzes = (await Quiz.find({ moduleId: { $in: moduleIds } })
        .select("moduleId")
        .lean()) as Array<{ moduleId: { toString(): string } }>;
      quizModuleIds = new Set(quizzes.map((q) => q.moduleId.toString()));
    } catch (qErr) {
      console.warn("Academic stats: gagal ambil quiz", qErr);
    }

    const totalModules = modules.length;
    const totalSNBT = modules.filter((m) => m.programType === "SNBT").length;
    const totalOffline = modules.filter((m) => m.programType === "OFFLINE").length;
    const withQuiz = modules.filter((m) => quizModuleIds.has(m._id.toString())).length;
    const withoutQuiz = totalModules - withQuiz;
    const withFile = modules.filter((m) => (m.fileUrl || "").trim().length > 0).length;

    // Breakdown per fase (hanya OFFLINE yang punya fase).
    const faseCounts = new Map<string, number>();
    for (const m of modules) {
      const fase = (m.fase || "").trim();
      if (!fase) continue;
      faseCounts.set(fase, (faseCounts.get(fase) || 0) + 1);
    }
    const byFase = Array.from(faseCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Breakdown per mata pelajaran.
    const subjectCounts = new Map<string, number>();
    for (const m of modules) {
      const subject = (m.subject || "").trim() || "Tanpa Mapel";
      subjectCounts.set(subject, (subjectCounts.get(subject) || 0) + 1);
    }
    const bySubject = Array.from(subjectCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Breakdown per lokasi belajar.
    const locationCounts = new Map<string, number>();
    for (const m of modules) {
      const loc = (m.learningLocation || "").trim() || "Tidak diset";
      locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
    }
    const byLocation = Array.from(locationCounts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    // Modul terbaru (10) untuk panel aktivitas.
    const recentModules = modules.slice(0, 10).map((m) => ({
      id: m._id.toString(),
      title: m.title,
      programType: m.programType,
      learningLocation: m.learningLocation || "",
      fase: m.fase || "",
      subject: m.subject || "",
      week: m.week ?? null,
      hasQuiz: quizModuleIds.has(m._id.toString()),
      createdAt: m.createdAt,
    }));

    return NextResponse.json({
      semester: semesterScope || "all",
      stats: {
        totalModules,
        totalSNBT,
        totalOffline,
        withQuiz,
        withoutQuiz,
        withFile,
        byFase,
        bySubject,
        byLocation,
      },
      recentModules,
    });
  } catch (error: unknown) {
    console.error("Academic Stats Error:", error);
    const message = error instanceof Error ? error.message : "Gagal mengambil data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
