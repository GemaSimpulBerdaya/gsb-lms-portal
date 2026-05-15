"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./QuizModal.module.css";

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

interface ModuleItem {
  _id: string;
  title: string;
}

interface QuizModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  module: ModuleItem;
}

export default function QuizModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  module
}: QuizModalProps) {
  const [questions, setQuestions] = useState<Question[]>([
    { question: "", options: ["", "", "", ""], correctAnswer: 0 }
  ]);
  const [passingScore, setPassingScore] = useState(75);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (isOpen && module?._id) {
      fetchQuiz();
    }
  }, [isOpen, module]);

  const fetchQuiz = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/quiz/${module._id}`);
      const data = await res.json();
      if (data.quiz) {
        setQuestions(data.quiz.questions);
        setPassingScore(data.quiz.passingScore);
      } else {
        setQuestions([{ question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
      }
    } catch {
      setError("Gagal mengambil data kuis");
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAI = async () => {
    setAiLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/quiz/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          fileUrl: (module as any).fileUrl, 
          title: module.title 
        })
      });

      const data = await res.json();
      if (res.ok) {
        setQuestions(data.questions);
      } else {
        setError(data.error || "Gagal generate kuis otomatis");
      }
    } catch {
      setError("Kesalahan koneksi AI");
    } finally {
      setAiLoading(false);
    }
  };

  const addQuestion = () => {
    setQuestions([...questions, { question: "", options: ["", "", "", ""], correctAnswer: 0 }]);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, val: string) => {
    const newQs = [...questions];
    newQs[index].question = val;
    setQuestions(newQs);
  };

  const handleOptionChange = (qIndex: number, oIndex: number, val: string) => {
    const newQs = [...questions];
    newQs[qIndex].options[oIndex] = val;
    setQuestions(newQs);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/quiz/${module._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions, passingScore })
      });

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        const data = await res.json();
        setError(data.error || "Gagal menyimpan kuis");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <div>
            <h2>Manajemen Kuis</h2>
            <p className={styles.subtitle}>Modul: {module.title}</p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.topActions}>
            <div className={styles.passingScoreField}>
              <label>Passing Score (%)</label>
              <input 
                type="number" 
                value={passingScore}
                onChange={e => setPassingScore(parseInt(e.target.value))}
                min="0" max="100"
              />
            </div>
            <button 
              type="button" 
              className={styles.aiBtn}
              onClick={handleGenerateAI}
              disabled={aiLoading}
            >
              {aiLoading ? "✨ Menghitung..." : "✨ Generate dari Modul (AI)"}
            </button>
          </div>

          <div className={styles.questionsList}>
            {questions.map((q, qIndex) => (
              <div key={qIndex} className={styles.questionCard}>
                <div className={styles.cardHeader}>
                  <h4>Pertanyaan #{qIndex + 1}</h4>
                  <button type="button" className={styles.removeBtn} onClick={() => removeQuestion(qIndex)}>Hapus</button>
                </div>
                
                <textarea 
                  placeholder="Ketik pertanyaan di sini..."
                  value={q.question}
                  onChange={e => handleQuestionChange(qIndex, e.target.value)}
                  className={styles.questionInput}
                  required
                />

                <div className={styles.optionsGrid}>
                  {q.options.map((opt, oIndex) => (
                    <div key={oIndex} className={styles.optionItem}>
                      <input 
                        type="radio" 
                        name={`q-${qIndex}`}
                        checked={q.correctAnswer === oIndex}
                        onChange={() => {
                          const newQs = [...questions];
                          newQs[qIndex].correctAnswer = oIndex;
                          setQuestions(newQs);
                        }}
                      />
                      <input 
                        type="text" 
                        placeholder={`Pilihan ${oIndex + 1}`}
                        value={opt}
                        onChange={e => handleOptionChange(qIndex, oIndex, e.target.value)}
                        required
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <button type="button" className={styles.addBtn} onClick={addQuestion}>
            + Tambah Pertanyaan
          </button>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Batal</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Kuis"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
