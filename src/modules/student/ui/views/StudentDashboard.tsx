"use client";

import React from "react";
import Link from "next/link";
import {
  BookOpen,
  PlayCircle,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  FileText,
  BarChart3,
  BookMarked,
  Target,
  ChevronRight,
  Zap,
  RefreshCw,
  Trophy,
  Calculator,
  Languages,
  Library,
  PenTool,
} from "lucide-react";

interface ModuleData {
  _id: string;
  title: string;
  slug: string;
  description: string;
  subject: string;
  order: number;
  fileUrl?: string;
  isCompleted: boolean;
  isUnlocked: boolean;
  scores: { score: number; passed: boolean; attemptedAt: string }[];
  bestScore: number | null;
}

interface StudentDashboardProps {
  data: {
    studentName: string;
    stats: {
      totalModules: number;
      completedCount: number;
      inProgressCount: number;
      unlockedCount: number;
      overallProgress: number;
    };
    groupedModules: Record<string, ModuleData[]>;
    recentScores: {
      moduleTitle: string;
      subject: string;
      score: number;
      passed: boolean;
      attemptedAt: string;
    }[];
  };
}

const subjectColors: Record<string, { bg: string; text: string; light: string; border: string; icon: React.ElementType }> = {
  "Penalaran Matematika": { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200", icon: Calculator },
  "Matematika": { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200", icon: Calculator },
  "Bahasa Indonesia": { bg: "bg-gsb-orange", text: "text-gsb-maroon", light: "bg-gsb-orange/10", border: "border-gsb-orange/20", icon: Library },
  "Bahasa Inggris": { bg: "bg-purple-600", text: "text-purple-600", light: "bg-purple-50", border: "border-purple-200", icon: Languages },
  "Pengetahuan Kuantitatif": { bg: "bg-gsb-orange", text: "text-gsb-orange", light: "bg-gsb-orange/10", border: "border-gsb-orange/20", icon: BarChart3 },
};

export default function StudentDashboard({ data }: StudentDashboardProps) {
  const { stats, groupedModules, studentName } = data;

  const getSubjectColor = (subject: string) =>
    subjectColors[subject] || { bg: "bg-gsb-orange", text: "text-gsb-maroon", light: "bg-gsb-orange/10", border: "border-gsb-orange/20", icon: BookOpen };

  const allModules = Object.values(groupedModules).flat();
  const nextModule =
    allModules.find((mod) => mod.isUnlocked && !mod.isCompleted) ||
    allModules.find((mod) => mod.isUnlocked) ||
    null;

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* ===== GREETING CARD ===== */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 mb-5 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-stretch justify-between gap-5">
            <div>
              <h1 className="text-xl sm:text-2xl font-heading font-bold text-slate-900 leading-tight">
                Halo, <span className="text-gsb-maroon">{studentName}!</span>
              </h1>
              <p className="text-slate-500 text-sm mt-1.5 max-w-xl font-medium">
                Lanjutkan progres persiapan SNBT-mu dengan alur belajar yang sudah terbuka.
              </p>
              <div className="mt-4 flex flex-col sm:flex-row gap-2.5">
                {nextModule && (
                  <Link
                    href={`/student/modules/${nextModule.slug}`}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-gsb-orange hover:bg-gsb-orange/90 text-white rounded-xl text-sm font-bold transition-all active:scale-[0.97] shadow-sm"
                  >
                    <PlayCircle className="h-4 w-4" />
                    Lanjutkan Belajar
                    <ChevronRight className="h-4 w-4" />
                  </Link>
                )}
                <Link
                  href="/student/progress"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-sm font-bold transition-all active:scale-[0.97] border border-slate-200"
                >
                  <BarChart3 className="h-4 w-4" />
                  Lihat Progress
                </Link>
              </div>
            </div>

            {nextModule && (
              <div className="lg:w-75 rounded-xl border border-gsb-orange/20 bg-gsb-orange/5 p-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gsb-maroon">Rekomendasi Berikutnya</p>
                <h2 className="mt-1.5 text-base font-heading font-bold text-slate-900 line-clamp-2">{nextModule.title}</h2>
                <p className="mt-0.5 text-sm font-medium text-slate-500">{nextModule.subject}</p>
                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-600">
                  <PenTool className="h-3.5 w-3.5 text-gsb-orange" />
                  Bagian {nextModule.order}
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 bg-slate-50 rounded-xl p-4 border border-slate-100">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-gsb-maroon" />
                <span className="text-sm font-bold text-slate-700">Progress Belajar Keseluruhan</span>
              </div>
              <span className="text-lg font-heading font-bold text-gsb-maroon">{stats.overallProgress}%</span>
            </div>
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gsb-orange rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${stats.overallProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 font-medium">
              {stats.completedCount} dari {stats.totalModules} modul telah diselesaikan
            </p>
          </div>
        </div>

        {/* ===== STATS ROW ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Total Modul", value: stats.totalModules, icon: BookMarked, color: "bg-blue-500 text-white", light: "bg-blue-50" },
            { label: "Dalam Progress", value: stats.inProgressCount, icon: RefreshCw, color: "bg-amber-400 text-white", light: "bg-amber-50" },
            { label: "Selesai", value: stats.completedCount, icon: Trophy, color: "bg-green-500 text-white", light: "bg-green-50" },
            { label: "Terbuka", value: stats.unlockedCount, icon: Zap, color: "bg-gsb-orange text-white", light: "bg-orange-50" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm hover:shadow-md transition-all group flex items-center gap-3"
            >
              <div className={`h-9 w-9 rounded-lg ${stat.color} flex items-center justify-center shadow-sm shrink-0 group-hover:scale-105 transition-transform`}>
                <stat.icon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-xl font-heading font-bold text-slate-800 leading-none">{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1 truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ===== RECENT ACTIVITY ===== */}
        {data.recentScores.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6 shadow-sm">
            <div className="px-4 sm:px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-gsb-orange/10 flex items-center justify-center">
                  <TrendingUp className="h-3.5 w-3.5 text-gsb-orange" />
                </div>
                <span className="text-sm font-heading font-bold text-slate-800">Aktivitas Terbaru</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentScores.slice(0, 3).map((score, i) => (
                <div key={i} className="flex items-center justify-between px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${
                      score.passed ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"
                    }`}>
                      {score.passed ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <FileText className="h-4 w-4 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{score.moduleTitle}</p>
                      <p className="text-xs text-slate-500">{score.subject}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <span className={`text-sm font-bold ${score.passed ? "text-green-600" : "text-red-600"}`}>
                      {score.score}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 ml-1">/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== MODULES ===== */}
        <section>
          <div className="flex items-center gap-2.5 mb-3.5">
            <div className="h-9 w-9 rounded-lg bg-gsb-orange text-white flex items-center justify-center shadow-sm">
              <BookOpen className="h-4.5 w-4.5" />
            </div>
            <div>
              <h3 className="text-base font-heading font-bold text-slate-900">Modul Belajar</h3>
              <p className="text-xs text-slate-500 font-medium">{stats.completedCount}/{stats.totalModules} modul selesai</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {allModules.map((mod) => {
                    const modColors = getSubjectColor(mod.subject);
                    const hasQuiz = mod.scores.length > 0;
                    const statusLabel = mod.isCompleted
                      ? "Selesai"
                      : hasQuiz && !mod.isCompleted
                      ? "Coba Lagi"
                      : mod.isUnlocked
                      ? "Mulai Belajar"
                      : "Terkunci";

                    return (
                      <div
                        key={mod._id}
                        className={`group bg-white rounded-2xl border transition-all duration-300 overflow-hidden flex flex-col ${
                          mod.isCompleted
                            ? "border-green-200 hover:border-green-300 hover:shadow-md"
                            : mod.isUnlocked
                            ? "border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-1"
                            : "border-slate-100 bg-slate-50 opacity-75"
                        }`}
                      >
                        {/* Top accent */}
                        <div className={`h-1 w-full ${
                          mod.isCompleted
                            ? "bg-green-500"
                            : mod.isUnlocked
                            ? modColors.bg
                            : "bg-slate-200"
                        }`} />

                        <div className="p-4 flex-1 flex flex-col">
                          {/* Icon row */}
                          <div className="flex justify-between items-start mb-3">
                            <div className={`h-9 w-9 rounded-lg flex items-center justify-center transition-transform group-hover:scale-105 ${
                              mod.isCompleted ? "bg-green-50 border border-green-100" :
                              mod.isUnlocked ? `${modColors.light} border ${modColors.border}` : "bg-slate-200"
                            }`}>
                              {mod.isCompleted ? (
                                <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                              ) : mod.isUnlocked ? (
                                <PlayCircle className={`h-4.5 w-4.5 ${modColors.text}`} />
                              ) : (
                                <Lock className="h-4.5 w-4.5 text-slate-400" />
                              )}
                            </div>
                            {mod.bestScore !== null && (
                              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                                mod.bestScore >= 75 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                              }`}>
                                {mod.bestScore}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="font-heading font-bold text-slate-900 mb-1 line-clamp-1 text-sm group-hover:text-gsb-maroon transition-colors">
                            {mod.title}
                          </h4>
                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-4 min-h-8 flex-1">
                            {mod.description || "Materi persiapan SNBT"}
                          </p>

                          <span className={`self-start mb-3 text-[10px] font-bold px-2 py-1 rounded-md border ${modColors.light} ${modColors.text} ${modColors.border}`}>
                            {mod.subject || "Umum"}
                          </span>

                          {/* Action */}
                          {mod.isUnlocked ? (
                            <Link
                              href={`/student/modules/${mod.slug}`}
                              className={`w-full py-2.5 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                                mod.isCompleted
                                  ? "bg-green-50 text-green-700 hover:bg-green-100 border border-green-200"
                                  : `text-white shadow-sm ${modColors.bg} hover:opacity-90`
                              }`}
                            >
                              <span>{statusLabel}</span>
                              <ArrowRight className="h-4 w-4" />
                            </Link>
                          ) : (
                            <button
                              disabled
                              className="w-full py-2.5 rounded-lg bg-slate-100 text-slate-400 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
                            >
                              <Lock className="h-4 w-4" />
                              <span>Terkunci</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
            })}
          </div>

          {/* Empty state */}
          {allModules.length === 0 && (
            <div className="text-center py-14 bg-white rounded-2xl border border-slate-200 shadow-sm">
              <div className="h-14 w-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                <BookOpen className="h-7 w-7 text-slate-300" />
              </div>
              <h3 className="text-base font-heading font-bold text-slate-800 mb-1">Belum Ada Modul</h3>
              <p className="text-sm text-slate-500">Admin akan menambahkan modul belajar segera.</p>
            </div>
          )}
        </section>

        <div className="h-12" />
      </div>
    </div>
  );
}
