"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  CheckCircle2,
  PlayCircle,
  Lock,
  TrendingUp,
  RotateCcw,
  Loader2,
  AlertTriangle,
  Award,
  Target,
  ArrowRight,
  XCircle,
} from "lucide-react";

interface ScoreEntry {
  moduleTitle: string;
  subject: string;
  score: number;
  passed: boolean;
  attemptedAt: string;
}

interface ModuleStatus {
  _id: string;
  title: string;
  slug: string;
  subject: string;
  order: number;
  isCompleted: boolean;
  isUnlocked: boolean;
  scores: { score: number; passed: boolean; attemptedAt: string }[];
  bestScore: number | null;
}

interface ProgressData {
  studentName: string;
  stats: {
    totalModules: number;
    completedCount: number;
    inProgressCount: number;
    unlockedCount: number;
    overallProgress: number;
  };
  modules: ModuleStatus[];
  recentScores: ScoreEntry[];
  groupedModules: Record<string, ModuleStatus[]>;
}

const subjectColors: Record<string, { dot: string; badge: string; text: string }> = {
  "Penalaran Matematika": { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-600 border-blue-200", text: "text-blue-600" },
  "Matematika": { dot: "bg-blue-500", badge: "bg-blue-50 text-blue-600 border-blue-200", text: "text-blue-600" },
  "Bahasa Indonesia": { dot: "bg-gsb-green", badge: "bg-gsb-green/10 text-gsb-green border-gsb-green/20", text: "text-gsb-green" },
  "Bahasa Inggris": { dot: "bg-purple-500", badge: "bg-purple-50 text-purple-600 border-purple-200", text: "text-purple-600" },
  "Pengetahuan Kuantitatif": { dot: "bg-gsb-orange", badge: "bg-gsb-orange/10 text-gsb-orange border-gsb-orange/20", text: "text-gsb-orange" },
};

export default function StudentProgressPage() {
  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "unlocked" | "completed" | "locked">("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/student/progress");
        if (!res.ok) throw new Error("Gagal memuat progress");
        setData(await res.json());
      } catch (e: any) {
        setError(e.message || "Terjadi kesalahan");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-5 border border-slate-200 shadow-sm">
            <Loader2 className="h-8 w-8 text-gsb-green animate-spin" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Memuat progress belajar...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center bg-white p-8 rounded-3xl border border-red-100 shadow-sm">
          <div className="h-16 w-16 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <p className="text-base font-heading font-bold text-slate-900 mb-1">Terjadi Kesalahan</p>
          <p className="text-sm font-medium text-slate-500">{error || "Gagal memuat data"}</p>
        </div>
      </div>
    );
  }

  const { stats, modules, recentScores } = data;

  const filteredModules = modules.filter((m) => {
    if (filter === "unlocked") return m.isUnlocked;
    if (filter === "completed") return m.isCompleted;
    if (filter === "locked") return !m.isUnlocked;
    return true;
  });

  const groupedFiltered = filteredModules.reduce<Record<string, ModuleStatus[]>>((acc, m) => {
    const subject = m.subject || "Umum";
    if (!acc[subject]) acc[subject] = [];
    acc[subject].push(m);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-transparent">
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-center gap-4 mb-2">
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-gsb-green flex items-center justify-center shadow-sm">
              <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-heading font-extrabold text-slate-900 tracking-tight">Progress Belajar</h1>
              <p className="text-sm text-slate-500 mt-1 font-medium">
                Pantau perkembangan belajarmu dalam persiapan SNBT
              </p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-8 sm:mb-10">
          {[
            { label: "Pencapaian", value: `${stats.overallProgress}%`, icon: Target, color: "bg-gsb-green", textColor: "text-gsb-green" },
            { label: "Modul Selesai", value: stats.completedCount, icon: CheckCircle2, color: "bg-blue-600", textColor: "text-blue-600" },
            { label: "Sedang Belajar", value: stats.inProgressCount, icon: PlayCircle, color: "bg-cyan-500", textColor: "text-cyan-600" },
            { label: "Total Modul", value: stats.totalModules, icon: Award, color: "bg-gsb-orange", textColor: "text-gsb-orange" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white rounded-3xl border border-slate-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-4">
                <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl ${stat.color} flex items-center justify-center shadow-sm`}>
                  <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
                </div>
                <span className={`text-2xl sm:text-3xl font-heading font-extrabold ${stat.textColor}`}>{stat.value}</span>
              </div>
              <p className="text-xs sm:text-sm font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Subject progress bars */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm mb-8 sm:mb-10">
          <div className="flex items-center gap-4 mb-6 sm:mb-8 pb-5 border-b border-slate-100">
            <div className="h-12 w-12 rounded-xl bg-gsb-green/10 flex items-center justify-center border border-gsb-green/20">
              <TrendingUp className="h-6 w-6 text-gsb-green" />
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-heading font-bold text-slate-900 tracking-tight">Progress per Mata Pelajaran</h3>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 font-medium">{stats.completedCount} dari {stats.totalModules} modul terselesaikan</p>
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(data.groupedModules).map(([subject, subjectModules]) => {
              const colors = subjectColors[subject] || { dot: "bg-gsb-green", badge: "bg-gsb-green/10 text-gsb-green border-gsb-green/20", text: "text-gsb-green" };
              const completed = subjectModules.filter((m) => m.isCompleted).length;
              const total = subjectModules.length;
              const pct = Math.round((completed / total) * 100);
              return (
                <div key={subject}>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-2.5 w-6 rounded-full ${colors.dot}`} />
                      <span className="text-sm sm:text-base font-bold text-slate-800">{subject}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-500">{completed}/{total}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-md border ${colors.badge}`}>{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2.5 sm:h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                    <div className={`h-full ${colors.dot} rounded-full transition-all duration-1000 ease-out`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent scores */}
        {recentScores.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden mb-8 sm:mb-10">
            <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-heading font-bold text-slate-900 flex items-center gap-3 text-base sm:text-lg tracking-tight">
                <RotateCcw className="h-5 w-5 text-gsb-orange" />
                Riwayat Skor Kuis Terakhir
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {recentScores.map((score, i) => (
                <div key={i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 border ${score.passed ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"}`}>
                      {score.passed ? <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6" /> : <XCircle className="h-5 w-5 sm:h-6 sm:w-6" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm sm:text-base font-bold text-slate-800 truncate">{score.moduleTitle}</p>
                      <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{score.subject}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <div className="flex items-baseline justify-end gap-1">
                      <span className={`text-lg sm:text-xl font-heading font-extrabold ${score.passed ? "text-green-600" : "text-red-600"}`}>{score.score}</span>
                      <span className="text-xs text-slate-400">/100</span>
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-widest mt-1 block ${score.passed ? "text-green-600" : "text-red-600"}`}>
                      {score.passed ? "LULUS" : "GAGAL"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { key: "all", label: "Semua Modul" },
            { key: "unlocked", label: "Siap Dipelajari" },
            { key: "completed", label: "Sudah Selesai" },
            { key: "locked", label: "Terkunci" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all active:scale-[0.97] border ${
                filter === tab.key
                  ? "bg-gsb-green text-white border-gsb-green shadow-md"
                  : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Module list */}
        <div className="space-y-6">
          {Object.entries(groupedFiltered).map(([subject, subjectModules]) => {
            const colors = subjectColors[subject] || { dot: "bg-gsb-green", badge: "bg-gsb-green/10 text-gsb-green border-gsb-green/20", text: "text-gsb-green" };
            return (
              <div key={subject} className="bg-white rounded-3xl p-5 border border-slate-200 shadow-sm">
                <h3 className="text-sm sm:text-base font-heading font-bold text-slate-900 mb-4 px-2 flex items-center gap-3">
                  <div className={`h-2 w-4 rounded-full ${colors.dot}`} />
                  {subject}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {subjectModules.map((mod) => (
                    <Link
                      key={mod._id}
                      href={mod.isUnlocked ? `/student/modules/${mod.slug}` : "#"}
                      className={`block bg-white rounded-2xl border transition-all overflow-hidden group ${
                        mod.isCompleted ? "border-green-200 hover:border-green-300 hover:shadow-sm" :
                        mod.isUnlocked ? "border-slate-200 hover:border-slate-300 hover:shadow-md hover:-translate-y-1" :
                        "border-slate-100 bg-slate-50 opacity-70"
                      } ${mod.isUnlocked ? "" : "cursor-default"}`}
                    >
                      <div className={`h-1 w-full ${
                        mod.isCompleted ? "bg-green-500" :
                        mod.isUnlocked ? "bg-slate-300 group-hover:bg-gsb-green transition-colors" : "bg-slate-200"
                      }`} />
                      <div className="flex items-center gap-4 p-4 sm:p-5">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border ${
                          mod.isCompleted ? "bg-green-50 text-green-600 border-green-200" :
                          mod.isUnlocked ? "bg-slate-50 text-slate-500 border-slate-200 group-hover:text-gsb-green group-hover:bg-gsb-green/10 group-hover:border-gsb-green/20 transition-all" : "bg-slate-100 text-slate-400 border-slate-200"
                        }`}>
                          {mod.isCompleted ? <CheckCircle2 className="h-6 w-6" /> :
                           mod.isUnlocked ? <PlayCircle className="h-6 w-6" /> : <Lock className="h-6 w-6" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm sm:text-base font-bold text-slate-800 truncate group-hover:text-gsb-green transition-colors">{mod.title}</p>
                          <p className="text-xs text-slate-500 mt-1 font-medium">Bagian {mod.order}</p>
                        </div>
                        {mod.bestScore !== null && (
                          <span className={`text-xs font-bold px-3 py-1.5 rounded-full shrink-0 border ${
                            mod.bestScore >= 75 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                          }`}>{mod.bestScore}</span>
                        )}
                        {mod.isUnlocked && !mod.isCompleted && (
                          <ArrowRight className="h-5 w-5 text-slate-400 shrink-0 group-hover:text-gsb-green group-hover:translate-x-1 transition-all" />
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}

          {filteredModules.length === 0 && (
            <div className="text-center py-16 sm:py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="h-16 w-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200">
                <BookOpen className="h-8 w-8 text-slate-400" />
              </div>
              <p className="text-base font-heading font-bold text-slate-800 mb-1">
                {filter === "completed" ? "Belum ada modul yang selesai" :
                 filter === "locked" ? "Tidak ada modul terkunci" : "Tidak ada modul yang ditemukan"}
              </p>
              <p className="text-sm text-slate-500">Silakan cek kembali nanti atau ubah filter pencarian.</p>
            </div>
          )}
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}
