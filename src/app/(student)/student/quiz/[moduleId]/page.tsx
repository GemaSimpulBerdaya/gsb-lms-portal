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
  BookOpen
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
          <div className="h-16 w-16 bg-white rounded-3xl flex items-center justify-center mx-auto mb-5 border border-slate-200 shadow-sm">
            <Loader2 className="h-8 w-8 text-gsb-maroon animate-spin" />
          </div>
          <p className="text-sm sm:text-base text-slate-500 font-medium">Mempersiapkan Kuis...</p>
        </div>
      </div>
    );
  }

  // ===== ERROR =====
  if (error) {
    return (
      <div className="min-h-screen bg-gsb-sand/50 text-slate-800 flex items-center justify-center px-4">
        <div className="text-center max-w-md mx-auto bg-white p-8 rounded-3xl border border-red-100 shadow-sm">
          <div className="h-20 w-20 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-5 border border-red-100">
            <AlertTriangle className="h-10 w-10 text-red-500" />
          </div>
          <p className="text-xl font-heading font-bold text-slate-900 mb-2">Oops!</p>
          <p className="text-sm text-slate-500 mb-8 font-medium">{error}</p>
          <button
            onClick={() => router.push("/student/dashboard")}
            className="inline-flex items-center justify-center gap-2 w-full px-5 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all active:scale-[0.97]"
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
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Kuis tidak ditemukan</p>
          <button onClick={() => router.push("/student/dashboard")} className="mt-6 inline-flex items-center gap-2 px-6 py-3 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-sm shadow-sm hover:bg-slate-50">
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
        <div className="max-w-lg w-full">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 text-center relative overflow-hidden">
            <div className="absolute -top-32 -right-32 w-64 h-64 bg-gsb-orange/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="h-20 w-20 sm:h-24 sm:w-24 bg-gsb-orange rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-sm">
              <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-white" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 mb-2">Kuis Pemahaman</h1>
            <p className="text-sm sm:text-base text-slate-500 mb-8 font-medium">Uji pemahaman materi yang telah kamu pelajari di modul ini.</p>

            <div className="bg-slate-50 rounded-2xl p-5 mb-8 text-left space-y-4 border border-slate-200 relative z-10">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Jumlah Soal</span>
                <span className="text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">{quiz.totalQuestions} Soal</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Waktu Maksimal</span>
                <span className="text-sm font-bold text-slate-900 bg-white px-3 py-1 rounded-lg border border-slate-200 shadow-sm">{quiz.totalQuestions} Menit</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">Batas Lulus</span>
                <span className="text-sm font-bold text-green-700 bg-green-50 px-3 py-1 rounded-lg border border-green-200 shadow-sm">{quiz.passingScore}</span>
              </div>
            </div>

            {quiz.previousAttempt && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-8 text-left relative z-10 shadow-sm">
                <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest flex items-center gap-2">
                  <Target className="h-4 w-4" /> Percobaan Terakhir
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-slate-600">Skor: <span className="font-heading font-bold text-slate-900 ml-1 text-lg">{quiz.previousAttempt.score}</span></span>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    quiz.previousAttempt.passed ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                  }`}>
                    {quiz.previousAttempt.passed ? "LULUS" : "BELUM LULUS"}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center relative z-10">
              <button onClick={() => router.push(`/student/modules/${quiz.moduleId}`)} className="w-full sm:w-auto px-6 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-[0.97] shadow-sm">
                Batal
              </button>
              <button onClick={() => setStarted(true)} className="w-full sm:w-auto px-8 py-3.5 bg-gsb-orange text-white rounded-xl font-bold text-sm hover:bg-gsb-orange/90 shadow-md transition-all active:scale-[0.97]">
                Mulai Ujian Sekarang
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
        <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-10 max-w-4xl mx-auto">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 text-center mb-8 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-full h-2 ${result.passed ? "bg-green-500" : "bg-red-500"}`} />
            
            <div className={`h-24 w-24 sm:h-28 sm:w-28 rounded-full flex items-center justify-center mx-auto mb-6 border-4 shadow-sm ${
              result.passed ? "bg-green-50 border-green-200 text-green-600" : "bg-red-50 border-red-200 text-red-600"
            }`}>
              {result.passed ? <CheckCircle2 className="h-12 w-12 sm:h-14 sm:w-14" /> : <XCircle className="h-12 w-12 sm:h-14 sm:w-14" />}
            </div>
            <h1 className="text-2xl sm:text-4xl font-heading font-extrabold text-slate-900 mb-3">
              {result.passed ? "Selamat! Kamu Lulus 🎉" : "Jangan Menyerah! 💪"}
            </h1>
            <p className="text-sm sm:text-base text-slate-500 mb-8 max-w-md mx-auto font-medium leading-relaxed">{result.message}</p>

            <div className="flex items-center justify-center gap-6 sm:gap-12 mb-10 bg-slate-50 p-6 rounded-2xl border border-slate-200 max-w-2xl mx-auto">
              <div className="text-center">
                <div className={`text-4xl sm:text-5xl font-heading font-extrabold ${result.passed ? "text-green-600" : "text-red-600"}`}>{result.score}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Skor Kamu</div>
              </div>
              <div className="h-12 w-px sm:h-16 bg-slate-200" />
              <div className="text-center">
                <div className="text-2xl sm:text-4xl font-heading font-bold text-slate-700">{result.passingScore}</div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Batas Lulus</div>
              </div>
              <div className="h-12 w-px sm:h-16 bg-slate-200" />
              <div className="text-center">
                <div className="text-2xl sm:text-4xl font-heading font-bold text-slate-900">{result.correctCount}<span className="text-xl sm:text-2xl text-slate-400">/{result.totalQuestions}</span></div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Benar</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {!result.passed && (
                <button onClick={() => { setStarted(false); setResult(null); setShowResults(false); setAnswers({}); setCurrentQ(0); setTimeLeft(quiz.totalQuestions * 60); }}
                  className="w-full sm:w-auto px-8 py-3.5 bg-gsb-orange text-white rounded-xl font-bold text-sm hover:bg-gsb-orange/90 shadow-sm transition-all active:scale-[0.97]">
                  Ulangi Kuis
                </button>
              )}
              <button onClick={() => router.push(`/student/modules/${quiz.moduleId}`)} className="w-full sm:w-auto px-8 py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all active:scale-[0.97] shadow-sm">
                Kembali ke Modul
              </button>
            </div>
          </div>

          <h2 className="text-lg sm:text-xl font-heading font-bold text-slate-900 mb-6 px-2">Pembahasan Soal</h2>
          <div className="space-y-4 sm:space-y-6">
            {result.results.map((r, idx) => (
              <div key={r.questionId} className={`bg-white rounded-3xl border shadow-sm p-5 sm:p-8 ${
                r.isCorrect ? "border-green-200" : "border-red-200"
              }`}>
                <div className="flex items-start gap-4 sm:gap-5">
                  <div className={`h-8 w-8 sm:h-10 sm:w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 border ${
                    r.isCorrect ? "bg-green-50 text-green-600 border-green-200" : "bg-red-50 text-red-600 border-red-200"
                  }`}>
                    {r.isCorrect ? <CheckCircle2 className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-base sm:text-lg font-bold text-slate-900 mb-5 leading-relaxed"><span className="text-slate-400 mr-2">{idx + 1}.</span> {r.question}</p>
                    <div className="space-y-2.5">
                      {r.options.map((opt, oi) => {
                        const isCorrectOpt = oi === r.correctAnswer;
                        const isSelectedOpt = oi === r.selectedAnswer;
                        const isWrongSelected = isSelectedOpt && !isCorrectOpt;
                        
                        return (
                          <div key={oi} className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm sm:text-base transition-colors border ${
                            isCorrectOpt ? "bg-green-50 text-green-800 border-green-300 shadow-sm" :
                            isWrongSelected ? "bg-red-50 text-red-800 border-red-200" :
                            "bg-slate-50 text-slate-600 border-slate-200"
                          }`}>
                            <span className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 border ${
                              isCorrectOpt ? "bg-green-600 text-white border-green-700" :
                              isWrongSelected ? "bg-red-500 text-white border-red-600" :
                              "bg-white text-slate-500 border-slate-300"
                            }`}>{String.fromCharCode(65 + oi)}</span>
                            <span className="leading-relaxed font-medium">{opt}</span>
                            {isCorrectOpt && <CheckCircle2 className="h-5 w-5 text-green-600 ml-auto" />}
                            {isWrongSelected && <XCircle className="h-5 w-5 text-red-500 ml-auto" />}
                          </div>
                        );
                      })}
                    </div>
                    {r.explanation && (
                      <div className="mt-5 p-4 sm:p-5 bg-blue-50 border border-blue-100 rounded-2xl relative overflow-hidden">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />
                        <p className="text-xs font-bold text-blue-600 mb-2 uppercase tracking-widest flex items-center gap-2">
                          <BookOpen className="h-4 w-4" /> Pembahasan
                        </p>
                        <p className="text-sm text-slate-700 leading-relaxed font-medium">{r.explanation}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-12" />
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
      <div className="sticky top-0 bg-white/90 backdrop-blur-md border-b border-slate-200 z-20 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0">
              <button onClick={() => router.push(`/student/modules/${quiz.moduleId}`)} className="p-2 rounded-xl bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 border border-slate-200 shadow-sm transition-all active:scale-[0.95] shrink-0">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
              <div>
                <p className="text-xs font-bold text-gsb-maroon uppercase tracking-widest">
                  Ujian SNBT
                </p>
                <p className="text-sm font-heading font-extrabold text-slate-900 mt-0.5">Soal {currentQ + 1} dari {quiz.questions.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-4 shrink-0">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest hidden sm:inline bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
                {answeredCount}/{quiz.questions.length} Terjawab
              </span>
              {timeLeft !== null && (
                <div className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold tabular-nums border shadow-sm ${
                  timeWarning ? "bg-red-50 text-red-600 border-red-200 animate-pulse" : "bg-white text-slate-700 border-slate-200"
                }`}>
                  <Clock className={`h-4 w-4 sm:h-5 sm:w-5 ${timeWarning ? "text-red-500 animate-pulse" : "text-gsb-orange"}`} />
                  {formatTime(timeLeft)}
                </div>
              )}
            </div>
          </div>

          <div className="h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
            <div className="h-full bg-gsb-orange rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-10">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 mb-8">
          <div className="flex items-center gap-4 mb-6 sm:mb-8 pb-5 border-b border-slate-100">
            <div className="h-10 w-10 sm:h-12 sm:w-12 bg-gsb-orange/10 text-gsb-maroon border border-gsb-orange/20 rounded-xl flex items-center justify-center text-lg sm:text-xl font-heading font-bold">
              {currentQ + 1}
            </div>
            <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">Pertanyaan Ujian</span>
          </div>

          <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 mb-8 sm:mb-10 leading-relaxed tracking-tight">
            {question.question}
          </h2>

          <div className="space-y-3 sm:space-y-4">
            {question.options.map((option, idx) => {
              const isSelected = answers[question._id] === idx;
              const letter = String.fromCharCode(65 + idx);
              return (
                <button key={idx} onClick={() => pickAnswer(question._id, idx)}
                  className={`w-full flex items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 text-left transition-all duration-200 active:scale-[0.99] group ${
                    isSelected ? "border-gsb-orange bg-gsb-orange/5 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}>
                  <span className={`h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 transition-all border ${
                    isSelected ? "bg-gsb-orange text-white border-gsb-orange" : "bg-slate-100 text-slate-500 border-slate-200 group-hover:bg-slate-200"
                  }`}>{letter}</span>
                  <span className={`text-base leading-relaxed ${isSelected ? "font-bold text-slate-900" : "font-medium text-slate-600"}`}>{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 sm:mt-6 bg-white p-4 sm:p-6 rounded-3xl border border-slate-200 shadow-sm">
          <button onClick={() => setCurrentQ((p) => Math.max(0, p - 1))} disabled={currentQ === 0}
            className="px-4 sm:px-6 py-3 sm:py-3.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 shadow-sm active:scale-[0.97]">
            <ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
            <span className="hidden sm:inline">Soal Sebelumnya</span>
            <span className="sm:hidden">Sebelum</span>
          </button>

          <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 sm:hidden">{answeredCount}/{quiz.questions.length}</span>

          {isLast ? (
            <button onClick={handleSubmit} disabled={submitting}
              className="px-5 sm:px-8 py-3 sm:py-3.5 bg-gsb-orange text-white rounded-xl font-bold text-sm hover:bg-gsb-orange/90 shadow-md disabled:opacity-50 transition-all flex items-center gap-2.5 active:scale-[0.97]">
              {submitting ? <><Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> Sedang Mengirim...</> : <><CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" /> Kumpulkan Ujian</>}
            </button>
          ) : (
            <button onClick={() => setCurrentQ((p) => Math.min(quiz.questions.length - 1, p + 1))}
              className="px-5 sm:px-6 py-3 sm:py-3.5 bg-gsb-orange/10 border border-gsb-orange/20 text-gsb-maroon rounded-xl text-sm font-bold hover:bg-gsb-orange/20 transition-all flex items-center gap-2 active:scale-[0.97]">
              <span className="hidden sm:inline">Soal Selanjutnya</span>
              <span className="sm:hidden">Next</span>
              <ChevronRight className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          )}
        </div>

        {/* Scrollable dots */}
        <div className="mt-8 bg-white p-5 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3 text-center sm:text-left ml-2">Navigasi Soal</p>
          <div ref={dotsRef} className="flex gap-2 sm:gap-2.5 overflow-x-auto pb-2 justify-start sm:justify-center scrollbar-hide snap-x snap-mandatory">
            {quiz.questions.map((q, idx) => (
              <button key={q._id} onClick={() => goToQuestion(idx)}
                className={`snap-start h-9 w-9 sm:h-10 sm:w-10 rounded-xl text-xs sm:text-sm font-bold shrink-0 transition-all border ${
                  idx === currentQ ? "bg-gsb-orange text-white border-gsb-orange scale-110 shadow-md" :
                  answers[q._id] !== undefined ? "bg-green-50 text-green-700 border-green-200" :
                  "bg-white text-slate-500 hover:bg-slate-50 border-slate-200"
                }`}>
                {idx + 1}
              </button>
            ))}
          </div>
        </div>

        <div className="h-12" />
      </div>
    </div>
  );
}
