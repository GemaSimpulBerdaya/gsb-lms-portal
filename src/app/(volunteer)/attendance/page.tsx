"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./attendance.module.css";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentSemester, dateToIso, formatKbmDateShort, isFutureDate } from "@/utils/formatters";
import Spinner from "@/components/ui/Spinner/Spinner";
import VolunteerFilterSelect from "@/components/volunteer/VolunteerFilterSelect/VolunteerFilterSelect";
import VolunteerFilterPanel from "@/components/volunteer/VolunteerFilterPanel/VolunteerFilterPanel";

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
    return getCurrentSemester();
  });
  
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const activeSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.semester === semester),
    [schedules, semester],
  );
  const selectedSchedule = schedules.find(
    (schedule) => schedule._id === selectedScheduleId,
  );
  const meetingOptions = useMemo(() => {
    const meetings = selectedSchedule?.kbmDates ?? [];
    const monthFormatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      month: "long",
      year: "numeric",
    });

    return [...meetings]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((meeting) => {
        const isoDate = dateToIso(meeting.date);
        const isFuture = isFutureDate(meeting.date);
        return {
          value: `${meeting.week}|${isoDate}`,
          label: `${monthFormatter.format(new Date(meeting.date))} — Pekan ${meeting.week} · ${formatKbmDateShort(meeting.date)}${isFuture ? " · belum mulai" : ""}`,
          disabled: isFuture,
        };
      });
  }, [selectedSchedule]);

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
          if (data.activeSemester) {
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

  const fetchStudents = useCallback(async () => {
    const sched = schedules.find(s => s._id === selectedScheduleId);
    if (!sched || !week || !semester || !date) {
      setMessage({ type: "error", text: "Mohon pilih jadwal dan pertemuan terlebih dahulu." });
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
  }, [schedules, selectedScheduleId, week, semester, date]);

  // Auto-fetch if selected meeting changes and all dependencies are valid
  useEffect(() => {
    if (selectedScheduleId && week && date && semester) {
      fetchStudents();
    }
  }, [selectedScheduleId, week, date, semester, fetchStudents]);

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
      studentId: s._id,
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

      <VolunteerFilterPanel title="Filter Presensi">
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label className={styles.label}>Jadwal Mengajar</label>
            <VolunteerFilterSelect
              options={activeSchedules.map((schedule) => ({
                value: schedule._id,
                label: `${schedule.region} — ${schedule.fase}`,
              }))}
              value={selectedScheduleId}
              placeholder="-- Pilih Jadwal --"
              onChange={(scheduleId) => {
                setSelectedScheduleId(scheduleId);
                const sched = schedules.find((schedule) => schedule._id === scheduleId);
                if (sched) {
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
            />
          </div>

          <div className={styles.filterGroup} style={{ flex: 2, minWidth: 240 }}>
            <label className={styles.label}>Pertemuan</label>
            <VolunteerFilterSelect
              options={meetingOptions}
              value={selectedScheduleId && week && date ? `${week}|${date}` : ""}
              placeholder={
                !selectedScheduleId
                  ? "-- Pilih jadwal dulu --"
                  : meetingOptions.length === 0
                    ? "-- Belum ada pertemuan --"
                    : "-- Pilih Pertemuan --"
              }
              onChange={(meetingValue) => {
                const [w, d] = meetingValue.split("|");
                setWeek(parseInt(w, 10));
                setDate(d);
              }}
              disabled={!selectedScheduleId}
            />
          </div>

          <button
            className={styles.btn}
            onClick={fetchStudents}
            disabled={loading || !selectedScheduleId}
            title="Refresh Data"
          >
            {loading ? (
              <Spinner size="sm" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 2v6h-6" />
                <path d="M3 12a9 9 0 1 0 2.6-6.4L2 9" />
              </svg>
            )}
          </button>
        </div>
      </VolunteerFilterPanel>

      {loading ? (
        <div className={styles.loading}>
          <Spinner />
          <p>Memuat data...</p>
        </div>
      ) : students.length > 0 ? (
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
                        {["HADIR", "ASINKRONUS", "IZIN", "SAKIT", "ALFA"].map(status => (
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
