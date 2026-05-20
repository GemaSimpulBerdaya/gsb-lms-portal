"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import Image from "next/image";
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
  type: "TUGAS" | "UJIAN" | "KUIS" | "UTS" | "UAS" | "TRYOUT";
  week?: number;
  score: number;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
  subject?: string | null;
  maxScore?: number | null;
  tryoutNumber?: number | null;
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
  { value: "TRYOUT", label: "Try Out (SNBT)", dbType: "TRYOUT" },
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
  const [selectedTryout, setSelectedTryout] = useState("1");

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
    const timer = setTimeout(() => fetchFaseConfig(), 0);
    return () => clearTimeout(timer);
  }, [fetchFaseConfig]);

  const currentSched = schedules.find((s) => s._id === selectedScheduleId);
  const level = currentSched?.level;
  const isSnbtClass = Boolean(level && /snbt/i.test(level));

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
      if ((dbType === "TUGAS" || dbType === "TRYOUT") && selectedWeek) query.append("week", selectedWeek);
      if (dbType === "TRYOUT") query.append("tryoutNumber", selectedTryout);

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
  }, [students, selectedSemester, dbType, selectedWeek, selectedTryout, uasSubjectsKey, incLoading, decLoading]);

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
          week: (dbType === "TUGAS" || dbType === "TRYOUT") ? parseInt(selectedWeek) : null,
          title: formTitle,
          notes: formNotes,
          semester: selectedSemester,
          score: formScore,
          scoreConcept: formScoreConcept,
          scoreQuiz: formScoreQuiz,
          scoreAttitude: formScoreAttitude,
          tryoutNumber: dbType === "TRYOUT" ? parseInt(selectedTryout) : undefined,
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
    <div className={styles.main}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.hero}>
        <div className={styles.heroText}>
          <span className={styles.heroLabel}>AKADEMIK</span>
          <h1 className={styles.heroTitle}>Input Nilai Terintegrasi.</h1>
          <p className={styles.heroDesc}>Kelola nilai siswa berdasarkan jadwal mengajar aktif.</p>
        </div>
      </div>

      <div className={styles.filterBar}>
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
          <label className={styles.filterLabel}>Semester</label>
          <select className={styles.filterSelect} value={selectedSemester} onChange={(e) => setSelectedSemester(e.target.value)}>
            {availableSemesters.map(sem => <option key={sem} value={sem}>{sem}</option>)}
          </select>
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Tipe</label>
          <select className={styles.filterSelect} value={selectedType} onChange={(e) => setSelectedType(e.target.value as EvalTypeValue)}>
            {EVAL_TYPES.filter(t => t.value !== "TRYOUT" || isSnbtClass).map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Cari</label>
          <input type="text" className={styles.filterSelect} placeholder="Nama siswa..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
        {(selectedType === "TUGAS" || selectedType === "TRYOUT") && (
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Pekan</label>
            <input type="number" className={styles.filterSelect} style={{width: 80}} value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)} />
          </div>
        )}
        {selectedType === "TRYOUT" && (
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>TO #</label>
            <input type="number" className={styles.filterSelect} style={{width: 60}} value={selectedTryout} onChange={e => setSelectedTryout(e.target.value)} />
          </div>
        )}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Siswa</th>
              <th>Kategori</th>
              <th>Nilai</th>
              <th style={{ textAlign: "right" }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} style={{textAlign: 'center', padding: 40}}>Memuat data...</td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr><td colSpan={4} style={{textAlign: 'center', padding: 40}}>Tidak ada siswa ditemukan</td></tr>
            ) : (
              filteredStudents.map((student) => {
                const studentGrades = grades.filter(g => (typeof g.anakDidikId === 'string' ? g.anakDidikId : g.anakDidikId._id) === student._id);
                return (
                  <tr key={student._id}>
                    <td>
                      <div className={styles.studentCell}>
                        <Image src={`https://i.pravatar.cc/150?u=${student._id}`} alt="" className={styles.studentAva} width={32} height={32} unoptimized />
                        <div>
                          <div className={styles.studentCellName}>{student.name}</div>
                          <div className={styles.studentCellSub}>{student.region}</div>
                        </div>
                      </div>
                    </td>
                    <td>{student.category}</td>
                    <td>
                      {studentGrades.length > 0 ? (
                        <div className={styles.gradeList}>
                          {studentGrades.map(g => (
                            <span key={g._id} className={styles.gradeChip}>
                              {g.scoreConcept !== undefined ? `K:${g.scoreConcept} Q:${g.scoreQuiz} S:${g.scoreAttitude}` : g.score}
                            </span>
                          ))}
                        </div>
                      ) : <span className={styles.emptyDash}>—</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button className={styles.btnPrimary} onClick={() => handleOpenForm(student)}>
                        {studentGrades.length > 0 ? "Edit/Tambah" : "Input Nilai"}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formOpen && activeStudent && (
        <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Input Penilaian" footer={
          <>
            <button className={styles.btnSecondary} onClick={() => setFormOpen(false)}>Batal</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={submitting}>Simpan</button>
          </>
        }>
          <div className={styles.formGrid}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Siswa</label>
              <input type="text" className={styles.formInput} value={activeStudent.name} disabled />
            </div>
            {dbType === "TUGAS" ? (
              <div className={styles.scoreGrid}>
                <div className={styles.field}>
                  <label>Konsep</label>
                  <input type="number" className={styles.formInput} value={formScoreConcept} onChange={e => setFormScoreConcept(parseInt(e.target.value) || 0)} />
                </div>
                <div className={styles.field}>
                  <label>Kuis</label>
                  <input type="number" className={styles.formInput} value={formScoreQuiz} onChange={e => setFormScoreQuiz(parseInt(e.target.value) || 0)} />
                </div>
                <div className={styles.field}>
                  <label>Sikap</label>
                  <input type="number" className={styles.formInput} value={formScoreAttitude} onChange={e => setFormScoreAttitude(parseInt(e.target.value) || 0)} />
                </div>
              </div>
            ) : dbType === "UAS" ? (
              <div className={styles.uasGrid}>
                {uasSubjectOptions.map(opt => (
                  <div key={opt.value} className={styles.field}>
                    <label>{opt.label}</label>
                    <input type="number" className={styles.formInput} value={formUasScores[opt.value] || 0} onChange={e => setFormUasScores(prev => ({...prev, [opt.value]: parseInt(e.target.value) || 0}))} />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.field}>
                <label>Nilai</label>
                <input type="number" className={styles.formInput} value={formScore} onChange={e => setFormScore(parseInt(e.target.value) || 0)} />
              </div>
            )}
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Hapus Nilai?" footer={
          <>
            <button className={styles.btnSecondary} onClick={() => setDeleteId(null)}>Batal</button>
            <button className={styles.btnDanger} onClick={handleDelete} disabled={submitting}>Ya, Hapus</button>
          </>
        }>
          <p>Yakin ingin menghapus nilai ini?</p>
        </Modal>
      )}
    </div>
  );
}
