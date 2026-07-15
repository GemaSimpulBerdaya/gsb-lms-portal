"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "../attendance.module.css";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentSemester, dateToIso, formatKbmDateShort } from "@/utils/formatters";
import Spinner from "@/components/ui/Spinner/Spinner";
import VolunteerFilterSelect from "@/components/volunteer/VolunteerFilterSelect/VolunteerFilterSelect";
import VolunteerFilterPanel from "@/components/volunteer/VolunteerFilterPanel/VolunteerFilterPanel";
import AdminPagination from "@/components/admin/ui/AdminPagination";

const ROWS_PER_PAGE = 15;

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
    qsWeek ? `${qsWeek}|` : "all"
  );
  
  const [summary, setSummary] = useState<RecapRow[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [statusSort, setStatusSort] = useState("DEFAULT");
  const [currentPage, setCurrentPage] = useState(1);
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
  const attendanceRows = useMemo(
    () => summary.flatMap((meeting) =>
      (meeting.details ?? []).map((student) => ({
        ...student,
        week: meeting.week,
        date: meeting.date,
      })),
    ),
    [summary],
  );
  const visibleRows = useMemo(() => {
    const filtered = statusFilter === "ALL"
      ? attendanceRows
      : attendanceRows.filter((student) => student.status === statusFilter);

    if (statusSort === "DEFAULT") return filtered;

    return [...filtered].sort((a, b) => {
      const comparison = a.status.localeCompare(b.status, "id-ID");
      if (comparison !== 0) return statusSort === "ASC" ? comparison : -comparison;
      return a.name.localeCompare(b.name, "id-ID");
    });
  }, [attendanceRows, statusFilter, statusSort]);
  const totalPages = Math.max(1, Math.ceil(visibleRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedRows = visibleRows.slice(
    (safePage - 1) * ROWS_PER_PAGE,
    safePage * ROWS_PER_PAGE,
  );

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
      const nextSummary: RecapRow[] = data.summary || [];
      setSummary(nextSummary);
      setStatusFilter("ALL");
      setStatusSort("DEFAULT");
      setCurrentPage(1);
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
              setSelectedMeeting("all");
            }}
          />
        </div>

        <div className={`${styles.filterGroup} ${styles.meetingFilter}`}>
          <label className={styles.label}>Pertemuan</label>
          <VolunteerFilterSelect
            options={meetingOptions}
            value={selectedMeeting}
            placeholder="-- Pilih jadwal dulu --"
            onChange={(meeting) => {
              setSelectedMeeting(meeting);
              setCurrentPage(1);
            }}
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
        <section className={styles.recapDetailSection}>
            <div className={styles.recapDetailHeader}>
              <div>
                <h2 className={styles.recapDetailTitle}>Riwayat Kehadiran Siswa</h2>
                <p className={styles.recapDetailMeta}>
                  {visibleRows.length} dari {attendanceRows.length} data presensi
                </p>
              </div>
              <div className={styles.recapDetailFilters}>
                <div className={styles.recapDetailFilter}>
                  <label>Status</label>
                  <VolunteerFilterSelect
                    options={[
                      { value: "ALL", label: "Semua Status" },
                      { value: "HADIR", label: "Hadir" },
                      { value: "ASINKRONUS", label: "Asinkronus" },
                      { value: "IZIN", label: "Izin" },
                      { value: "SAKIT", label: "Sakit" },
                      { value: "ALFA", label: "Alfa" },
                    ]}
                    value={statusFilter}
                    onChange={(status) => {
                      setStatusFilter(status);
                      setCurrentPage(1);
                    }}
                    showSearch={false}
                  />
                </div>
                <div className={styles.recapDetailFilter}>
                  <label>Urutkan</label>
                  <VolunteerFilterSelect
                    options={[
                      { value: "DEFAULT", label: "Urutan Siswa" },
                      { value: "ASC", label: "Status A–Z" },
                      { value: "DESC", label: "Status Z–A" },
                    ]}
                    value={statusSort}
                    onChange={(sort) => {
                      setStatusSort(sort);
                      setCurrentPage(1);
                    }}
                    showSearch={false}
                  />
                </div>
              </div>
            </div>

            <div className={styles.recapDetailTableWrap}>
              <table className={`${styles.table} ${styles.recapHistoryTable}`}>
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Pertemuan</th>
                    <th>Tanggal</th>
                    <th>Nama Siswa</th>
                    <th>Status</th>
                    <th>Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((student, index) => (
                    <tr key={`${student.week}-${student.date}-${student.id || student.name}-${index}`}>
                      <td>{(safePage - 1) * ROWS_PER_PAGE + index + 1}</td>
                      <td>Pekan {student.week}</td>
                      <td>{formatKbmDateShort(student.date)}</td>
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
                      <td className={student.notes ? "" : styles.emptyNotes}>
                        {student.notes || "—"}
                      </td>
                    </tr>
                  ))}
                  {visibleRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.recapDetailEmpty}>
                        Tidak ada siswa dengan status ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {visibleRows.length > ROWS_PER_PAGE && (
              <AdminPagination
                page={safePage}
                totalItems={visibleRows.length}
                itemsPerPage={ROWS_PER_PAGE}
                onPageChange={setCurrentPage}
              />
            )}
          </section>
      ) : (
        !loading && <div className={styles.emptyState}>Belum ada riwayat absensi untuk jadwal ini.</div>
      )}

    </div>
  );
}
