"use client";

import { useState, useEffect } from "react";
import styles from "./attendance.module.css";

export default function AttendancePage() {
  const [region, setRegion] = useState("");
  const [level, setLevel] = useState("TK");
  const [week, setWeek] = useState<number>(1);
  const [semester, setSemester] = useState("");
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    // Auto-set current semester
    const d = new Date();
    setSemester(`${d.getFullYear()}-1`);

    // Load region from user session in localStorage
    try {
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        if (user.region) setRegion(user.region);
      }
    } catch (e) {
      console.error("Failed to parse user from localStorage", e);
    }
  }, []);

  const fetchStudents = async () => {
    if (!region || !level || !week || !semester) {
      setMessage({ type: "error", text: "Mohon lengkapi semua filter (Region, Level, Minggu, Semester)" });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/volunteer/attendance?region=${encodeURIComponent(region)}&level=${encodeURIComponent(level)}&week=${week}&semester=${encodeURIComponent(semester)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil data");
      }

      // Initialize status for UI
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
        body: JSON.stringify({ week, semester, attendances })
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
        <h1 className={styles.title}>Absensi Siswa</h1>
        <p className={styles.subtitle}>Pilih region, level, dan minggu untuk mengisi kehadiran anak didik.</p>
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
          <label className={styles.label}>Region</label>
          <input 
            type="text" 
            className={styles.input} 
            value={region} 
            onChange={(e) => setRegion(e.target.value)}
            placeholder="Contoh: Depok"
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label}>Level</label>
          <select className={styles.select} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="DISABILITAS">DISABILITAS</option>
            <option value="TK">TK</option>
            <option value="SD">SD</option>
            <option value="SMP">SMP</option>
          </select>
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label}>Semester</label>
          <input 
            type="text" 
            className={styles.input} 
            value={semester} 
            onChange={(e) => setSemester(e.target.value)}
            placeholder="Contoh: 2024-1"
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label}>Minggu Ke-</label>
          <input 
            type="number" 
            className={styles.input} 
            value={week} 
            min={1}
            onChange={(e) => setWeek(parseInt(e.target.value) || 1)}
          />
        </div>

        <button 
          className={styles.btn} 
          onClick={fetchStudents}
          disabled={loading}
        >
          {loading ? "Memuat..." : "Tampilkan Siswa"}
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
        !loading && <div className={styles.emptyState}>Silakan klik "Tampilkan Siswa" untuk mengisi absensi.</div>
      )}
    </div>
  );
}
