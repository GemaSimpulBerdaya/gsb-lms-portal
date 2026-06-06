"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../attendance.module.css";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentSemester, formatSemester, dateToIso, formatKbmDateShort } from "@/utils/formatters";
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

type StudentRecapDetail = {
  id?: string;
  name: string;
  status: string;
  notes?: string;
};

type RecapRow = {
  week: number;
  date: string;
  total: number;
  hadir: number;
  izin: number;
  sakit: number;
  alfa: number;
  details: StudentRecapDetail[];
};

export default function RecapAttendancePage() {
  return (
    <Suspense fallback={
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat...</p>
      </div>
    }>
      <RecapAttendanceContent />
    </Suspense>
  );
}

function RecapAttendanceContent() {
  const semesterLabels = useSemesterLabels();
  const searchParams = useSearchParams();
  const qsScheduleId = searchParams.get("scheduleId");
  const qsWeek = searchParams.get("week");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [semester, setSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });
  const [selectedMeeting, setSelectedMeeting] = useState<string>(
    qsWeek ? `${qsWeek}|` : ""
  );
  
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [summary, setSummary] = useState<RecapRow[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<RecapRow | null>(null);
  const [loading, setLoading] = useState(false);
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
      // Kalau dari timeline (ada qsScheduleId) → prioritize itu
      if (qsScheduleId && schedules.some((s) => s._id === qsScheduleId)) {
        const sched = schedules.find((s) => s._id === qsScheduleId);
        if (sched) {
          // Defer setState ke microtask untuk avoid set-state-in-effect warning
          Promise.resolve().then(() => {
            setSelectedScheduleId(qsScheduleId);
            setSemester(sched.semester);
            // Kalau qsWeek juga ada, set selectedMeeting ke entry kbmDate yang match
            if (qsWeek) {
              const w = parseInt(qsWeek, 10);
              const kbm = sched.kbmDates?.find((k) => k.week === w);
              if (kbm) {
                setSelectedMeeting(`${w}|${dateToIso(kbm.date)}`);
              } else {
                setSelectedMeeting(`${w}|`);
              }
            }
          });
        }
        return;
      }
      const activeSchedules = schedules.filter((s: { semester: string; _id: string }) => s.semester === semester);
      if (activeSchedules.length > 0) {
        const current = activeSchedules[0];
        const timer = setTimeout(() => {
          setSelectedScheduleId(current._id);
        }, 0);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => setSelectedScheduleId(""), 0);
        return () => clearTimeout(timer);
      }
    }
  }, [semester, schedules, qsScheduleId, qsWeek]);

  const fetchSummary = useCallback(async () => {
    const sched = schedules.find(s => s._id === selectedScheduleId);
    if (!sched || !semester) {
      setMessage({ type: "error", text: "Mohon pilih Jadwal dan Semester" });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      let url = `/api/volunteer/attendance/recap?scheduleId=${encodeURIComponent(sched._id)}`;
      // selectedMeeting format: "week|iso" — kalau "all" / kosong → semua pertemuan
      if (selectedMeeting && selectedMeeting !== "all") {
        const [w, d] = selectedMeeting.split("|");
        if (w) url += `&week=${w}`;
        if (d) url += `&date=${d}`;
      }
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal mengambil data riwayat");
      setSummary(data.summary || []);
    } catch (err: unknown) {
      setMessage({ type: "error", text: getErrorMessage(err) });
      setSummary([]);
    } finally {
      setLoading(false);
    }
  }, [schedules, selectedScheduleId, semester, selectedMeeting]);

  // Auto-fetch summary kalau di-trigger dari timeline (ada qsScheduleId)
  const autoFetchedRef = useRef(false);
  useEffect(() => {
    if (autoFetchedRef.current) return;
    if (!qsScheduleId) return;
    if (!selectedScheduleId || selectedScheduleId !== qsScheduleId) return;
    if (!semester) return;
    autoFetchedRef.current = true;
    // microtask defer biar state stable dulu
    Promise.resolve().then(() => fetchSummary());
  }, [selectedScheduleId, semester, qsScheduleId, fetchSummary]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Riwayat Absensi</h1>
        <p className={styles.subtitle}>Rekapitulasi kehadiran siswa berdasarkan jadwal mengajar.</p>
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
            value={selectedMeeting}
            onChange={(e) => setSelectedMeeting(e.target.value)}
            disabled={!selectedScheduleId}
          >
            {(() => {
              const sched = schedules.find((s) => s._id === selectedScheduleId);
              const list = sched?.kbmDates ?? [];
              if (!sched) return <option value="">-- Pilih jadwal dulu --</option>;
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
                  <option value="all">Semua Pertemuan</option>
                  {groups.map((g) => (
                    <optgroup key={g.month} label={g.month}>
                      {g.items.map((k) => {
                        const iso = dateToIso(k.date);
                        return (
                          <option key={`${k.week}-${iso}`} value={`${k.week}|${iso}`}>
                            Pekan {k.week} · {formatKbmDateShort(k.date)}
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
                  {selectedDetails.details && selectedDetails.details.map((student, index) => (
                    <tr key={student.id || index}>
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
