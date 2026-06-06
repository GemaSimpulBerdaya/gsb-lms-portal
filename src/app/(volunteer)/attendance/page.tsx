"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./attendance.module.css";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentSemester, formatSemester, dateToIso, formatKbmDateShort, isFutureDate } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";

type KbmDate = {
  week: number;
  date: string;
  topic?: string;
};

type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  kbmDates?: KbmDate[];
};

type StudentAttendance = {
  _id: string;
  name: string;
  status: string;
  notes: string;
};

export default function AttendancePage() {
  return (
    <Suspense fallback={
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat...</p>
      </div>
    }>
      <AttendanceContent />
    </Suspense>
  );
}

function AttendanceContent() {
  const semesterLabels = useSemesterLabels();
  const searchParams = useSearchParams();

  // Query params dari schedule timeline (auto-fill flow)
  const qsScheduleId = searchParams.get("scheduleId");
  const qsWeek = searchParams.get("week");
  const qsDate = searchParams.get("date");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

  const [week, setWeek] = useState<number>(qsWeek ? parseInt(qsWeek, 10) : 1);
  const [date, setDate] = useState(() => {
    if (qsDate) return qsDate;
    return dateToIso(new Date());
  });
  const [semester, setSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });
  
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Auto-dismiss notif setelah 3 detik (success) / 5 detik (error)
  useEffect(() => {
    if (!message) return;
    const ttl = message.type === "success" ? 3000 : 5000;
    const timer = setTimeout(() => setMessage(null), ttl);
    return () => clearTimeout(timer);
  }, [message]);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      const data = await res.json();
      if (res.ok && data.schedules) {
        setSchedules(data.schedules);
        const derived = Array.from(new Set([...data.schedules.map((s: Schedule) => s.semester), getCurrentSemester()])).sort().reverse();
        setAvailableSemesters(derived);
      }
    } catch (err) {
      console.error("Gagal memuat jadwal", err);
    }
  }, []);

  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          const stored = localStorage.getItem("activeSemester");
          if (data.activeSemester && (!stored || stored === getCurrentSemester())) {
            setSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };

    fetchGlobalSemester();
    const timer = setTimeout(() => {
      fetchSchedules();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSchedules]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", semester);
    }
  }, [semester]);

  useEffect(() => {
    if (schedules.length > 0) {
      const activeSchedules = schedules.filter((s) => s.semester === semester);

      // Helper: pick default pertemuan untuk schedule (activeWeek atau kbmDates[0])
      const pickDefault = (sched: Schedule): { w: number; d: string } | null => {
        const kbm = sched.kbmDates ?? [];
        const target = kbm.find((k) => k.week === sched.activeWeek) ?? kbm[0];
        if (target) {
          return { w: target.week, d: dateToIso(target.date) };
        }
        return null;
      };

      // Priority: query param scheduleId (auto-fill dari timeline) → first active schedule
      if (qsScheduleId) {
        const fromQuery = activeSchedules.find((s) => s._id === qsScheduleId);
        if (fromQuery) {
          const timer = setTimeout(() => {
            setSelectedScheduleId(fromQuery._id);
            // qsWeek/qsDate sudah di-init dari URL → kalau gak ada, fallback default
            if (!qsWeek) {
              const def = pickDefault(fromQuery);
              if (def) {
                setWeek(def.w);
                setDate(def.d);
              } else {
                setWeek(fromQuery.activeWeek || 1);
              }
            }
          }, 0);
          return () => clearTimeout(timer);
        }
      }

      if (activeSchedules.length > 0) {
        const current = activeSchedules[0];
        const timer = setTimeout(() => {
          setSelectedScheduleId(current._id);
          const def = pickDefault(current);
          if (def) {
            setWeek(def.w);
            setDate(def.d);
          } else {
            setWeek(current.activeWeek || 1);
          }
        }, 0);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => setSelectedScheduleId(""), 0);
        return () => clearTimeout(timer);
      }
    }
  }, [semester, schedules, qsScheduleId, qsWeek]);

  const fetchStudents = async () => {
    const sched = schedules.find(s => s._id === selectedScheduleId);
    if (!sched || !week || !semester || !date) {
      setMessage({ type: "error", text: "Mohon lengkapi semua filter (Jadwal, Pekan, Tanggal, Semester)" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/volunteer/attendance?scheduleId=${encodeURIComponent(sched._id)}&week=${week}&date=${date}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil data");
      }

      const formattedStudents = data.data.map((s: { _id: string; name: string; attendance?: { status: string; notes?: string } }) => ({
        _id: s._id,
        name: s.name,
        status: s.attendance?.status || "HADIR",
        notes: s.attendance?.notes || ""
      }));

      setStudents(formattedStudents);
    } catch (err: unknown) {
      setMessage({ type: "error", text: getErrorMessage(err) });
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = (studentId: string, status: string) => {
    setStudents(prev => prev.map(s => s._id === studentId ? { ...s, status } : s));
  };

  const handleNotesChange = (studentId: string, notes: string) => {
    setStudents(prev => prev.map(s => s._id === studentId ? { ...s, notes } : s));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    const attendances = students.map(s => ({
      anakDidikId: s._id,
      status: s.status,
      notes: s.notes
    }));

    try {
      const res = await fetch("/api/volunteer/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId: selectedScheduleId, week, date, attendances })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan absensi");

      setMessage({ type: "success", text: "Absensi berhasil disimpan!" });
    } catch (err: unknown) {
      setMessage({ type: "error", text: getErrorMessage(err) });
    } finally {
      setSaving(false);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Input Absensi Siswa</h1>
        <p className={styles.subtitle}>Kelola daftar kehadiran siswa per pekan dan tanggal pertemuan.</p>
      </div>

      {message && (
        <div style={{
          padding: "12px",
          marginBottom: "20px",
          borderRadius: "8px",
          backgroundColor: message.type === "error" ? "#fdecea" : "#e8f5e9",
          color: message.type === "error" ? "#c0392b" : "#2e7d32",
          border: `1px solid ${message.type === "error" ? "#f5b7b1" : "#a5d6a7"}`,
          fontWeight: 500
        }}>
          {message.text}
        </div>
      )}

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.label}>Jadwal Mengajar</label>
          <select 
            className={styles.select} 
            value={selectedScheduleId} 
            onChange={(e) => {
              setSelectedScheduleId(e.target.value);
              const sched = schedules.find(s => s._id === e.target.value);
              if (sched) {
                setSemester(sched.semester);
                // Auto-pick pertemuan: prioritas activeWeek, fallback first kbmDate
                const kbm = sched.kbmDates ?? [];
                const target = kbm.find((k) => k.week === sched.activeWeek) ?? kbm[0];
                if (target) {
                  setWeek(target.week);
                  setDate(dateToIso(target.date));
                } else {
                  setWeek(sched.activeWeek || 1);
                }
              }
            }}
          >
            <option value="">-- Pilih Jadwal --</option>
            {schedules.map(s => (
              <option key={s._id} value={s._id}>
                {s.region} — {s.fase}
              </option>
            ))}
          </select>
        </div>

        {availableSemesters.length > 1 && (
          <div className={styles.filterGroup}>
            <label className={styles.label}>Semester</label>
            <select 
              className={styles.select} 
              value={semester} 
              onChange={(e) => setSemester(e.target.value)}
            >
              {availableSemesters.length > 0 ? (
                availableSemesters.map(sem => (
                  <option key={sem} value={sem}>{formatSemester(sem, semesterLabels)}</option>
                ))
              ) : (
                <option value={semester}>{formatSemester(semester, semesterLabels)}</option>
              )}
            </select>
          </div>
        )}

        <div className={styles.filterGroup} style={{ flex: 2, minWidth: 240 }}>
          <label className={styles.label}>Pertemuan</label>
          <select
            className={styles.select}
            value={selectedScheduleId && week && date ? `${week}|${date}` : ""}
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const [w, d] = v.split("|");
              setWeek(parseInt(w, 10));
              setDate(d);
            }}
            disabled={!selectedScheduleId}
          >
            {(() => {
              const sched = schedules.find((s) => s._id === selectedScheduleId);
              const list = sched?.kbmDates ?? [];
              if (!sched) return <option value="">-- Pilih jadwal dulu --</option>;
              if (list.length === 0) return <option value="">-- Belum ada pertemuan --</option>;
              const sorted = [...list].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              const monthFmt = new Intl.DateTimeFormat("id-ID", {
                timeZone: "Asia/Jakarta",
                month: "long",
                year: "numeric",
              });
              const groups: { month: string; items: typeof sorted }[] = [];
              for (const k of sorted) {
                const monthLabel = monthFmt.format(new Date(k.date));
                const last = groups[groups.length - 1];
                if (last && last.month === monthLabel) last.items.push(k);
                else groups.push({ month: monthLabel, items: [k] });
              }
              return (
                <>
                  <option value="">-- Pilih Pertemuan --</option>
                  {groups.map((g) => (
                    <optgroup key={g.month} label={g.month}>
                      {g.items.map((k) => {
                        const iso = dateToIso(k.date);
                        const future = isFutureDate(k.date);
                        return (
                          <option key={`${k.week}-${iso}`} value={`${k.week}|${iso}`} disabled={future}>
                            Pekan {k.week} · {formatKbmDateShort(k.date)}
                            {future ? " · belum mulai" : ""}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </>
              );
            })()}
          </select>
        </div>

        <button 
          className={styles.btn} 
          onClick={fetchStudents}
          disabled={loading || !selectedScheduleId}
        >
          {loading ? "Memuat..." : "Tampilkan Data"}
        </button>
      </div>

      {students.length > 0 ? (
        <>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>No</th>
                  <th>Nama Siswa</th>
                  <th>Status Kehadiran</th>
                  <th>Catatan (Opsional)</th>
                </tr>
              </thead>
              <tbody>
                {students.map((student, idx) => (
                  <tr key={student._id}>
                    <td>{idx + 1}</td>
                    <td>{student.name}</td>
                    <td>
                      <div className={styles.radioGroup}>
                        {["HADIR", "IZIN", "SAKIT", "ALFA"].map(status => (
                          <label key={status} className={styles.radioLabel}>
                            <input 
                              type="radio" 
                              name={`status-${student._id}`} 
                              value={status}
                              className={styles.radioInput}
                              checked={student.status === status}
                              onChange={() => handleStatusChange(student._id, status)}
                            />
                            {status}
                          </label>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input 
                        type="text" 
                        className={styles.notesInput}
                        placeholder="Catatan..."
                        value={student.notes}
                        onChange={(e) => handleNotesChange(student._id, e.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className={styles.footer}>
            <button 
              className={styles.saveBtn} 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "Simpan Absensi"}
            </button>
          </div>
        </>
      ) : (
        !loading && <div className={styles.emptyState}>{"Silakan lengkapi filter dan klik \"Tampilkan Data\" untuk mengisi absensi."}</div>
      )}
    </div>
  );
}
