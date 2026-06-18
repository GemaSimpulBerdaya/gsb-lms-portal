"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock3,
  Download,
  ListChecks,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import { formatFaseLabel, formatSemester } from "@/utils/formatters";
import styles from "./studentAttendance.module.css";

type AttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS";

type AttendanceDay = {
  week: number;
  date: string;
  status: AttendanceStatus;
  notes?: string;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
};

type AttendanceSummary = {
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALFA: number;
  ASINKRONUS?: number;
  total: number;
};

type StudentAttendance = {
  _id: string;
  name: string;
  fase: string;
  region: string;
  profile?: { studentCode?: string };
  studentCode?: string;
  attendanceSummary: AttendanceSummary;
  attendanceDays?: AttendanceDay[];
  kehadiran?: {
    totalLuring: number;
    hadirPct: number;
    target: number;
  };
};

type SettingsResponse = {
  activeSemester?: string;
  availableSemesters?: string[];
  availableRegions?: string[];
  availableLevels?: string[];
};

const STATUS_LABEL: Record<AttendanceStatus, string> = {
  HADIR: "Hadir",
  IZIN: "Izin",
  SAKIT: "Sakit",
  ALFA: "Alfa",
  ASINKRONUS: "Asinkronus",
};

const STATUS_ORDER: AttendanceStatus[] = [
  "HADIR",
  "IZIN",
  "SAKIT",
  "ALFA",
  "ASINKRONUS",
];

function getStudentCode(student: StudentAttendance) {
  return student.profile?.studentCode || student.studentCode || "-";
}

function formatDate(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getHadirPct(student: StudentAttendance) {
  if (typeof student.kehadiran?.hadirPct === "number") {
    return student.kehadiran.hadirPct;
  }
  const totalLuring =
    student.attendanceSummary.total - (student.attendanceSummary.ASINKRONUS ?? 0);
  return totalLuring > 0
    ? Math.round((student.attendanceSummary.HADIR / totalLuring) * 100)
    : 0;
}

function getLastAttendance(student: StudentAttendance) {
  const days = student.attendanceDays ?? [];
  if (days.length === 0) return null;
  return [...days].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )[0];
}

function safeSheetValue(value: string | number | undefined) {
  if (value === undefined || value === "") return "-";
  return value;
}

function pickColor(str: string) {
  const colors = ["#2d5a27", "#f58220", "#2563eb", "#7c3aed", "#0f766e", "#b45309"];
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export default function StudentAttendancePage() {
  const semesterLabels = useSemesterLabels();
  const [students, setStudents] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedSemester, setSelectedSemester] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedStudent, setSelectedStudent] = useState<StudentAttendance | null>(null);

  const itemsPerPage = 12;

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) return;
      const data = (await res.json()) as SettingsResponse;
      setAvailableSemesters(data.availableSemesters ?? []);
      setAvailableRegions(data.availableRegions ?? []);
      setAvailableLevels(data.availableLevels ?? []);
      if (data.activeSemester) setSelectedSemester(data.activeSemester);
    } catch (err) {
      console.error("Fetch attendance settings error:", err);
    }
  }, []);

  const fetchAttendance = useCallback(async () => {
    if (!selectedSemester) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({
        semester: selectedSemester,
        region: selectedRegion,
        level: selectedLevel,
      });
      const res = await fetch(`/api/admin/grades?${query.toString()}`, {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Gagal mengambil rekap absensi siswa");
        setStudents([]);
        return;
      }
      const sorted = ((body.data ?? []) as StudentAttendance[]).sort((a, b) =>
        a.name.localeCompare(b.name),
      );
      setStudents(sorted);
    } catch (err) {
      console.error("Fetch student attendance error:", err);
      setError("Gagal mengambil rekap absensi siswa");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester, selectedRegion, selectedLevel]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchSettings();
    });
  }, [fetchSettings]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchAttendance();
    });
  }, [fetchAttendance]);

  const uniqueRegions = useMemo(() => {
    const active = students
      .map((student) => student.region)
      .filter((region): region is string => Boolean(region));
    return Array.from(new Set([...availableRegions, ...active])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [students, availableRegions]);

  const uniqueLevels = useMemo(() => {
    const active = students
      .map((student) => student.fase)
      .filter((fase): fase is string => Boolean(fase));
    return Array.from(new Set([...availableLevels, ...active])).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [students, availableLevels]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter((student) => {
      return (
        student.name.toLowerCase().includes(q) ||
        student.region.toLowerCase().includes(q) ||
        student.fase.toLowerCase().includes(q) ||
        getStudentCode(student).toLowerCase().includes(q)
      );
    });
  }, [students, search]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [filteredStudents]);

  const paginatedStudents = filteredStudents.slice(
    (page - 1) * itemsPerPage,
    page * itemsPerPage,
  );

  const totals = useMemo(() => {
    return filteredStudents.reduce(
      (acc, student) => {
        const summary = student.attendanceSummary;
        acc.students += 1;
        acc.total += summary.total;
        acc.HADIR += summary.HADIR;
        acc.IZIN += summary.IZIN;
        acc.SAKIT += summary.SAKIT;
        acc.ALFA += summary.ALFA;
        acc.ASINKRONUS += summary.ASINKRONUS ?? 0;
        acc.notes += (student.attendanceDays ?? []).filter((day) =>
          Boolean(day.notes?.trim()),
        ).length;
        return acc;
      },
      {
        students: 0,
        total: 0,
        HADIR: 0,
        IZIN: 0,
        SAKIT: 0,
        ALFA: 0,
        ASINKRONUS: 0,
        notes: 0,
      },
    );
  }, [filteredStudents]);

  const totalLuring = totals.total - totals.ASINKRONUS;
  const hadirPct =
    totalLuring > 0 ? Math.round((totals.HADIR / totalLuring) * 100) : 0;

  const handleExportExcel = () => {
    if (filteredStudents.length === 0) {
      setError("Tidak ada data absensi untuk diekspor");
      return;
    }

    const summaryRows = filteredStudents.map((student) => {
      const summary = student.attendanceSummary;
      const last = getLastAttendance(student);
      return {
        "No. Induk": getStudentCode(student),
        "Nama Siswa": student.name,
        Fase: formatFaseLabel(student.fase),
        "Lokasi Belajar": student.region || "-",
        Hadir: summary.HADIR,
        Izin: summary.IZIN,
        Sakit: summary.SAKIT,
        Alfa: summary.ALFA,
        Asinkronus: summary.ASINKRONUS ?? 0,
        "Total Presensi": summary.total,
        "Persentase Kehadiran": `${getHadirPct(student)}%`,
        "Status Terakhir": last ? STATUS_LABEL[last.status] : "-",
        "Pekan Terakhir": last?.week ?? "-",
        "Tanggal Terakhir": last ? formatDate(last.date) : "-",
        "Catatan Terakhir": safeSheetValue(last?.notes?.trim()),
      };
    });

    const detailRows = filteredStudents.flatMap((student) =>
      (student.attendanceDays ?? []).map((day) => ({
        "No. Induk": getStudentCode(student),
        "Nama Siswa": student.name,
        Fase: formatFaseLabel(student.fase),
        "Lokasi Belajar": student.region || "-",
        Pekan: day.week,
        Tanggal: formatDate(day.date),
        Status: STATUS_LABEL[day.status] ?? day.status,
        Catatan: safeSheetValue(day.notes?.trim()),
      })),
    );

    const wb = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const detailSheet = XLSX.utils.json_to_sheet(
      detailRows.length > 0
        ? detailRows
        : [{ Info: "Tidak ada detail absensi sesuai filter" }],
    );
    summarySheet["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 8 },
      { wch: 12 },
      { wch: 14 },
      { wch: 20 },
      { wch: 16 },
      { wch: 14 },
      { wch: 16 },
      { wch: 32 },
    ];
    detailSheet["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 18 },
      { wch: 22 },
      { wch: 8 },
      { wch: 16 },
      { wch: 14 },
      { wch: 40 },
    ];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Rekap Absensi");
    XLSX.utils.book_append_sheet(wb, detailSheet, "Detail Absensi");

    const stamp = new Date().toISOString().slice(0, 10);
    const semester = selectedSemester || "semester";
    XLSX.writeFile(wb, `Rekap Absensi Siswa ${semester} ${stamp}.xlsx`);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Rekap Absensi Siswa</h1>
        <p className={styles.subtitle}>
          Rekapitulasi presensi siswa per semester, lokasi belajar, dan fase.
        </p>
      </header>

      <section className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <Search size={16} />
          <input
            type="text"
            placeholder="Cari nama, No. Induk, lokasi, atau fase"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className={styles.searchInput}
          />
        </div>
        <AdminFilterSelect
          width="md"
          value={selectedSemester}
          onChange={setSelectedSemester}
          options={availableSemesters.map((semester) => ({
            value: semester,
            label: formatSemester(semester, semesterLabels),
          }))}
        />
        <AdminFilterSelect
          width="lg"
          value={selectedRegion === "ALL" ? "" : selectedRegion}
          onChange={(value) => setSelectedRegion(value || "ALL")}
          placeholder="Semua Lokasi Belajar"
          clearable
          clearLabel="Semua Lokasi Belajar"
          options={uniqueRegions.map((region) => ({ value: region, label: region }))}
        />
        <AdminFilterSelect
          width="lg"
          value={selectedLevel === "ALL" ? "" : selectedLevel}
          onChange={(value) => setSelectedLevel(value || "ALL")}
          placeholder="Semua Fase dan Kelas"
          clearable
          clearLabel="Semua Fase dan Kelas"
          options={uniqueLevels.map((fase) => ({
            value: fase,
            label: formatFaseLabel(fase),
          }))}
        />
        <button
          type="button"
          className={styles.refreshBtn}
          onClick={fetchAttendance}
          disabled={loading || !selectedSemester}
          title="Muat ulang data absensi"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          type="button"
          className={styles.exportBtn}
          onClick={handleExportExcel}
          disabled={loading || filteredStudents.length === 0}
          title="Export rekap absensi ke Excel"
        >
          <Download size={14} />
          Export
        </button>
      </section>

      <section className={styles.stats} aria-label="Ringkasan absensi siswa">
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <Users size={14} /> Siswa
          </div>
          <div className={styles.statValue}>{totals.students}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <CalendarCheck size={14} /> Total Presensi
          </div>
          <div className={styles.statValue}>{totals.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <CheckCircle2 size={14} /> Hadir
          </div>
          <div className={styles.statValue}>{totals.HADIR}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <Clock3 size={14} /> Kehadiran
          </div>
          <div className={styles.statValue}>{hadirPct}%</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <ListChecks size={14} /> Catatan Terisi
          </div>
          <div className={styles.statValue}>{totals.notes}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>
            <AlertTriangle size={14} /> Alfa
          </div>
          <div className={styles.statValue}>{totals.ALFA}</div>
        </div>
      </section>

      {error && <div className={styles.inlineError}>{error}</div>}

      <section className={styles.tableCard}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat rekap absensi siswa...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className={styles.empty}>
            Belum ada data absensi siswa sesuai filter.
          </div>
        ) : (
          <div className={styles.scrollArea}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Fase</th>
                  <th>Hadir</th>
                  <th>Izin</th>
                  <th>Sakit</th>
                  <th>Alfa</th>
                  <th>Asinkronus</th>
                  <th>Kehadiran</th>
                  <th>Terakhir</th>
                  <th>Catatan Terakhir</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const summary = student.attendanceSummary;
                  const last = getLastAttendance(student);
                  const pct = getHadirPct(student);
                  return (
                    <tr key={student._id}>
                      <td>
                        <div className={styles.studentCell}>
                          <div
                            className={styles.avatar}
                            style={{ background: pickColor(student.name) }}
                          >
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.studentText}>
                            <span className={styles.studentName}>{student.name}</span>
                            <span className={styles.studentMeta}>
                              {getStudentCode(student)} - {student.region}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>{formatFaseLabel(student.fase)}</td>
                      <td className={styles.numberCell}>{summary.HADIR}</td>
                      <td className={styles.numberCell}>{summary.IZIN}</td>
                      <td className={styles.numberCell}>{summary.SAKIT}</td>
                      <td className={styles.numberCell}>{summary.ALFA}</td>
                      <td className={styles.numberCell}>{summary.ASINKRONUS ?? 0}</td>
                      <td>
                        <div className={styles.progressCell}>
                          <div className={styles.progressTrack}>
                            <span style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <strong>{pct}%</strong>
                        </div>
                      </td>
                      <td>
                        {last ? (
                          <div className={styles.lastCell}>
                            <span
                              className={`${styles.statusBadge} ${styles[`status${last.status}`]}`}
                            >
                              {STATUS_LABEL[last.status] ?? last.status}
                            </span>
                            <small>
                              P{last.week} - {formatDate(last.date)}
                            </small>
                          </div>
                        ) : (
                          <span className={styles.muted}>-</span>
                        )}
                      </td>
                      <td>
                        <span className={styles.noteCell}>
                          {last?.notes?.trim() || "-"}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.detailBtn}
                          onClick={() => setSelectedStudent(student)}
                        >
                          <ListChecks size={14} />
                          Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AdminPagination
        page={page}
        totalItems={filteredStudents.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
      />

      {selectedStudent && (
        <>
          <div
            className={styles.drawerOverlay}
            onClick={() => setSelectedStudent(null)}
          />
          <aside className={styles.drawer} aria-label="Detail absensi siswa">
            <div className={styles.drawerHeader}>
              <div>
                <h2>{selectedStudent.name}</h2>
                <p>
                  {formatFaseLabel(selectedStudent.fase)} - {selectedStudent.region}
                </p>
              </div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => setSelectedStudent(null)}
                aria-label="Tutup detail"
              >
                <X size={18} />
              </button>
            </div>
            <div className={styles.drawerBody}>
              <div className={styles.drawerSummary}>
                {STATUS_ORDER.map((status) => (
                  <div key={status} className={styles.drawerStat}>
                    <span>{STATUS_LABEL[status]}</span>
                    <strong>
                      {status === "ASINKRONUS"
                        ? selectedStudent.attendanceSummary.ASINKRONUS ?? 0
                        : selectedStudent.attendanceSummary[status]}
                    </strong>
                  </div>
                ))}
              </div>

              {(selectedStudent.attendanceDays ?? []).length === 0 ? (
                <div className={styles.emptyDetail}>
                  Belum ada detail absensi untuk siswa ini.
                </div>
              ) : (
                <div className={styles.detailList}>
                  {[...(selectedStudent.attendanceDays ?? [])]
                    .sort((a, b) => a.week - b.week)
                    .map((day) => (
                      <div key={`${day.week}-${day.date}`} className={styles.detailItem}>
                        <div className={styles.detailText}>
                          <strong>Pekan {day.week}</strong>
                          <span className={styles.detailDate}>{formatDate(day.date)}</span>
                          <p className={styles.noteText}>
                            Catatan: {day.notes?.trim() || "-"}
                          </p>
                        </div>
                        <span
                          className={`${styles.statusBadge} ${styles[`status${day.status}`]}`}
                        >
                          {STATUS_LABEL[day.status] ?? day.status}
                        </span>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
