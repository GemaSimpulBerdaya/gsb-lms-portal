"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./QuizModal.module.css";

interface Question {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

interface Quiz {
  _id: string;
  moduleId: string;
  questions: Question[];
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

export default function QuizModal({ isOpen, onClose, onSuccess, module }: QuizModalProps) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const fetchQuiz = useCallback(async () => {
    if (!module?._id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quiz?moduleId=${module._id}`);
      if (res.ok) {
        const data = await res.json();
        setQuiz(data.quiz);
      } else if (res.status === 404) {
        setQuiz(null);
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
      const timer = setTimeout(() => {
        fetchQuiz();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, module, fetchQuiz]);

  const generateQuiz = async () => {
    if (!module?._id) return;
    setIsGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId: module._id }),
      });
      const data = await res.json();
      if (res.ok) {
        setQuiz(data.quiz);
        if (onSuccess) onSuccess();
      } else {
        setError(data.error || "Gagal membuat kuis.");
      }
    } catch {
      setError("Gagal menghubungi AI.");
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen || !module) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Kuis AI: {module.title}</h2>
            <p className={styles.subtitle}>Pratinjau kuis yang akan tampil untuk siswa.</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.state}>Memuat kuis...</div>
          ) : error ? (
            <div className={`${styles.state} ${styles.error}`}>{error}</div>
          ) : !quiz ? (
            <div className={styles.empty}>
              <p>Belum ada kuis untuk modul ini.</p>
              <button 
                className={styles.generateBtn} 
                onClick={generateQuiz}
                disabled={isGenerating}
              >
                {isGenerating ? "Sedang Membuat..." : "✨ Buat Kuis dengan AI"}
              </button>
            </div>
          ) : (
            <div className={styles.quizContent}>
              <div className={styles.quizInfo}>
                <span>{quiz.questions.length} Pertanyaan</span>
                <button 
                  className={styles.regenerateBtn} 
                  onClick={generateQuiz}
                  disabled={isGenerating}
                >
                  {isGenerating ? "Memproses..." : "Regenerasi AI"}
                </button>
              </div>

              {quiz.questions.map((q, i) => (
                <div key={i} className={styles.questionCard}>
                  <p className={styles.questionText}>
                    <strong>{i + 1}.</strong> {q.question}
                  </p>
                  <div className={styles.optionsGrid}>
                    {q.options.map((opt, j) => (
                      <div 
                        key={j} 
                        className={`${styles.option} ${opt === q.answer ? styles.correct : ""}`}
                      >
                        {String.fromCharCode(65 + j)}. {opt}
                      </div>
                    ))}
                  </div>
                  {q.explanation && (
                    <p className={styles.explanation}>
                      <strong>Penjelasan:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}
