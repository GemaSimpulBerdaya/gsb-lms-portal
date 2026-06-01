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

const subjectColors: Record<string, { bg: string; text: string; light: string; border: string; icon: string }> = {
  "Penalaran Matematika": { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200", icon: "🔢" },
  "Matematika": { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200", icon: "🔢" },
  "Bahasa Indonesia": { bg: "bg-gsb-green", text: "text-gsb-green", light: "bg-gsb-green/10", border: "border-gsb-green/20", icon: "📖" },
  "Bahasa Inggris": { bg: "bg-purple-600", text: "text-purple-600", light: "bg-purple-50", border: "border-purple-200", icon: "🌍" },
  "Pengetahuan Kuantitatif": { bg: "bg-gsb-orange", text: "text-gsb-orange", light: "bg-gsb-orange/10", border: "border-gsb-orange/20", icon: "📊" },
};

export default function StudentDashboard({ data }: StudentDashboardProps) {
  const { stats, groupedModules, studentName } = data;

  const getSubjectColor = (subject: string) =>
    subjectColors[subject] || { bg: "bg-gsb-green", text: "text-gsb-green", light: "bg-gsb-green/10", border: "border-gsb-green/20", icon: "📚" };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        
        {/* ===== GREETING CARD ===== */}
        <div className="relative overflow-hidden bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 mb-6 sm:mb-8 shadow-sm">
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-gsb-yellow/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-gsb-orange/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-heading font-bold text-slate-900 leading-tight">
                Halo, <span className="text-gsb-green">{studentName}!</span> 👋
              </h1>
              <p className="text-slate-500 text-sm sm:text-base mt-2 max-w-xl font-medium">
                Siap belajar hari ini? Lanjutkan progress persiapan SNBT-mu dan raih kampus impian!
              </p>
            </div>
            <Link
              href="/student/progress"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gsb-orange hover:bg-gsb-orange/90 text-white rounded-full text-sm font-semibold transition-all active:scale-[0.97] shadow-md hover:shadow-lg"
            >
              <BarChart3 className="h-4 w-4" />
              Lihat Progress
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="relative z-10 mt-8 bg-slate-50 rounded-2xl p-5 border border-slate-100">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-gsb-green" />
                <span className="text-sm font-bold text-slate-700">Progress Belajar Keseluruhan</span>
              </div>
              <span className="text-xl font-heading font-bold text-gsb-green">{stats.overallProgress}%</span>
            </div>
            <div className="h-2.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gsb-green rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${stats.overallProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2.5 font-medium">
              {stats.completedCount} dari {stats.totalModules} modul telah diselesaikan
            </p>
          </div>
        </div>

        {/* ===== STATS ROW ===== */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8 sm:mb-10">
          {[
            { label: "Total Modul", value: stats.totalModules, icon: BookMarked, color: "bg-blue-500 text-white", light: "bg-blue-50" },
            { label: "Dalam Progress", value: stats.inProgressCount, icon: RefreshCw, color: "bg-gsb-yellow text-white", light: "bg-amber-50" },
            { label: "Selesai", value: stats.completedCount, icon: Trophy, color: "bg-gsb-green text-white", light: "bg-green-50" },
            { label: "Terbuka", value: stats.unlockedCount, icon: Zap, color: "bg-gsb-orange text-white", light: "bg-orange-50" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all group"
            >
              <div className={`h-12 w-12 rounded-xl ${stat.color} flex items-center justify-center mb-4 shadow-sm group-hover:scale-105 transition-transform`}>
                <stat.icon className="h-6 w-6" />
              </div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl sm:text-3xl font-heading font-bold text-slate-800 mt-1">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* ===== RECENT ACTIVITY ===== */}
        {data.recentScores.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden mb-8 sm:mb-10 shadow-sm">
            <div className="px-5 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-gsb-orange/10 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-gsb-orange" />
                </div>
                <span className="text-sm font-heading font-bold text-slate-800">Aktivitas Terbaru</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {data.recentScores.slice(0, 3).map((score, i) => (
                <div key={i} className="flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      score.passed ? "bg-green-50 border border-green-100" : "bg-red-50 border border-red-100"
                    }`}>
                      {score.passed ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : (
                        <FileText className="h-5 w-5 text-red-600" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{score.moduleTitle}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{score.subject}</p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-4">
                    <span className={`text-base font-bold ${score.passed ? "text-green-600" : "text-red-600"}`}>
                      {score.score}
                    </span>
                    <span className="text-xs font-semibold text-slate-400 ml-1">/100</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== MODULES BY SUBJECT ===== */}
        <div className="space-y-10">
          {Object.entries(groupedModules).map(([subject, modules]) => {
            const colors = getSubjectColor(subject);
            const completed = modules.filter((m) => m.isCompleted).length;
            const total = modules.length;
            const pct = Math.round((completed / total) * 100);

            return (
              <section key={subject} className="relative">
                {/* Subject header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-xl ${colors.bg} text-white flex items-center justify-center text-xl shadow-sm`}>
                      {colors.icon}
                    </div>
                    <div>
                      <h3 className="text-lg font-heading font-bold text-slate-900">{subject}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">{completed}/{total} modul selesai</p>
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm">
                    <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors.bg}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-600 w-8">{pct}%</span>
                  </div>
                </div>

                {/* Module cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                  {modules.map((mod) => {
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

                        <div className="p-5 flex-1 flex flex-col">
                          {/* Icon row */}
                          <div className="flex justify-between items-start mb-4">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-xl transition-transform group-hover:scale-105 ${
                              mod.isCompleted ? "bg-green-50 border border-green-100" :
                              mod.isUnlocked ? `${modColors.light} border ${modColors.border}` : "bg-slate-200"
                            }`}>
                              {mod.isCompleted ? (
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                              ) : mod.isUnlocked ? (
                                <PlayCircle className={`h-6 w-6 ${modColors.text}`} />
                              ) : (
                                <Lock className="h-6 w-6 text-slate-400" />
                              )}
                            </div>
                            {mod.bestScore !== null && (
                              <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${
                                mod.bestScore >= 75 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                              }`}>
                                {mod.bestScore}
                              </span>
                            )}
                          </div>

                          {/* Title */}
                          <h4 className="font-heading font-bold text-slate-900 mb-1.5 line-clamp-1 text-base group-hover:text-gsb-green transition-colors">
                            {mod.title}
                          </h4>
                          <p className="text-sm text-slate-500 line-clamp-2 leading-relaxed mb-6 min-h-[2.5rem] flex-1">
                            {mod.description || "Materi persiapan SNBT"}
                          </p>

                          {/* Action */}
                          {mod.isUnlocked ? (
                            <Link
                              href={`/student/modules/${mod.slug}`}
                              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
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
                              className="w-full py-3 rounded-xl bg-slate-100 text-slate-400 font-bold text-sm flex items-center justify-center gap-2 cursor-not-allowed border border-slate-200"
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
              </section>
            );
          })}

          {/* Empty state */}
          {Object.keys(groupedModules).length === 0 && (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="h-20 w-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-5 border border-slate-100">
                <BookOpen className="h-10 w-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-heading font-bold text-slate-800 mb-2">Belum Ada Modul</h3>
              <p className="text-sm text-slate-500">Admin akan menambahkan modul belajar segera.</p>
            </div>
          )}
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}
