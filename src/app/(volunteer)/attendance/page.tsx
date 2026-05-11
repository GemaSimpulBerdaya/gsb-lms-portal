"use client";

import { useState, useEffect } from "react";
import styles from "./attendance.module.css";

type Schedule = {
  _id: string;
  region: string;
  level: string;
  semester: string;
  activeWeek: number;
};

export default function AttendancePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

  const [week, setWeek] = useState<number>(1);
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [semester, setSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });
  
  const [students, setStudents] = useState<any[]>([]);
  
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const formatSemester = (sem: string) => {
    if (!sem) return "-";
    const parts = sem.split("-");
    if (parts.length < 2) return sem;
    return `Semester ${parts[1]} - ${parts[0]}`;
  };

  const getCurrentSemester = () => {
    const d = new Date();
    return `${d.getFullYear()}-1`;
  };

  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.availableSemesters) {
            setAvailableSemesters(data.availableSemesters);
          }
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
    fetchSchedules();
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", semester);
    }
  }, [semester]);

  const fetchSchedules = async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      const data = await res.json();
      if (res.ok && data.schedules) {
        setSchedules(data.schedules);
      }
    } catch (err) {
      console.error("Gagal memuat jadwal", err);
    }
  };

  useEffect(() => {
    if (schedules.length > 0) {
      const activeSchedules = schedules.filter((s: any) => s.semester === semester);
      if (activeSchedules.length > 0) {
        const current = activeSchedules[0];
        setSelectedScheduleId(current._id);
        setWeek(current.activeWeek || 1);
      } else {
        setSelectedScheduleId("");
      }
    }
  }, [semester, schedules]);

  const fetchStudents = async () => {
    const sched = schedules.find(s => s._id === selectedScheduleId);
    if (!sched || !week || !semester || !date) {
      setMessage({ type: "error", text: "Mohon lengkapi semua filter (Jadwal, Pekan, Tanggal, Semester)" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/volunteer/attendance?region=${encodeURIComponent(sched.region)}&level=${encodeURIComponent(sched.level)}&week=${week}&semester=${encodeURIComponent(semester)}&date=${date}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil data");
      }

      const formattedStudents = data.data.map((s: any) => ({
        ...s,
        status: s.attendance?.status || "HADIR",
        notes: s.attendance?.notes || ""
      }));

      setStudents(formattedStudents);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
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
        body: JSON.stringify({ week, semester, date, attendances })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan absensi");

      setMessage({ type: "success", text: "Absensi berhasil disimpan!" });
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
    } finally {
      setSaving(false);
      window.scrollTo(0, 0);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Input Absensi Siswa</h1>
        <p className={styles.subtitle}>Kelola daftar kehadiran anak didik per pekan dan tanggal pertemuan.</p>
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
                setWeek(sched.activeWeek || 1);
              }
            }}
          >
            <option value="">-- Pilih Jadwal --</option>
            {schedules.map(s => (
              <option key={s._id} value={s._id}>
                {s.region} — {s.level}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label}>Semester</label>
          <select 
            className={styles.select} 
            value={semester} 
            onChange={(e) => setSemester(e.target.value)}
          >
            {availableSemesters.length > 0 ? (
              availableSemesters.map(sem => (
                <option key={sem} value={sem}>{formatSemester(sem)}</option>
              ))
            ) : (
              <option value={semester}>{formatSemester(semester)}</option>
            )}
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label}>Pekan Ke-</label>
          <input 
            type="number" 
            className={styles.input} 
            value={week} 
            min={1}
            onChange={(e) => setWeek(parseInt(e.target.value) || 1)}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label}>Tanggal Pertemuan</label>
          <input 
            type="date" 
            className={styles.input} 
            value={date} 
            onChange={(e) => setDate(e.target.value)}
          />
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
        !loading && <div className={styles.emptyState}>Silakan lengkapi filter dan klik "Tampilkan Data" untuk mengisi absensi.</div>
      )}
    </div>
  );
}
