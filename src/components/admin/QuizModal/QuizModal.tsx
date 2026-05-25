"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardList,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  HelpCircle,
} from "lucide-react";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import {
  Section,
  Field,
  Input,
  Textarea,
  Button,
  ErrorBox,
} from "@/components/admin/ui/FormField";
import styles from "./QuizModal.module.css";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}

interface Quiz {
  _id?: string;
  moduleId?: string;
  questions: Question[];
  passingScore?: number;
}

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  module: {
    _id: string;
    title: string;
    slug: string;
  } | null;
}

const EMPTY_QUESTION: Question = {
  question: "",
  options: ["", "", "", ""],
  correctAnswer: 0,
  explanation: "",
};

export default function QuizModal({
  isOpen,
  onClose,
  onSuccess,
  module,
}: QuizModalProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [passingScore, setPassingScore] = useState(75);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchQuiz = useCallback(async () => {
    if (!module?._id) return;
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/quiz/${module._id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.quiz) {
          // Pastikan setiap question punya 4 options & explanation field
          const normalized: Question[] = (data.quiz.questions || []).map(
            (q: Partial<Question>) => ({
              question: q.question || "",
              options: [
                ...(q.options || []),
                ...Array(Math.max(0, 4 - (q.options?.length || 0))).fill(""),
              ].slice(0, 4),
              correctAnswer:
                typeof q.correctAnswer === "number" ? q.correctAnswer : 0,
              explanation: q.explanation || "",
            })
          );
          setQuestions(
            normalized.length > 0 ? normalized : [{ ...EMPTY_QUESTION }]
          );
          setPassingScore(data.quiz.passingScore ?? 75);
        } else {
          setQuestions([{ ...EMPTY_QUESTION }]);
        }
      } else if (res.status === 404) {
        setQuestions([{ ...EMPTY_QUESTION }]);
      } else {
        setError("Gagal memuat kuis.");
      }
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    if (isOpen && module?._id) {
      fetchQuiz();
    }
  }, [isOpen, module, fetchQuiz]);

  const updateQuestion = (idx: number, patch: Partial<Question>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === idx ? { ...q, ...patch } : q))
    );
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIdx) return q;
        const opts = [...q.options];
        opts[oIdx] = value;
        return { ...q, options: opts };
      })
    );
  };

  const addQuestion = () => {
    setQuestions((prev) => [...prev, { ...EMPTY_QUESTION, options: ["", "", "", ""] }]);
  };

  const removeQuestion = (idx: number) => {
    setQuestions((prev) =>
      prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)
    );
  };

  const validate = (): string | null => {
    if (questions.length === 0) return "Tambahkan minimal 1 pertanyaan.";
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) return `Pertanyaan #${i + 1} masih kosong.`;
      const filled = q.options.filter((o) => o.trim()).length;
      if (filled < 2) return `Pertanyaan #${i + 1} butuh minimal 2 opsi.`;
      if (!q.options[q.correctAnswer]?.trim())
        return `Pertanyaan #${i + 1}: jawaban benar menunjuk opsi kosong.`;
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!module?._id) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // Buang option kosong di akhir array supaya bersih di DB
      const cleaned = questions.map((q) => ({
        ...q,
        options: q.options.filter((o) => o.trim()),
        correctAnswer: q.correctAnswer,
      }));

      const res = await fetch(`/api/admin/quiz/${module._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: cleaned, passingScore }),
      });
      const data = await res.json();

      if (res.ok) {
        setSuccessMsg(
          `Kuis berhasil disimpan (${cleaned.length} pertanyaan).`
        );
        if (onSuccess) onSuccess();
      } else {
        setError(data.error || "Gagal menyimpan kuis.");
      }
    } catch {
      setError("Terjadi kesalahan koneksi.");
    } finally {
      setSaving(false);
    }
  };

  if (!module) return null;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={`Kuis: ${module.title}`}
      subtitle="Susun pertanyaan pilihan ganda untuk siswa"
      icon={ClipboardList}
      size="lg"
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="cancel" onClick={onClose}>
            Tutup
          </Button>
          <Button type="submit" disabled={saving || loading}>
            {saving ? (
              "Menyimpan..."
            ) : (
              <>
                <Save size={16} />
                Simpan Kuis
              </>
            )}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}
      {successMsg && (
        <div className={styles.successBox}>
          <CheckCircle2 size={18} />
          <span>{successMsg}</span>
        </div>
      )}

      {loading ? (
        <div className={styles.loadingState}>Memuat kuis…</div>
      ) : (
        <>
          <Section title="Pengaturan">
            <Field label="Nilai Kelulusan (Passing Score)" hint="Skala 0–100">
              <Input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) =>
                  setPassingScore(parseInt(e.target.value) || 0)
                }
              />
            </Field>
          </Section>

          {questions.map((q, qIdx) => (
            <Section
              key={qIdx}
              title={`Pertanyaan ${qIdx + 1}`}
              description={
                questions.length > 1
                  ? "Klik ikon hapus di kanan atas untuk menghilangkan pertanyaan ini"
                  : undefined
              }
            >
              <div className={styles.questionHeader}>
                <span className={styles.questionBadge}>
                  <HelpCircle size={14} />
                  Soal #{qIdx + 1}
                </span>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => removeQuestion(qIdx)}
                    aria-label="Hapus pertanyaan"
                  >
                    <Trash2 size={14} />
                    Hapus
                  </button>
                )}
              </div>

              <Field label="Pertanyaan" required>
                <Textarea
                  placeholder="Tulis pertanyaan di sini…"
                  value={q.question}
                  onChange={(e) =>
                    updateQuestion(qIdx, { question: e.target.value })
                  }
                  rows={2}
                  required
                />
              </Field>

              <div>
                <label className={styles.optionsLabel}>
                  Pilihan Jawaban — klik radio untuk tandai jawaban benar
                </label>
                <div className={styles.optionsList}>
                  {q.options.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className={`${styles.optionRow} ${
                        q.correctAnswer === oIdx ? styles.optionCorrect : ""
                      }`}
                    >
                      <label className={styles.radioLabel}>
                        <input
                          type="radio"
                          name={`q-${qIdx}-correct`}
                          checked={q.correctAnswer === oIdx}
                          onChange={() =>
                            updateQuestion(qIdx, { correctAnswer: oIdx })
                          }
                          className={styles.radio}
                        />
                        <span className={styles.optionLetter}>
                          {String.fromCharCode(65 + oIdx)}
                        </span>
                      </label>
                      <input
                        type="text"
                        placeholder={`Opsi ${String.fromCharCode(65 + oIdx)}`}
                        value={opt}
                        onChange={(e) =>
                          updateOption(qIdx, oIdx, e.target.value)
                        }
                        className={styles.optionInput}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <Field
                label="Penjelasan (opsional)"
                hint="Ditampilkan setelah siswa menjawab"
              >
                <Textarea
                  placeholder="Kenapa jawabannya begini?"
                  value={q.explanation || ""}
                  onChange={(e) =>
                    updateQuestion(qIdx, { explanation: e.target.value })
                  }
                  rows={2}
                />
              </Field>
            </Section>
          ))}

          <button
            type="button"
            className={styles.addQuestionBtn}
            onClick={addQuestion}
          >
            <Plus size={18} />
            Tambah Pertanyaan
          </button>
        </>
      )}
    </AdminModal>
  );
}
