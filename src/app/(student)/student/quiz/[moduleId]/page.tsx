"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Target,
  BookOpen,
  FileText,
  Award
} from "lucide-react";

interface Question {
  _id: string;
  question: string;
  options: string[];
}

interface QuizData {
  quizId: string;
  moduleId: string;
  questions: Question[];
  totalQuestions: number;
  passingScore: number;
  previousAttempt: { score: number; passed: boolean; attemptedAt: string } | null;
}

interface ResultDetail {
  questionId: string;
  question: string;
  options: string[];
  correctAnswer: number;
  selectedAnswer: number | null;
  isCorrect: boolean;
  explanation: string | null;
}

interface QuizResult {
  score: number;
  passed: boolean;
  passingScore: number;
  totalQuestions: number;
  correctCount: number;
  results: ResultDetail[];
  message: string;
}

export default function QuizPage() {
  const params = useParams();
  const router = useRouter();
  const moduleId = params.moduleId as string;

  const [quiz, setQuiz] = useState<QuizData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<QuizResult | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const dotsRef = useRef<HTMLDivElement>(null);
  const submitRef = useRef<() => void>(() => {});

  // Fetch quiz
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/student/quiz?moduleId=${moduleId}`);
        if (!res.ok) {
          const err = await res.json();
          setError(err.error || "Gagal memuat kuis");
          return;
        }
        const data = await res.json();
        setQuiz(data);
        setTimeLeft(data.totalQuestions * 60);
      } catch {
        setError("Gagal memuat kuis. Coba refresh.");
      } finally {
        setLoading(false);
      }
    })();
  }, [moduleId]);

  // Timer countdown
  useEffect(() => {
    if (!started || submitting || result || timeLeft === null || timeLeft <= 0) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [started, submitting, result, timeLeft]);

  // Keep submit ref current
  useEffect(() => {
    submitRef.current = handleSubmit;
  });

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeLeft === 0 && started && !result && !submitting) {
      submitRef.current();
    }
  }, [timeLeft, started, result, submitting]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const pickAnswer = (questionId: string, optionIndex: number) => {
    if (result) return;
    setAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const goToQuestion = (idx: number) => {
    if (result) return;
    setCurrentQ(idx);
    dotsRef.current?.children[idx]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  async function handleSubmit() {
    if (submitting || !quiz) return;
    setSubmitting(true);

    try {
      const answerArray = Object.entries(answers).map(([qId, sel]) => ({
        questionId: qId,
        selectedAnswer: sel,
      }));

      const res = await fetch("/api/student/quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, answers: answerArray }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal submit kuis");
        setSubmitting(false);
        return;
      }

      setResult(data);
      setShowResults(true);
    } catch {
      setError("Gagal mengirim jawaban. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  const answeredCount = Object.keys(answers).length;

  // ===== LOADING =====
  if (loading) {
    return (
      <div className="min-h-screen bg-gsb-sand/50 text-slate-800 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="h-12 w-12 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-200 shadow-sm">
            <Loader2 className="h-6 w-6 text-gsb-maroon animate-spin" />
          </div>
          <p className="text-sm text-slate-500 font-medium">Mempersiapkan Kuis...</p>
        </div>
      </div>
    );
  }

  // ===== ERROR =====
  if (error) {
    return (
      <div className="min-h-screen bg-gsb-sand/50 text-slate-800 flex items-center justify-center px-4">
        <div className="text-center max-w-sm mx-auto bg-white p-6 rounded-2xl border border-red-100 shadow-sm">
          <div className="h-14 w-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
            <AlertTriangle className="h-7 w-7 text-red-500" />
          </div>
          <p className="text-lg font-heading font-bold text-slate-900 mb-1">Oops!</p>
          <p className="text-sm text-slate-500 mb-6 font-medium">{error}</p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="inline-flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-[0.97]"
          >
            <ArrowLeft className="h-4 w-4" /> Kembali ke Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-gsb-sand/50 flex items-center justify-center px-4">
        <div className="text-center">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">Kuis tidak ditemukan</p>
          <button onClick={() => router.push("/student/dashboard")} className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50">
            Kembali
          </button>
        </div>
      </div>
    );
  }

  // ===== INTRO =====
  if (!started) {
    return (
      <div className="min-h-screen bg-gsb-sand/50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 relative overflow-hidden">
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-gsb-orange/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center gap-4 mb-5 relative z-10">
              <div className="h-12 w-12 bg-gsb-orange rounded-xl flex items-center justify-center shadow-sm shrink-0">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-heading font-bold text-slate-900">Kuis Pemahaman</h1>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">Uji pemahaman materi modul ini.</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mb-5 relative z-10">
              <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-3 text-center">
                <p className="text-lg font-heading font-bold text-slate-900 leading-none">{quiz.totalQuestions}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Soal</p>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 px-3 py-3 text-center">
                <p className="text-lg font-heading font-bold text-slate-900 leading-none">{quiz.totalQuestions}<span className="text-xs font-semibold text-slate-400 ml-0.5">mnt</span></p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Waktu</p>
              </div>
              <div className="bg-green-50 rounded-xl border border-green-200 px-3 py-3 text-center">
                <p className="text-lg font-heading font-bold text-green-700 leading-none">{quiz.passingScore}</p>
                <p className="text-[10px] font-bold text-green-600/70 uppercase tracking-wider mt-1.5">Batas Lulus</p>
              </div>
            </div>

            {quiz.previousAttempt && (
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 mb-5 relative z-10">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Target className="h-3.5 w-3.5" /> Percobaan Terakhir
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-sm font-heading font-bold text-slate-900">{quiz.previousAttempt.score}</span>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-md border ${
                    quiz.previousAttempt.passed ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {quiz.previousAttempt.passed ? "LULUS" : "BELUM LULUS"}
                  </span>
                </span>
              </div>
            )}

            <div className="flex gap-2.5 relative z-10">
              <button onClick={() => router.push(`/student/modules/${quiz.moduleId}`)} className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.97]">
                Batal
              </button>
              <button onClick={() => setStarted(true)} className="flex-[2] px-4 py-2.5 bg-gsb-orange text-white rounded-xl font-bold text-sm hover:bg-gsb-orange/90 shadow-sm transition-all active:scale-[0.97]">
                Mulai Kuis
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== RESULTS =====
  if (result && showResults) {
    return (
      <div className="min-h-screen bg-gsb-sand/50 text-slate-800">
        <div className="px-4 sm:px-6 py-5 sm:py-8 max-w-3xl mx-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8 text-center mb-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-1.5 ${result.passed ? "bg-green-500" : "bg-red-500"}`} />

            <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto mb-4 border-4 ${
              result.passed ? "bg-green-50 border-green-200 text-green-600" : "bg-red-50 border-red-200 text-red-600"
            }`}>
              {result.passed ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
            </div>
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 mb-1.5">
              {result.passed ? "Selamat! Kamu Lulus 🎉" : "Jangan Menyerah! 💪"}
            </h1>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto font-medium leading-relaxed">{result.message}</p>

            <div className="grid grid-cols-3 gap-2.5 sm:gap-4 mb-6 max-w-md mx-auto">
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-4 text-center">
                <div className={`text-2xl sm:text-3xl font-heading font-extrabold leading-none ${result.passed ? "text-green-600" : "text-red-600"}`}>{result.score}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Skor Kamu</div>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-4 text-center">
                <div className="text-2xl sm:text-3xl font-heading font-bold text-slate-700 leading-none">{result.passingScore}</div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Batas Lulus</div>
              </div>
              <div className="bg-slate-50 rounded-xl border border-slate-200 py-4 text-center">
                <div className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 leading-none">{result.correctCount}<span className="text-base text-slate-400">/{result.totalQuestions}</span></div>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-2">Benar</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center">
              {!result.passed && (
                <button onClick={() => { setStarted(false); setResult(null); setShowResults(false); setAnswers({}); setCurrentQ(0); setTimeLeft(quiz.totalQuestions * 60); }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-gsb-orange text-white rounded-xl font-bold text-sm hover:bg-gsb-orange/90 shadow-sm transition-all active:scale-[0.97]">
                  Ulangi Kuis
                </button>
              )}
              <button onClick={() => router.push(`/student/modules/${quiz.moduleId}`)} className="w-full sm:w-auto px-6 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.97]">
                Kembali ke Modul
              </button>
            </div>
          </div>

          <h2 className="text-base font-heading font-bold text-slate-900 mb-4 px-1 flex items-center gap-2">
            <Award className="h-4 w-4 text-gsb-orange" /> Pembahasan Soal
          </h2>
          <div className="space-y-3.5">
            {result.results.map((r, idx) => (
              <div key={r.questionId} className={`bg-white rounded-2xl border shadow-sm p-4 sm:p-5 ${
                r.isCorrect ? "border-green-200" : "border-red-200"
              }`}>
                <div className="flex items-start gap-3">
                  <div className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
                    r.isCorrect ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"
                  }`}>
                    {r.isCorrect ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm sm:text-base font-bold text-slate-900 mb-3.5 leading-relaxed"><span className="text-slate-400 mr-1.5">{idx + 1}.</span> {r.question}</p>
                    <div className="space-y-2">
                      {r.options.map((opt, oi) => {
                        const isCorrectOpt = oi === r.correctAnswer;
                        const isSelectedOpt = oi === r.selectedAnswer;
                        const isWrongSelected = isSelectedOpt && !isCorrectOpt;

                        return (
                          <div key={oi} className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm border ${
                            isCorrectOpt ? "bg-green-50 text-green-800 border-green-300" :
                            isWrongSelected ? "bg-red-50 text-red-800 border-red-200" :
                            "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            <span className={`h-6 w-6 rounded-md flex items-center justify-center text-[11px] font-bold shrink-0 border ${
                              isCorrectOpt ? "bg-green-600 text-white border-green-700" :
                              isWrongSelected ? "bg-red-500 text-white border-red-600" :
                              "bg-white text-slate-500 border-slate-300"
                            }`}>{String.fromCharCode(65 + oi)}</span>
                            <span className="leading-relaxed font-medium">{opt}</span>
                            {isCorrectOpt && <CheckCircle2 className="h-4 w-4 text-green-600 ml-auto shrink-0" />}
                            {isWrongSelected && <XCircle className="h-4 w-4 text-red-500 ml-auto shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                    {r.explanation && (
                      <div className="mt-3.5 p-3.5 bg-blue-50 border border-blue-100 rounded-xl relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                        <p className="text-[10px] font-bold text-blue-600 mb-1.5 uppercase tracking-widest flex items-center gap-1.5">
                          <BookOpen className="h-3.5 w-3.5" /> Pembahasan
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed">{r.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-10" />
        </div>
      </div>
    );
  }

  // ===== ACTIVE QUIZ =====
  const question = quiz.questions[currentQ];
  const isLast = currentQ === quiz.questions.length - 1;
  const progress = ((currentQ + 1) / quiz.questions.length) * 100;
  const timeWarning = timeLeft !== null && timeLeft <= 60;

  return (
    <div className="min-h-screen bg-gsb-sand/50 flex flex-col font-sans">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 z-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2.5">
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-3 min-w-0">
              <button onClick={() => router.push(`/student/modules/${quiz.moduleId}`)} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 border border-slate-200 transition-all active:scale-95 shrink-0">
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-heading font-bold text-slate-900 truncate">Soal {currentQ + 1} <span className="text-slate-400 font-semibold">/ {quiz.questions.length}</span></p>
                <p className="text-[11px] font-semibold text-slate-400">{answeredCount} terjawab</p>
              </div>
            </div>

            {timeLeft !== null && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold tabular-nums border shrink-0 ${
                timeWarning ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-slate-50 text-slate-700 border-slate-200"
              }`}>
                <Clock className={`h-4 w-4 ${timeWarning ? "text-red-500" : "text-gsb-orange"}`} />
                {formatTime(timeLeft)}
              </div>
            )}
          </div>

          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gsb-orange rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mb-5 leading-relaxed">
            <span className="inline-flex h-6 min-w-6 px-1 mr-2 rounded-md bg-gsb-orange/10 text-gsb-maroon border border-gsb-orange/20 items-center justify-center text-xs font-heading font-bold align-middle -translate-y-px">{currentQ + 1}</span>
            {question.question}
          </h2>

          <div className="space-y-2.5">
            {question.options.map((option, idx) => {
              const isSelected = answers[question._id] === idx;
              const letter = String.fromCharCode(65 + idx);
              return (
                <button key={idx} onClick={() => pickAnswer(question._id, idx)}
                  className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border text-left transition-all duration-150 active:scale-[0.99] group ${
                    isSelected ? "border-gsb-orange bg-gsb-orange/5 ring-1 ring-gsb-orange" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}>
                  <span className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-all border ${
                    isSelected ? "bg-gsb-orange text-white border-gsb-orange" : "bg-slate-50 text-slate-500 border-slate-200 group-hover:bg-slate-100"
                  }`}>{letter}</span>
                  <span className={`text-sm leading-relaxed ${isSelected ? "font-bold text-slate-900" : "font-medium text-slate-600"}`}>{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation + question map in one compact bar */}
        <div className="mt-4 bg-white rounded-2xl border border-slate-200 shadow-sm p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-3">
            <button onClick={() => setCurrentQ((p) => Math.max(0, p - 1))} disabled={currentQ === 0}
              className="px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 active:scale-[0.97] shrink-0">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Sebelumnya</span>
            </button>

            <div ref={dotsRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide snap-x px-1 py-1 flex-1 justify-start sm:justify-center">
              {quiz.questions.map((q, idx) => (
                <button key={q._id} onClick={() => goToQuestion(idx)}
                  className={`snap-start h-8 w-8 rounded-lg text-xs font-bold shrink-0 transition-all border ${
                    idx === currentQ ? "bg-gsb-orange text-white border-gsb-orange shadow-sm" :
                    answers[q._id] !== undefined ? "bg-green-50 text-green-700 border-green-200" :
                    "bg-white text-slate-400 hover:bg-slate-50 border-slate-200"
                  }`}>
                  {idx + 1}
                </button>
              ))}
            </div>

            {isLast ? (
              <button onClick={handleSubmit} disabled={submitting}
                className="px-4 py-2.5 bg-gsb-orange text-white rounded-xl font-bold text-sm hover:bg-gsb-orange/90 shadow-sm disabled:opacity-50 transition-all flex items-center gap-1.5 active:scale-[0.97] shrink-0">
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /><span className="hidden sm:inline">Mengirim...</span></> : <><CheckCircle2 className="h-4 w-4" /><span className="hidden sm:inline">Kumpulkan</span><span className="sm:hidden">Selesai</span></>}
              </button>
            ) : (
              <button onClick={() => setCurrentQ((p) => Math.min(quiz.questions.length - 1, p + 1))}
                className="px-3.5 py-2.5 bg-gsb-orange/10 border border-gsb-orange/20 text-gsb-maroon rounded-xl text-sm font-bold hover:bg-gsb-orange/20 transition-all flex items-center gap-1.5 active:scale-[0.97] shrink-0">
                <span className="hidden sm:inline">Selanjutnya</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Submit early hint */}
        {!isLast && answeredCount === quiz.questions.length && (
          <div className="mt-3 flex items-center justify-center">
            <button onClick={handleSubmit} disabled={submitting}
              className="px-5 py-2.5 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 shadow-sm disabled:opacity-50 transition-all flex items-center gap-2 active:scale-[0.97]">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Semua terjawab — Kumpulkan Sekarang
            </button>
          </div>
        )}

        <div className="h-10" />
      </div>
    </div>
  );
}
