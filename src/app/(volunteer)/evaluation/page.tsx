"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import styles from "./inputNilai.module.css";
import Modal from "@/components/ui/Modal/Modal";
import { getErrorMessage } from "@/lib/errors";

// ─── Types ────────────────────────────────────────────────────────────────────
type Student = {
  _id: string;
  name: string;
  region: string;
  category: string;
  parentName?: string;
};

type Schedule = {
  _id: string;
  region: string;
  level: string;
  semester: string;
  activeWeek: number;
};

type Grade = {
  _id: string;
  anakDidikId: Student | string;
  type: "TUGAS" | "UAS";
  week?: number;
  score: number;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
  subject?: string | null;
  maxScore?: number | null;
  semester: string;
  notes?: string;
  title?: string;
  createdAt: string;
};

// ─── Evaluation Type Options ─────────────────────────────────────────────────
const EVAL_TYPES = [
  { value: "TUGAS", label: "KBM Pekanan (Tugas)", dbType: "TUGAS" },
  { value: "UAS_LIT_KOG", label: "UAS Literasi — Kognitif", dbType: "UAS" },
  { value: "UAS_LIT_AFK", label: "UAS Literasi — Afektif", dbType: "UAS" },
  { value: "UAS_BING", label: "UAS Bahasa Inggris", dbType: "UAS" },
] as const;

type EvalTypeValue = (typeof EVAL_TYPES)[number]["value"];

type UasSubjectOption = { value: string; label: string; defaultMax: number };

function formatSubjectLabel(rawLabel: string, opts?: { stripPrefix?: boolean }): string {
  let label = (rawLabel || "").trim();
  label = label.replace(/\bBINDO\b/gi, "B.Indo");
  label = label.replace(/\bBING\b/gi, "B.Inggris");
  label = label.replace(/Bahasa Indonesia/gi, "B.Indo");
  label = label.replace(/Bahasa Inggris/gi, "B.Inggris");
  if (opts?.stripPrefix) {
    label = label.replace(/^Literasi\s+/i, "");
  }
  return label;
}

const FALLBACK_UAS_LIT_KOGNITIF: UasSubjectOption[] = [
  { value: "NUMERASI", label: "Literasi Numerasi", defaultMax: 100 },
  { value: "SAINS", label: "Literasi Sains", defaultMax: 100 },
  { value: "BINDO", label: "Literasi B.Indo", defaultMax: 100 },
];
const FALLBACK_UAS_LIT_AFEKTIF: UasSubjectOption[] = [
  { value: "MANDIRI", label: "Mandiri", defaultMax: 100 },
  { value: "BERNALAR_KRITIS", label: "Bernalar Kritis", defaultMax: 100 },
  { value: "KREATIF", label: "Kreatif", defaultMax: 100 },
];
const FALLBACK_UAS_BING: UasSubjectOption[] = [
  { value: "BING", label: "B.Inggris", defaultMax: 100 },
];

type FaseUasComponent = { subject: string; label: string; maxScore: number };
type FaseConfigEntry = {
  jenjang: string;
  uasKognitif: FaseUasComponent[];
  uasAfektif: FaseUasComponent[];
  uasBInggris: { maxScore: number } | null;
  kbmMaxPerComponent: number;
};

type Toast = { type: "success" | "error"; message: string } | null;

function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

const getRandomColor = (str: string) => {
  const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getScoreColor = (score: number) => {
  if (score >= 85) return styles.scoreHigh;
  if (score >= 70) return styles.scoreMid;
  return styles.scoreLow;
};

export default function InputNilaiPage() {
  const hasMounted = useHasMounted();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loadingCount, setLoadingCount] = useState(0);
  const loading = loadingCount > 0;
  const incLoading = useCallback(() => setLoadingCount((c) => c + 1), []);
  const decLoading = useCallback(() => setLoadingCount((c) => Math.max(0, c - 1)), []);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [mounted, setMounted] = useState(false);

  const getCurrentSemester = () => {
    const d = new Date();
    return `${d.getFullYear()}-1`;
  };

  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });
  const [availableSemesters, setAvailableSemesters] = useState<string[]>(["2025-1"]);
  const [selectedType, setSelectedType] = useState<EvalTypeValue>("TUGAS");
  const [selectedWeek, setSelectedWeek] = useState("1");

  const [faseConfig, setFaseConfig] = useState<Record<string, FaseConfigEntry>>({});
  
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [formScore, setFormScore] = useState(0);
  const [formScoreConcept, setFormScoreConcept] = useState(0);
  const [formScoreQuiz, setFormScoreQuiz] = useState(0);
  const [formScoreAttitude, setFormScoreAttitude] = useState(0);
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formUasScores, setFormUasScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchFaseConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.faseConfig) setFaseConfig(data.faseConfig);
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
      }
    } catch (err) {
      console.error("Gagal load settings", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchFaseConfig();
      setMounted(true);
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchFaseConfig]);

  const currentSched = schedules.find((s) => s._id === selectedScheduleId);
  const level = currentSched?.level;

  const currentFase: FaseConfigEntry | null = useMemo(() => {
    if (level && faseConfig[level]) {
      return faseConfig[level];
    }
    return null;
  }, [level, faseConfig]);

  const uasSubjectOptions: UasSubjectOption[] = useMemo(() => {
    if (selectedType === "UAS_LIT_KOG") {
      if (currentFase && currentFase.uasKognitif.length > 0) {
        return currentFase.uasKognitif.map((c) => ({
          value: c.subject, label: c.label, defaultMax: c.maxScore,
        }));
      }
      return FALLBACK_UAS_LIT_KOGNITIF;
    }
    if (selectedType === "UAS_LIT_AFK") {
      if (currentFase && currentFase.uasAfektif.length > 0) {
        return currentFase.uasAfektif.map((c) => ({
          value: c.subject, label: c.label, defaultMax: c.maxScore,
        }));
      }
      return FALLBACK_UAS_LIT_AFEKTIF;
    }
    if (selectedType === "UAS_BING") {
      if (currentFase && currentFase.uasBInggris) {
        return [{ value: "BING", label: "UAS Bahasa Inggris (Total)", defaultMax: currentFase.uasBInggris.maxScore }];
      }
      return FALLBACK_UAS_BING;
    }
    return [];
  }, [selectedType, currentFase]);

  const uasSubjectsKey = useMemo(() => uasSubjectOptions.map((s) => s.value).sort().join("|"), [uasSubjectOptions]);
  const dbType = EVAL_TYPES.find((t) => t.value === selectedType)!.dbType;
  const isReadOnly = selectedSemester !== getCurrentSemester();

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      const data = await res.json();
      if (res.ok && data.schedules) {
        setSchedules(data.schedules);
        const activeInSem = data.schedules.filter((s: Schedule) => s.semester === selectedSemester);
        if (activeInSem.length > 0 && !selectedScheduleId) {
          setSelectedScheduleId(activeInSem[0]._id);
        }
      }
    } catch (err) {
      console.error("Gagal memuat jadwal", err);
    }
  }, [selectedSemester, selectedScheduleId]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSchedules();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSchedules]);

  const fetchStudents = useCallback(async () => {
    const sched = schedules.find(s => s._id === selectedScheduleId);
    if (!sched) return;
    incLoading();
    try {
      const res = await fetch(`/api/volunteer/students?region=${encodeURIComponent(sched.region)}&level=${encodeURIComponent(sched.level)}`);
      const data = await res.json();
      if (res.ok) setStudents(data.students || []);
    } catch (err) {
      console.error(err);
    } finally {
      decLoading();
    }
  }, [selectedScheduleId, schedules, incLoading, decLoading]);

  useEffect(() => {
    if (selectedScheduleId) {
      const timer = setTimeout(() => {
        fetchStudents();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [selectedScheduleId, fetchStudents]);

  const fetchGrades = useCallback(async () => {
    if (students.length === 0) {
      setGrades([]);
      return;
    }
    incLoading();
    try {
      const query = new URLSearchParams();
      query.append("semester", selectedSemester);
      query.append("type", dbType);
      if (dbType === "TUGAS" && selectedWeek) query.append("week", selectedWeek);

      const res = await fetch(`/api/volunteer/evaluation?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        let filtered = data.nilai || [];
        if (dbType === "UAS") {
          const allowed = uasSubjectsKey.split("|");
          filtered = filtered.filter((g: Grade) => g.subject && allowed.includes(g.subject));
        }
        setGrades(filtered);
      }
    } catch (err) {
      console.error(err);
    } finally {
      decLoading();
    }
  }, [students, selectedSemester, dbType, selectedWeek, uasSubjectsKey, incLoading, decLoading]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchGrades();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchGrades]);

  useEffect(() => {
    document.body.style.overflow = (formOpen || deleteId) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, deleteId]);

  const handleOpenForm = (student: Student, existingGrade?: Grade) => {
    setActiveStudent(student);
    if (existingGrade) {
      setEditId(existingGrade._id);
      setFormScore(existingGrade.score);
      setFormScoreConcept(existingGrade.scoreConcept || 0);
      setFormScoreQuiz(existingGrade.scoreQuiz || 0);
      setFormScoreAttitude(existingGrade.scoreAttitude || 0);
      setFormTitle(existingGrade.title || "");
      setFormNotes(existingGrade.notes || "");
    } else {
      setEditId(null);
      setFormScore(0);
      setFormScoreConcept(0);
      setFormScoreQuiz(0);
      setFormScoreAttitude(0);
      setFormTitle(selectedType === "TUGAS" ? `KBM Pekan ${selectedWeek}` : "");
      setFormNotes("");
    }

    if (dbType === "UAS") {
      const initial: Record<string, number> = {};
      const studentGrades = grades.filter(g => (typeof g.anakDidikId === 'string' ? g.anakDidikId : g.anakDidikId._id) === student._id);
      for (const opt of uasSubjectOptions) {
        const found = studentGrades.find(g => g.subject === opt.value);
        initial[opt.value] = found?.score || 0;
      }
      setFormUasScores(initial);
      // Prefill notes dari subject record yang punya notes (semua subject share catatan yang sama)
      if (!existingGrade) {
        const withNotes = studentGrades.find(g => g.notes && g.notes.trim());
        setFormNotes(withNotes?.notes || "");
      }
    }
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!activeStudent || isReadOnly) return;
    setSubmitting(true);
    try {
      if (dbType === "UAS") {
        const ops = uasSubjectOptions.map(async (opt) => {
          const score = formUasScores[opt.value] || 0;
          const studentGrades = grades.filter(g => (typeof g.anakDidikId === 'string' ? g.anakDidikId : g.anakDidikId._id) === activeStudent._id);
          const existing = studentGrades.find(g => g.subject === opt.value);
          
          const payload = {
            anakDidikId: activeStudent._id,
            type: "UAS",
            title: `UAS ${formatSubjectLabel(opt.label)}`,
            semester: selectedSemester,
            subject: opt.value,
            score,
            maxScore: 100,
            notes: formNotes,
          };

          return fetch(existing ? `/api/volunteer/evaluation/${existing._id}` : "/api/volunteer/evaluation", {
            method: existing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
        });
        await Promise.all(ops);
      } else {
        const payload = {
          anakDidikId: activeStudent._id,
          type: dbType,
          week: dbType === "TUGAS" ? parseInt(selectedWeek) : null,
          title: formTitle,
          notes: formNotes,
          semester: selectedSemester,
          score: formScore,
          scoreConcept: formScoreConcept,
          scoreQuiz: formScoreQuiz,
          scoreAttitude: formScoreAttitude,
        };
        const res = await fetch(editId ? `/api/volunteer/evaluation/${editId}` : "/api/volunteer/evaluation", {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Gagal menyimpan");
      }
      setToast({ type: "success", message: "Nilai berhasil disimpan" });
      fetchGrades();
      setFormOpen(false);
    } catch (err) {
      setToast({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/volunteer/evaluation/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ type: "success", message: "Nilai dihapus" });
        fetchGrades();
        setDeleteId(null);
      }
    } catch (err) {
      setToast({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
      setTimeout(() => setToast(null), 3000);
    }
  };

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (!hasMounted) return null;

  return (
    <div className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroLabel}>AKADEMIK</span>
          <h1 className={styles.heroTitle}>Input Nilai Terintegrasi.</h1>
          <p className={styles.heroDesc}>Pencatatan perkembangan belajar anak didik sesuai jadwal aktif.</p>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Semester</label>
          <select className={styles.filterSelect} value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
            {availableSemesters.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Jadwal Mengajar</label>
          <select className={styles.filterSelect} value={selectedScheduleId} onChange={(e) => setSelectedScheduleId(e.target.value)}>
            <option value="">-- Pilih Jadwal --</option>
            {schedules.filter(s => s.semester === selectedSemester).map(s => (
              <option key={s._id} value={s._id}>{s.region} — {s.level}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Tipe Evaluasi</label>
          <select className={styles.filterSelect} value={selectedType} onChange={(e) => setSelectedType(e.target.value as EvalTypeValue)}>
            {EVAL_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {selectedType === "TUGAS" && (
          <div className={styles.filterItem} style={{ flex: 0, minWidth: 80 }}>
            <label className={styles.filterLabel}>Pekan</label>
            <input type="number" className={styles.filterSelect} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} />
          </div>
        )}
        <div className={styles.filterItem} style={{ flex: 2 }}>
          <label className={styles.filterLabel}>Cari Siswa</label>
          <input type="text" className={styles.filterSelect} placeholder="Ketik nama siswa..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      <div className={styles.tableWrap}>
        {loading ? (
          <div style={{textAlign: 'center', padding: 100}}>
            <div className={styles.spinner} style={{margin: '0 auto 16px'}}></div>
            <p style={{color: '#94a3b8', fontWeight: 600}}>Memuat data...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{textAlign: 'center', padding: 100}}>
            <p style={{color: '#94a3b8', fontWeight: 600}}>Data tidak ditemukan.</p>
          </div>
        ) : dbType === "UAS" ? (
          <div style={{ overflowX: 'auto' }}>
            <table className={`${styles.table} ${styles.uasTable}`}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Siswa</th>
                  <th>Kategori</th>
                  {uasSubjectOptions.map((opt) => (
                    <th key={opt.value} style={{ minWidth: '90px' }}>
                      {formatSubjectLabel(opt.label, { stripPrefix: true })}
                    </th>
                  ))}
                  <th style={{ minWidth: '180px' }}>Catatan</th>
                  <th style={{ minWidth: '120px' }}>Status</th>
                  <th style={{ textAlign: "right", minWidth: '120px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const studentGrades = grades.filter(g => (typeof g.anakDidikId === 'string' ? g.anakDidikId : (g.anakDidikId as Student)._id) === student._id);
                  const gradeBySubject: Record<string, Grade | undefined> = {};
                  for (const g of studentGrades) if (g.subject) gradeBySubject[g.subject] = g;
                  
                  const filledCount = uasSubjectOptions.filter(opt => typeof gradeBySubject[opt.value]?.score === "number").length;
                  //const totalCount = uasSubjectOptions.length;

                  return (
                    <tr key={student._id}>
                      <td className={styles.stickyCol}>
                        <div className={styles.studentCell}>
                          <div className={styles.studentAva} style={{ background: getRandomColor(student.name) }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>{student.region}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize: 12, fontWeight: 600, color: '#64748b'}}>{student.category}</span></td>
                        {uasSubjectOptions.map((opt) => {
                          const g = gradeBySubject[opt.value];
                          return (
                            <td key={opt.value}>
                              {g ? (
                                <span className={`${styles.uasScoreChip} ${getScoreColor(g.score)}`}>{g.score}</span>
                              ) : <span className={styles.emptyDash}>—</span>}
                            </td>
                          );
                        })}
                        <td>
                          {(() => {
                            const noteGrade = studentGrades.find(g => g.notes && g.notes.trim());
                            return noteGrade ? (
                              <div className={styles.gradeNote} title={noteGrade.notes}>{noteGrade.notes}</div>
                            ) : <span className={styles.emptyDash}>—</span>;
                          })()}
                        </td>
                        <td>
                          <span className={`${styles.uasStatusBadge} ${filledCount === 0 ? styles.uasStatusEmpty : styles.uasStatusFull}`}>
                          {filledCount === 0 ? "Belum Dinilai" : "Sudah Dinilai"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className={`${styles.uasActionBtn} ${filledCount > 0 ? styles.outline : styles.primary}`} onClick={() => handleOpenForm(student)}>
                          {filledCount > 0 ? "Edit Nilai" : "Input Nilai"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : dbType === "TUGAS" ? (
          <div style={{ overflowX: 'auto' }}>
            <table className={`${styles.table} ${styles.uasTable}`}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Siswa</th>
                  <th>Kategori</th>
                  <th style={{ minWidth: '90px' }}>Konsep</th>
                  <th style={{ minWidth: '90px' }}>Kuis</th>
                  <th style={{ minWidth: '90px' }}>Sikap</th>
                  <th style={{ minWidth: '180px' }}>Catatan</th>
                  <th style={{ minWidth: '120px' }}>Status</th>
                  <th style={{ textAlign: "right", minWidth: '120px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const studentGrades = grades.filter(g => (typeof g.anakDidikId === 'string' ? g.anakDidikId : (g.anakDidikId as Student)._id) === student._id);
                  const g = studentGrades[0]; // Tugas usually has one record per week

                  return (
                    <tr key={student._id}>
                      <td className={styles.stickyCol}>
                        <div className={styles.studentCell}>
                          <div className={styles.studentAva} style={{ background: getRandomColor(student.name) }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>{student.region}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize: 12, fontWeight: 600, color: '#64748b'}}>{student.category}</span></td>
                      <td>
                        {g?.scoreConcept !== undefined ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(g.scoreConcept)}`}>{g.scoreConcept}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g?.scoreQuiz !== undefined ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(g.scoreQuiz)}`}>{g.scoreQuiz}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g?.scoreAttitude !== undefined ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(g.scoreAttitude)}`}>{g.scoreAttitude}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g?.notes && g.notes.trim() ? (
                          <div className={styles.gradeNote} title={g.notes}>{g.notes}</div>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g ? (
                          <span className={`${styles.uasStatusBadge} ${styles.uasStatusFull}`}>Sudah Dinilai</span>
                        ) : (
                          <span className={`${styles.uasStatusBadge} ${styles.uasStatusEmpty}`}>Belum Dinilai</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className={`${styles.uasActionBtn} ${g ? styles.outline : styles.primary}`} onClick={() => handleOpenForm(student, g)}>
                          {g ? "Edit Nilai" : "Input Nilai"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Anak Didik</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th>Rincian Nilai</th>
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const studentGrades = grades.filter(g => (typeof g.anakDidikId === 'string' ? g.anakDidikId : (g.anakDidikId as Student)._id) === student._id);
                  return (
                    <tr key={student._id}>
                      <td className={styles.stickyCol}>
                        <div className={styles.studentCell}>
                          <div className={styles.studentAva} style={{ background: getRandomColor(student.name) }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>{student.region}</div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize: 12, fontWeight: 600, color: '#64748b'}}>{student.category}</span></td>
                      <td>
                        {studentGrades.length > 0 ? (
                          <span className={`${styles.typeBadge} ${styles.typeKuis}`}>DINILAI</span>
                        ) : <span className={`${styles.typeBadge} ${styles.typeEmpty}`}>BELUM</span>}
                      </td>
                      <td>
                        {studentGrades.length > 0 ? (
                          <div className={styles.gradeList}>
                            {studentGrades.map(g => (
                              <div key={g._id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div className={styles.gradeChip}>
                                  {g.type === "TUGAS" ? (
                                    `K:${g.scoreConcept} Q:${g.scoreQuiz} S:${g.scoreAttitude}`
                                  ) : g.score}
                                </div>
                                {g.notes && g.notes.trim() && (
                                  <div className={styles.gradeNote} title={g.notes}>{g.notes}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {studentGrades.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button className={styles.btnEdit} onClick={() => handleOpenForm(student, studentGrades[0])}>Edit</button>
                            <button className={styles.btnDanger} onClick={() => setDeleteId(studentGrades[0]._id)}>Hapus</button>
                          </div>
                        ) : (
                          <button className={styles.btnPrimary} onClick={() => handleOpenForm(student)}>Input Nilai</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && activeStudent && (
        <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editId ? "Edit Penilaian" : "Input Penilaian"} footer={
          <>
            <button className={styles.btnSecondary} onClick={() => setFormOpen(false)}>Batal</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={submitting}>Simpan Nilai</button>
          </>
        }>
          <div className={styles.formGrid}>
            <div className={styles.fieldRow}>
              <div className={styles.field} style={{flex: 1}}>
                <label className={styles.fieldLabel}>Nama Siswa</label>
                <input type="text" className={styles.formInput} value={activeStudent.name} disabled />
              </div>
              <div className={styles.field} style={{flex: 1}}>
                <label className={styles.fieldLabel}>Judul Pertemuan</label>
                <input type="text" className={styles.formInput} placeholder="Contoh: KBM Pekan 1" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
              </div>
            </div>
            {dbType === "TUGAS" ? (
              <div className={styles.scoreCard}>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#e0f2fe', color: '#0369a1' }}>💡</div>
                    <div><div className={styles.scoreName}>Konsep</div></div>
                  </div>
                  <input 
                    type="number" 
                    className={styles.scoreInput} 
                    value={formScoreConcept} 
                    onChange={e => setFormScoreConcept(parseInt(e.target.value) || 0)} 
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#fef2f2', color: '#991b1b' }}>📝</div>
                    <div><div className={styles.scoreName}>Kuis</div></div>
                  </div>
                  <input 
                    type="number" 
                    className={styles.scoreInput} 
                    value={formScoreQuiz} 
                    onChange={e => setFormScoreQuiz(parseInt(e.target.value) || 0)} 
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#f0fdf4', color: '#166534' }}>⭐</div>
                    <div><div className={styles.scoreName}>Sikap</div></div>
                  </div>
                  <input 
                    type="number" 
                    className={styles.scoreInput} 
                    value={formScoreAttitude} 
                    onChange={e => setFormScoreAttitude(parseInt(e.target.value) || 0)} 
                    onFocus={e => e.target.select()}
                  />
                </div>
              </div>
            ) : dbType === "UAS" ? (
              <div className={styles.scoreCard}>
                {uasSubjectOptions.map((opt, idx) => (
                  <div key={opt.value} className={styles.scoreItem}>
                    <div className={styles.scoreInfo}>
                      <div className={styles.scoreIcon} style={{ background: '#f8fafc', color: '#475569' }}>{idx + 1}</div>
                      <div><div className={styles.scoreName}>{formatSubjectLabel(opt.label)}</div></div>
                    </div>
                    <input 
                      type="number" 
                      className={styles.scoreInput} 
                      value={formUasScores[opt.value] || 0} 
                      onChange={e => setFormUasScores(prev => ({...prev, [opt.value]: parseInt(e.target.value) || 0}))} 
                      onFocus={e => e.target.select()}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Skor Akhir</label>
                <input 
                  type="number" 
                  className={styles.formInput} 
                  value={formScore} 
                  onChange={e => setFormScore(parseInt(e.target.value) || 0)} 
                  onFocus={e => e.target.select()}
                />
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Catatan (Opsional)</label>
              <textarea className={styles.formTextarea} placeholder="Ketik feedback..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Konfirmasi Hapus" footer={
          <>
            <button className={styles.btnSecondary} onClick={() => setDeleteId(null)}>Batal</button>
            <button className={styles.btnDanger} onClick={handleDelete} disabled={submitting}>Ya, Hapus</button>
          </>
        }>
          <p style={{fontSize: 14, color: '#475569', textAlign: 'center'}}>Yakin ingin menghapus nilai ini?</p>
        </Modal>
      )}
    </div>
  );
}
