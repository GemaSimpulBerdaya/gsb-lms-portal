"use client";

import { useEffect, useState } from "react";
import type { ElementType } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  FileText,
  PlayCircle,
  CheckCircle2,
  Lock,
  Clock,
  BookOpen,
  ChevronRight,
  Loader2,
  Target,
  Calculator,
  Languages,
  Library,
  BarChart3,
} from "lucide-react";
import ModuleContentViewer from "@/components/student/ModuleContentViewer";

interface ModuleData {
  _id: string;
  title: string;
  subject: string;
  slug: string;
  description?: string;
  order: number;
  fileUrl?: string;
  isUnlocked: boolean;
  isCompleted: boolean;
}

interface QuizData {
  quizAvailable: boolean;
  previousAttempt: {
    score: number;
    passed: boolean;
    questionsAnswered: number;
  } | null;
  totalQuestions: number;
  passingScore: number;
}

const subjectColors: Record<string, { bg: string; text: string; light: string; border: string; icon: ElementType }> = {
  "Penalaran Matematika": { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200", icon: Calculator },
  "Matematika": { bg: "bg-blue-600", text: "text-blue-600", light: "bg-blue-50", border: "border-blue-200", icon: Calculator },
  "Bahasa Indonesia": { bg: "bg-gsb-orange", text: "text-gsb-maroon", light: "bg-gsb-orange/10", border: "border-gsb-orange/20", icon: Library },
  "Bahasa Inggris": { bg: "bg-purple-600", text: "text-purple-600", light: "bg-purple-50", border: "border-purple-200", icon: Languages },
  "Pengetahuan Kuantitatif": { bg: "bg-gsb-orange", text: "text-gsb-orange", light: "bg-gsb-orange/10", border: "border-gsb-orange/20", icon: BarChart3 },
};

export default function ModuleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [module, setModule] = useState<ModuleData | null>(null);
  const [quiz, setQuiz] = useState<QuizData | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const progressRes = await fetch("/api/student/progress");
        if (!progressRes.ok) throw new Error("Failed to fetch progress");
        const progressData = await progressRes.json();

        const allModules: ModuleData[] = Object.values(
          progressData.groupedModules as Record<string, ModuleData[]>
        ).flat();

        const decodedSlug = decodeURIComponent(slug);
        const found = allModules.find((m) => m.slug === decodedSlug);
        if (!found) throw new Error("Module not found");

        setModule(found);

        const quizRes = await fetch(`/api/student/quiz?moduleId=${found._id}`);
        if (quizRes.ok) {
          const quizData = await quizRes.json();
          setQuiz({
            quizAvailable: true,
            previousAttempt: quizData.previousAttempt || null,
            totalQuestions: quizData.totalQuestions || 0,
            passingScore: quizData.passingScore || 75,
          });
        } else {
          setQuiz({
            quizAvailable: false,
            previousAttempt: null,
            totalQuestions: 0,
            passingScore: 75,
          });
        }
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [slug]);

  useEffect(() => {
    if (!loading && (error || !module)) {
      router.replace("/student/dashboard");
    }
  }, [loading, error, module, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-10 w-10 text-gsb-maroon animate-spin mx-auto mb-4" />
          <p className="text-sm font-medium text-slate-500">Memuat modul...</p>
        </div>
      </div>
    );
  }

  if (error || !module) {
    return null;
  }

  const colors = subjectColors[module.subject] || {
    bg: "bg-gsb-orange",
    text: "text-gsb-maroon",
    light: "bg-gsb-orange/10",
    border: "border-gsb-orange/20",
    icon: BookOpen,
  };
  const SubjectIcon = colors.icon;

  return (
    <div className="min-h-screen bg-transparent text-slate-800">
      {/* ===== TOP NAV ===== */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link
            href="/student/dashboard"
            className="flex items-center justify-center h-10 w-10 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all shrink-0 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-gsb-maroon uppercase tracking-widest">{module.subject}</p>
            <p className="text-sm font-heading font-bold text-slate-900 truncate mt-0.5">{module.title}</p>
          </div>
          <div className="hidden sm:flex gap-1.5 items-center text-xs text-slate-500">
            <Link href="/student/dashboard" className="hover:text-gsb-maroon transition-colors font-medium">Dashboard</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-slate-700 font-semibold truncate max-w-37.5">{module.title}</span>
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* ===== HERO SECTION ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-5 relative overflow-hidden">
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className={`h-12 w-12 sm:h-14 sm:w-14 rounded-xl flex items-center justify-center shadow-sm shrink-0 border ${
              module.isCompleted ? "bg-green-50 border-green-200 text-green-600" : module.isUnlocked ? `${colors.light} ${colors.border}` : "bg-slate-50 border-slate-200"
            }`}>
              {module.isCompleted ? <CheckCircle2 className="h-6 w-6 sm:h-7 sm:w-7 text-green-600" /> : <SubjectIcon className={`h-6 w-6 sm:h-7 sm:w-7 ${colors.text}`} />}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md ${colors.bg} text-white`}>
                  {module.subject}
                </span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest bg-slate-50 px-2 py-1 rounded-md border border-slate-200">Bagian {module.order}</span>
              </div>
              <h1 className="text-lg sm:text-xl font-heading font-extrabold text-slate-900 leading-snug">
                {module.title}
              </h1>
              <p className="text-sm text-slate-600 mt-1.5 leading-relaxed max-w-3xl">
                {module.description || "Pelajari materi berikut dengan seksama untuk persiapan SNBT dan capai target nilai maksimalmu."}
              </p>
            </div>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2 mt-4">
            {module.isCompleted && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-200">
                <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
              </span>
            )}
            {!module.isUnlocked && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-xs font-bold border border-slate-200">
                <Lock className="h-3.5 w-3.5" /> Belum Terbuka
              </span>
            )}
            {quiz && quiz.quizAvailable && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold border border-blue-200">
                <FileText className="h-3.5 w-3.5" /> {quiz.totalQuestions} Soal • Batas Lulus {quiz.passingScore}
              </span>
            )}
            {quiz && quiz.previousAttempt && !module.isCompleted && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-xs font-bold border border-amber-200">
                <Clock className="h-3.5 w-3.5" /> Skor: {quiz.previousAttempt.score}
              </span>
            )}
          </div>
        </div>

        {/* ===== MATERI SECTION ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-5">
          <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg ${colors.bg} flex items-center justify-center shadow-sm`}>
                <BookOpen className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <h2 className="text-base font-heading font-bold text-slate-900 tracking-tight">Materi Pembelajaran</h2>
                <p className="text-xs text-slate-500 font-medium">
                  Pelajari materi dengan seksama sebelum mengerjakan kuis evaluasi.
                </p>
              </div>
            </div>
          </div>

          <div className="p-1 sm:p-3">
            <ModuleContentViewer fileUrl={module.fileUrl} title={module.title} />
          </div>
        </div>

        {/* ===== QUIZ SECTION ===== */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 mb-5 relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-gsb-orange flex items-center justify-center shrink-0 shadow-sm">
                <PlayCircle className="h-5 w-5 sm:h-5.5 sm:w-5.5 text-white" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-heading font-bold text-slate-900 tracking-tight">Kuis Pemahaman</h2>
                <p className="text-sm text-slate-500 mt-0.5 leading-relaxed max-w-md font-medium">
                  {quiz && quiz.quizAvailable
                    ? `Uji pemahamanmu dengan ${quiz.totalQuestions} soal. Nilai minimal untuk lulus adalah ${quiz.passingScore}.`
                    : "Kuis belum tersedia untuk modul ini."}
                </p>
              </div>
            </div>

            <div className="shrink-0 w-full sm:w-auto">
              {module.isUnlocked && quiz && quiz.quizAvailable ? (
                <Link
                  href={`/student/quiz/${module._id}`}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-gsb-orange text-white rounded-xl font-bold text-sm hover:bg-gsb-orange/90 shadow-sm transition-all active:scale-[0.97]"
                >
                  <PlayCircle className="h-4 w-4" />
                  {quiz.previousAttempt && !module.isCompleted ? "Coba Lagi Ujian" : "Mulai Kuis Sekarang"}
                </Link>
              ) : (
                <button
                  disabled
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 text-slate-400 border border-slate-200 rounded-xl font-bold text-sm cursor-not-allowed"
                >
                  <Lock className="h-4 w-4" />
                  {module.isUnlocked ? "Kuis Belum Tersedia" : "Kuis Terkunci"}
                </button>
              )}
            </div>
          </div>

          {/* Previous attempt */}
          {quiz && quiz.previousAttempt && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Riwayat Percobaan Terakhir</p>
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-200">
                    <Target className="h-4 w-4 text-slate-400" />
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-heading font-extrabold ${quiz.previousAttempt.passed ? "text-green-600" : "text-red-600"}`}>
                      {quiz.previousAttempt.score}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">/ 100</span>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold w-fit ${
                  quiz.previousAttempt.passed
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}>
                  {quiz.previousAttempt.passed ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
                  {quiz.previousAttempt.passed ? "LULUS" : "BELUM LULUS"}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}
