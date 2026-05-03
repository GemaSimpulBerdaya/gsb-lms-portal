"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./inputNilai.module.css";

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
  level: "DISABILITAS" | "TK" | "SD" | "SMP";
  semester: string;
  activeWeek: number;
};

type Grade = {
  _id: string;
  anakDidikId: Student | string;
  type: "TUGAS" | "UJIAN" | "KUIS";
  week?: number;
  score: number;
  semester: string;
  notes?: string;
  title?: string;
  createdAt: string;
};

type Toast = { type: "success" | "error"; message: string } | null;

export default function InputNilaiPage() {
  const [mounted, setMounted] = useState(false);
  
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);

  // Global Filter states (used to fetch grades & prefill forms)
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

  // Keep localStorage in sync when changed locally
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", selectedSemester);
    }
  }, [selectedSemester]);

  // Sync with global semester only on initial mount
  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
          
          const stored = localStorage.getItem("activeSemester");
          if (data.activeSemester && (!stored || stored === getCurrentSemester())) {
            setSelectedSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };

    fetchGlobalSemester();

    const handleStorage = () => {
      const active = localStorage.getItem("activeSemester");
      if (active && active !== selectedSemester) {
        setSelectedSemester(active);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []); // Empty dependency array to run only once
  const [selectedType, setSelectedType] = useState("TUGAS");
  const [selectedWeek, setSelectedWeek] = useState("1"); // only for TUGAS
  const [selectedKuis, setSelectedKuis] = useState("Kuis 1"); // Preset Kuis

  const isReadOnly = selectedSemester !== getCurrentSemester();

  // Form Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  
  const [formScore, setFormScore] = useState(0);
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Delete states
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ─── Utils ──────────────────────────────────────────────────────────────────
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Fetch Schedules on mount
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const res = await fetch("/api/volunteer/schedule");
        const data = await res.json();
        if (res.ok && data.schedules) {
          setSchedules(data.schedules);
          
          const activeSchedules = data.schedules.filter((s: any) => s.semester === selectedSemester);
          if (activeSchedules.length > 0) {
            const current = activeSchedules.find((s: any) => s._id === selectedScheduleId) || activeSchedules[0];
            setSelectedScheduleId(current._id);
          } else {
            setSelectedScheduleId("");
          }
        }
      } catch (err) {
        console.error("Gagal memuat jadwal", err);
      }
    };
    if (mounted) fetchSchedules();
    else setMounted(true);
  }, [selectedSemester, mounted]);

  // 1b. Sync schedule with selected semester
  useEffect(() => {
    if (selectedScheduleId && schedules.length > 0) {
      const currentSched = schedules.find(s => s._id === selectedScheduleId);
      if (currentSched && currentSched.semester !== selectedSemester) {
        setSelectedScheduleId("");
      }
    }
  }, [selectedSemester, schedules, selectedScheduleId]);

  // 2. Fetch Students when selected Schedule changes
  useEffect(() => {
    const fetchStudentsForSchedule = async () => {
      const sched = schedules.find(s => s._id === selectedScheduleId);
      if (!sched) return;

      setLoading(true);
      try {
        const studentParams = new URLSearchParams({ region: sched.region, level: sched.level });
        const resStudents = await fetch(`/api/volunteer/students?${studentParams}`);
        const dataStudents = await resStudents.json();
        
        if (!resStudents.ok) throw new Error(dataStudents.error || "Gagal memuat data siswa");
        setStudents(dataStudents.students || []);
      } catch (err: any) {
        console.error("Gagal memuat data siswa", err);
        showToast("error", err.message);
        setStudents([]);
      } finally {
        setLoading(false);
      }
    };

    if (selectedScheduleId) {
      fetchStudentsForSchedule();
      
      const sched = schedules.find(s => s._id === selectedScheduleId);
      if (sched) {
        if (selectedType === "TUGAS") {
          setSelectedWeek(sched.activeWeek.toString());
        }
      }
    } else {
      setStudents([]);
    }
  }, [selectedScheduleId, schedules]);

  // 3. Fetch Grades when filters change
  const fetchGrades = useCallback(async () => {
    if (students.length === 0) {
      setGrades([]);
      return;
    }

    setLoading(true); // Ensure loading is true when fetching
    try {
      const query = new URLSearchParams();
      query.append("semester", selectedSemester);
      query.append("type", selectedType);
      
      // Filter by Week for TUGAS, or Title for KUIS/UJIAN
      if (selectedType === "TUGAS" && selectedWeek) {
        query.append("week", selectedWeek);
      } else if (selectedType === "KUIS" && selectedKuis) {
        query.append("title", selectedKuis);
      }
      
      const res = await fetch(`/api/volunteer/evaluation?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setGrades(data.nilai || []);
      } else {
        setGrades([]);
      }
    } catch (err) {
      console.error("Gagal memuat data nilai", err);
      setGrades([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester, selectedType, selectedWeek, selectedKuis, students]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = (formOpen || deleteId) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, deleteId]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleOpenForm = (student: Student, existingGrade?: Grade) => {
    setActiveStudent(student);
    if (existingGrade) {
      setEditId(existingGrade._id);
      setFormScore(existingGrade.score);
      setFormTitle(existingGrade.title || "");
      setFormNotes(existingGrade.notes || "");
    } else {
      setEditId(null);
      setFormScore(0);
      
      if (selectedType === "KUIS") {
        setFormTitle(selectedKuis);
      } else if (selectedType === "UJIAN") {
        setFormTitle("UAS (Ujian Akhir Semester)");
      } else {
        const existingCount = grades.filter(g => {
          const sid = typeof g.anakDidikId === 'object' ? (g.anakDidikId as any)._id : g.anakDidikId;
          return sid === student._id;
        }).length;
        setFormTitle(`Tugas ${existingCount + 1}`);
      }
      setFormNotes("");
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setActiveStudent(null);
  };

  const handleSubmit = async () => {
    if (!activeStudent || isReadOnly) return;
    setSubmitting(true);
    try {
      const payload = {
        anakDidikId: activeStudent._id,
        type: selectedType,
        week: selectedType === "TUGAS" ? parseInt(selectedWeek) : null,
        score: formScore,
        title: formTitle,
        notes: formNotes,
        semester: selectedSemester,
      };

      const url = editId 
        ? `/api/volunteer/evaluation/${editId}` 
        : `/api/volunteer/evaluation`;
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan nilai.");

      showToast("success", "Data nilai berhasil disimpan.");
      fetchGrades();
      closeForm();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || isReadOnly) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/volunteer/evaluation/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus nilai.");
      showToast("success", "Nilai berhasil dihapus.");
      fetchGrades();
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSubmitting(false);
      setDeleteId(null);
    }
  };

  // ─── Rendering Helpers ──────────────────────────────────────────────────────
  const filteredStudents = students.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    }
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 85) return styles.scoreHigh;
    if (score >= 70) return styles.scoreMid;
    return styles.scoreLow;
  };

  const getBadgeClass = (type: string) => {
    if (type === "TUGAS") return styles.typeTugas;
    if (type === "UJIAN") return styles.typeUjian;
    if (type === "KUIS") return styles.typeKuis;
    return "";
  };

  const formatSemester = (sem: string) => {
    if (!sem) return "-";
    const [year, term] = sem.split("-");
    return `Semester ${term} - ${year}`;
  };

  // Get unique semesters from schedules
  const [availableSemesters, setAvailableSemesters] = useState<string[]>(["2025-1"]);

  if (!mounted) return null;

  return (
    <div className={`${styles.main} ${styles.mainEnter}`}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>AKADEMIK</span>
            <h1 className={styles.heroTitle}>Input Nilai Terintegrasi.</h1>
            <p className={styles.heroDesc}>
              Daftar siswa dan minggu evaluasi dimuat secara otomatis berdasarkan Jadwal Mengajar Anda yang sedang aktif.
            </p>
            {isReadOnly && (
              <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(192, 57, 43, 0.1)', color: '#c0392b', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                ARSIP SEMESTER LAMPAU (READ-ONLY)
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup} style={{ borderRight: '1.5px solid #e0e0e0', paddingRight: '20px', marginRight: '4px' }}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Jadwal Mengajar Anda</label>
            {schedules.length === 0 ? (
              <div style={{ padding: '10px 16px', background: '#fff0ee', color: '#c0392b', borderRadius: '12px', fontSize: '13px', fontWeight: 500 }}>
                Belum ada jadwal.
              </div>
            ) : (
              <div className={styles.selectWrapper}>
                <select 
                  className={styles.filterSelect} 
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  style={{ minWidth: '220px' }}
                >
                  <option value="">-- Pilih Jadwal --</option>
                  {schedules
                    .filter(s => s.semester === selectedSemester)
                    .map(s => (
                      <option key={s._id} value={s._id}>
                        {s.region} — {s.level}
                      </option>
                    ))
                  }
                </select>
                <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            )}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Semester</label>
            <div className={styles.selectWrapper}>
              <select 
                className={styles.filterSelect} 
                value={selectedSemester} 
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                {availableSemesters.map(sem => (
                  <option key={sem} value={sem}>{formatSemester(sem)}</option>
                ))}
              </select>
              <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
          
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Tipe Evaluasi</label>
            <div className={styles.selectWrapper}>
              <select className={styles.filterSelect} value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                <option value="TUGAS">Tugas Mingguan</option>
                <option value="KUIS">Kuis</option>
                <option value="UJIAN">Ujian Akhir</option>
              </select>
              <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>

          {selectedType === "TUGAS" && (
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Minggu Ke-</label>
              <div className={styles.selectWrapper}>
                <input type="number" className={styles.filterSelect} style={{ minWidth: "90px" }} value={selectedWeek} min="1" max="52" onChange={(e) => setSelectedWeek(e.target.value)} />
              </div>
            </div>
          )}

          {selectedType === "KUIS" && (
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Pilih Kuis</label>
              <div className={styles.selectWrapper}>
                <select 
                  className={styles.filterSelect}
                  value={selectedKuis}
                  onChange={(e) => setSelectedKuis(e.target.value)}
                >
                  <option value="Kuis 1">Kuis 1 (Awal)</option>
                  <option value="UTS">UTS (Tengah Semester)</option>
                  <option value="Kuis 2">Kuis 2 (Akhir)</option>
                  <option value="UAS">UAS (Final)</option>
                </select>
                <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            Daftar Anak Didik
            <span style={{ fontSize: 14, color: '#888', marginLeft: 12, fontWeight: 'normal' }}>
              ({selectedType} {selectedType === 'TUGAS' && selectedWeek ? `- Minggu ${selectedWeek}` : ''})
            </span>
          </h2>
          
          {schedules.length > 0 && (
            <div className={styles.searchWrapper}>
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" className={styles.searchInput} placeholder="Cari nama siswa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: '#f9f9f9', width: '200px' }} />
            </div>
          )}
        </div>

        {schedules.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <h3 className={styles.emptyTitle}>Belum Ada Jadwal</h3>
            <p className={styles.emptyDesc}>Anda harus menambahkan jadwal mengajar terlebih dahulu.</p>
          </div>
        ) : loading ? (
          <div className={styles.emptyState}>
            <div className={styles.spinner} style={{ borderColor: '#c0392b', borderTopColor: 'transparent', margin: '0 auto', width: 32, height: 32, borderWidth: 3 }}></div>
            <p style={{ marginTop: 16, color: '#888' }}>Mencari data...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>Data Siswa Kosong</h3>
            <p className={styles.emptyDesc}>Tidak ada siswa yang sesuai di kelas ini.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th>Keterangan</th>
                  <th>Nilai</th>
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const studentGrades = grades
                    .filter(g => {
                      const gradeStudentId = typeof g.anakDidikId === 'object' 
                        ? (g.anakDidikId as any)?._id?.toString() 
                        : g.anakDidikId?.toString();
                      return gradeStudentId === student._id.toString();
                    })
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                  return (
                    <tr key={student._id}>
                      <td>
                        <div className={styles.studentCell}>
                          <img src={`https://i.pravatar.cc/150?u=${student._id}`} alt="avatar" className={styles.studentAva} />
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>{student.region}</div>
                          </div>
                        </div>
                      </td>
                      <td>{student.category}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {studentGrades.length > 0 ? (
                            studentGrades.map(g => (
                              <span key={g._id} className={`${styles.typeBadge} ${styles.typeKuis}`} style={{ fontSize: '10px', padding: '2px 8px', textAlign: 'center', width: 'fit-content', height: '24px', display: 'flex', alignItems: 'center' }}>
                                DINILAI
                              </span>
                            ))
                          ) : (
                            <span className={`${styles.typeBadge} ${styles.typeEmpty}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                              BELUM DINILAI
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {studentGrades.length > 0 ? (
                            studentGrades.map((g, idx) => (
                              <div key={g._id} style={{ fontSize: '12px', fontWeight: 600, color: '#444', height: '24px', display: 'flex', alignItems: 'center' }}>
                                {g.title || `${g.type === 'TUGAS' ? 'Tugas' : g.type} ${idx + 1}`}
                              </div>
                            ))
                          ) : (
                            <span style={{ color: '#bbb' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {studentGrades.length > 0 ? (
                            studentGrades.map((g) => (
                              <div key={g._id} className={`${styles.scorePill} ${getScoreColor(g.score)}`} style={{ fontSize: '12px', fontWeight: 700, height: '24px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                {g.score} <span style={{ fontSize: '10px', fontWeight: 400, color: '#aaa' }}>/ 100</span>
                              </div>
                            ))
                          ) : (
                            <span style={{ color: '#bbb' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div className={styles.actionGroup} style={{ justifyContent: "flex-end", flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          {isReadOnly ? (
                             <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>Terkunci</span>
                          ) : studentGrades.length > 0 ? (
                            <>
                              {studentGrades.map(g => (
                                <div key={g._id} style={{ display: 'flex', gap: '4px', height: '24px', alignItems: 'center' }}>
                                  <button className={styles.btnEdit} onClick={() => handleOpenForm(student, g)} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px' }}>
                                    Edit
                                  </button>
                                  <button className={styles.btnDanger} onClick={() => setDeleteId(g._id)} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px' }}>
                                    Hapus
                                  </button>
                                </div>
                              ))}
                              <button className={styles.btnPrimary} onClick={() => handleOpenForm(student)} style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '10px', background: '#27ae60', marginTop: '4px', fontWeight: 600 }}>
                                + Tambah
                              </button>
                            </>
                          ) : (
                            <button className={styles.btnPrimary} onClick={() => handleOpenForm(student)} style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '12px', fontWeight: 600 }}>
                                Input Nilai
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── FORM MODAL ─── */}
      {formOpen && activeStudent && (
        <div className={styles.overlay} onClick={closeForm}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>{editId ? "Edit Nilai" : "Input Nilai"}</h2>
              <button className={styles.modalClose} onClick={closeForm}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Siswa</label>
                  <input type="text" className={styles.formInput} value={activeStudent.name} disabled style={{ background: '#f5f5f5', color: '#666' }} />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Judul / Nama Tugas</label>
                  <input type="text" className={styles.formInput} placeholder="Contoh: Tugas 1" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
                </div>
              </div>

              <div className={styles.fieldRow} style={{ marginTop: 8 }}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Evaluasi</label>
                  <input type="text" className={styles.formInput} value={`${selectedType} ${selectedType === 'TUGAS' ? `(Mgg ${selectedWeek})` : ''}`} disabled style={{ background: '#f5f5f5', color: '#666' }} />
                </div>
              </div>

              <div className={styles.field} style={{ marginTop: 8 }}>
                <label className={styles.fieldLabel}>Nilai / Score</label>
                <div className={styles.scoreSliderWrap}>
                  <div className={styles.scoreSliderRow}>
                    <input type="range" className={styles.scoreSlider} min="0" max="100" value={formScore} onChange={(e) => setFormScore(parseInt(e.target.value))} style={{ background: `linear-gradient(to right, #c0392b ${formScore}%, #e0e0e0 ${formScore}%)` }} />
                    <div className={styles.scoreDisplay}>{formScore}</div>
                  </div>
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.fieldLabel}>Catatan (Opsional)</label>
                <textarea className={styles.formTextarea} placeholder="Tambahkan feedback..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={closeForm} disabled={submitting}>Batal</button>
              <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Menyimpan..." : "Simpan Nilai"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── DELETE CONFIRM MODAL ─── */}
      {deleteId && (
        <div className={styles.overlay} onClick={() => setDeleteId(null)}>
          <div className={styles.confirmModal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Hapus Data Nilai?</h3>
            <p className={styles.confirmDesc}>Tindakan ini tidak dapat dibatalkan.</p>
            <div className={styles.confirmActions}>
              <button className={styles.btnSecondary} onClick={() => setDeleteId(null)} disabled={submitting}>Batal</button>
              <button className={styles.btnDanger} onClick={handleDelete} disabled={submitting} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px' }}>
                {submitting ? "Menghapus..." : "Ya, Hapus"}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}