"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../attendance.module.css";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentSemester, dateToIso, formatKbmDateShort } from "@/utils/formatters";
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
  asinkronus: number;
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
  const searchParams = useSearchParams();
  const qsScheduleId = searchParams.get("scheduleId");
  const qsWeek = searchParams.get("week");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [semester, setSemester] = useState(() => {
    return getCurrentSemester();
  });
  const [selectedMeeting, setSelectedMeeting] = useState<string>(
    qsWeek ? `${qsWeek}|` : ""
  );
  
  const [summary, setSummary] = useState<RecapRow[]>([]);
  const [selectedDetails, setSelectedDetails] = useState<RecapRow | null>(null);
  const [loading, setLoading] = useState(false);
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

    return [
      { value: "all", label: "Semua Pertemuan" },
      ...[...meetings]
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map((meeting) => ({
          value: `${meeting.week}|${dateToIso(meeting.date)}`,
          label: `${monthFormatter.format(new Date(meeting.date))} — Pekan ${meeting.week} · ${formatKbmDateShort(meeting.date)}`,
        })),
    ];
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
      // Kalau dari timeline (ada qsScheduleId) → prioritize itu
      if (qsScheduleId && schedules.some((s) => s._id === qsScheduleId && s.semester === semester)) {
        const sched = schedules.find((s) => s._id === qsScheduleId);
        if (sched) {
          // Defer setState ke microtask untuk avoid set-state-in-effect warning
          Promise.resolve().then(() => {
            setSelectedScheduleId(qsScheduleId);
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
      setMessage({ type: "error", text: "Mohon pilih jadwal terlebih dahulu." });
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

  // Auto-fetch summary if required inputs are present
  useEffect(() => {
    if (selectedScheduleId && semester) {
      fetchSummary();
    }
  }, [selectedScheduleId, semester, selectedMeeting, fetchSummary]);

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

      <VolunteerFilterPanel title="Filter Riwayat Presensi">
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
            }}
          />
        </div>

        <div className={styles.filterGroup} style={{ flex: 2, minWidth: 240 }}>
          <label className={styles.label}>Pertemuan</label>
          <VolunteerFilterSelect
            options={meetingOptions}
            value={selectedMeeting}
            placeholder="-- Pilih jadwal dulu --"
            onChange={setSelectedMeeting}
            disabled={!selectedScheduleId}
          />
        </div>

        <button 
          className={styles.btn} 
          onClick={fetchSummary}
          disabled={loading || !selectedScheduleId}
          title="Refresh Rekap"
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
          <p>Memuat rekap...</p>
        </div>
      ) : summary.length > 0 ? (
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
                      {row.asinkronus > 0 && <span className={`${styles.badge} ${styles.badgeAsinkronus}`} title="Asinkronus">{row.asinkronus} ASN</span>}
                      
                      {row.hadir === 0 && row.izin === 0 && row.sakit === 0 && row.alfa === 0 && row.asinkronus === 0 && (
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
                          student.status === "ALFA" ? styles.badgeAlfa :
                          student.status === "ASINKRONUS" ? styles.badgeAsinkronus :
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
