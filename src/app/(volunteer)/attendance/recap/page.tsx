"use client";

import { useState, useEffect } from "react";
import styles from "../attendance.module.css";

type Schedule = {
  _id: string;
  region: string;
  level: string;
  semester: string;
  activeWeek: number;
};

const getCurrentSemester = () => {
  const d = new Date();
  return `${d.getFullYear()}-1`;
};

const formatSemester = (sem: string) => {
  if (!sem) return "-";
  const parts = sem.split("-");
  if (parts.length < 2) return sem;
  return `Semester ${parts[1]} - ${parts[0]}`;
};

export default function RecapAttendancePage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [semester, setSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [summary, setSummary] = useState<any[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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
      } else {
        setSelectedScheduleId("");
      }
    }
  }, [semester, schedules]);

  const fetchSummary = async () => {
    const sched = schedules.find(s => s._id === selectedScheduleId);
    if (!sched || !semester) {
      setMessage({ type: "error", text: "Mohon pilih Jadwal dan Semester" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      let url = `/api/volunteer/attendance/recap?region=${encodeURIComponent(sched.region)}&semester=${encodeURIComponent(semester)}`;
      if (selectedWeek) {
        url += `&week=${selectedWeek}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil data riwayat");
      setSummary(data.summary || []);
    } catch (err: any) {
      setMessage({ type: "error", text: err.message });
      setSummary([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Riwayat Absensi</h1>
        <p className={styles.subtitle}>Rekapitulasi kehadiran anak didik berdasarkan jadwal mengajar.</p>
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
          <label className={styles.label}>Pekan Ke- (Opsional)</label>
          <input 
            type="number" 
            className={styles.input} 
            value={selectedWeek} 
            onChange={(e) => setSelectedWeek(e.target.value)}
            placeholder="Semua"
            min={1}
          />
        </div>

        <button 
          className={styles.btn} 
          onClick={fetchSummary}
          disabled={loading || !selectedScheduleId}
        >
          {loading ? "Memuat..." : "Tampilkan Rekap"}
        </button>
      </div>

      {summary.length > 0 ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>No</th>
                <th>Pekan Ke-</th>
                <th>Tanggal Pertemuan</th>
                <th>Total Siswa</th>
                <th>Statistik Kehadiran</th>
                <th style={{ textAlign: "center" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {summary.map((row, idx) => (
                <tr key={`${row.week}-${row.date}`}>
                  <td>{idx + 1}</td>
                  <td>Pekan {row.week}</td>
                  <td>{new Date(row.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td>
                  <td>{row.total}</td>
                  <td>
                    <div className={styles.statCell}>
                      {row.hadir > 0 && <span className={`${styles.badge} ${styles.badgeHadir}`} title="Hadir">{row.hadir} H</span>}
                      {row.izin > 0 && <span className={`${styles.badge} ${styles.badgeIzin}`} title="Izin">{row.izin} I</span>}
                      {row.sakit > 0 && <span className={`${styles.badge} ${styles.badgeSakit}`} title="Sakit">{row.sakit} S</span>}
                      {row.alfa > 0 && <span className={`${styles.badge} ${styles.badgeAlfa}`} title="Alfa">{row.alfa} A</span>}
                      
                      {row.hadir === 0 && row.izin === 0 && row.sakit === 0 && row.alfa === 0 && (
                        <span style={{ color: "#999", fontSize: "13px" }}>Belum ada data</span>
                      )}
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button 
                      className={styles.btnSmall}
                      onClick={() => setSelectedDetails(row)}
                    >
                      Lihat Detail
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !loading && <div className={styles.emptyState}>Belum ada riwayat absensi untuk jadwal ini.</div>
      )}

      {selectedDetails && (
        <div className={styles.overlay} onClick={() => setSelectedDetails(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>Detail Absensi</h3>
                <p style={{ margin: "4px 0 0 0", color: "#666", fontSize: "14px" }}>
                  Pekan {selectedDetails.week} — {new Date(selectedDetails.date).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button className={styles.modalClose} onClick={() => setSelectedDetails(null)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
            <div className={styles.modalBody}>
              <table className={styles.table} style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama Siswa</th>
                    <th>Status</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedDetails.details && selectedDetails.details.map((student: any, index: number) => (
                    <tr key={student.id}>
                      <td>{index + 1}</td>
                      <td>{student.name}</td>
                      <td>
                        <span className={`${styles.badge} ${
                          student.status === "HADIR" ? styles.badgeHadir :
                          student.status === "IZIN" ? styles.badgeIzin :
                          student.status === "SAKIT" ? styles.badgeSakit :
                          styles.badgeAlfa
                        }`}>
                          {student.status}
                        </span>
                      </td>
                      <td style={{ color: student.notes ? "#333" : "#aaa", fontStyle: student.notes ? "normal" : "italic" }}>
                        {student.notes || "-"}
                      </td>
                    </tr>
                  ))}
                  {(!selectedDetails.details || selectedDetails.details.length === 0) && (
                    <tr>
                      <td colSpan={4} style={{ textAlign: "center", color: "#888" }}>Data kosong.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
