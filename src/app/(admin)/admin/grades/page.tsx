"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import { useSearchParams } from "next/navigation";
import styles from "./grades.module.css";
import {
  type RaportStudent,
} from "@/components/admin/Raport/RaportContent";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import { formatSemester, formatFaseLabel } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";
import { Download, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

type GradeSummary = RaportStudent;

// SNBT layout pakai 15 pekan sesuai format kelas SNBT.
const SNBT_TOTAL_WEEKS = 15;

function getStudentCode(student: GradeSummary) {
  return student.profile?.studentCode || student.studentCode || "";
}

function GradesContent() {
  const semesterLabels = useSemesterLabels();
  const searchParams = useSearchParams();
  const [data, setData] = useState<GradeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);


  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  // Mode SNBT aktif kalau:
  // 1) Querystring `?mode=snbt` (entrypoint dari sidebar "Nilai SNBT").
  // 2) Region manual = "Online SNBT" (user pilih lewat dropdown).
  // 3) Fase manual = "FASE E (SNBT)" — value canonical UPPERCASE dari
  //    `deriveFase()` & key `faseConfig`. Comparison case-insensitive
  //    supaya legacy data dengan casing lain tetap nyala.
  // Branch render layout di bawah pakai boolean tunggal supaya gak ada
  // kondisi tercecer (mudah ke-skip kalau ditambah filter baru).
  const modeQuery = searchParams?.get("mode") ?? null;
  const isSnbtView =
    modeQuery === "snbt" ||
    selectedRegion === "Online SNBT" ||
    selectedLevel.toUpperCase() === "FASE E (SNBT)";

  // Sinkronisasi sekali: kalau masuk via `?mode=snbt`, set region default ke
  // "Online SNBT" supaya filter UI mencerminkan state yang dipakai. Pakai ref
  // boolean supaya tidak mengulang override saat user mengganti dropdown
  // secara manual setelah mount (tanpa ini, dependency [modeQuery] bisa
  // tetap re-trigger override setiap render setelah user pindah region).
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (modeQuery === "snbt" && selectedRegion === "ALL") {
      setSelectedRegion("Online SNBT");
      syncedRef.current = true;
    }
    // Tetap mark synced kalau bukan mode snbt — supaya nanti user yg secara
    // sengaja pindah region ke "Online SNBT" tanpa querystring tidak
    // ke-override balik.
    if (modeQuery !== "snbt") syncedRef.current = true;
  }, [modeQuery, selectedRegion]);

  // Ref ke area scroll tabel + handler untuk klik legend -> scroll & flash
  // kolom terkait. Tiap header sel kolom diberi data-colgroup, legend mengirim
  // grup yang sama supaya bisa di-query.
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const scrollToColumn = useCallback((group: string) => {
    const area = scrollAreaRef.current;
    if (!area) return;
    const target = area.querySelector<HTMLElement>(`[data-colgroup="${group}"]`);
    if (!target) return;
    const hasDesktopStickyStudentCol = window.matchMedia("(min-width: 900px)").matches;
    const left = target.offsetLeft - (hasDesktopStickyStudentCol ? 160 : 132);
    area.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    // Flash highlight semua sel di grup itu.
    const cells = area.querySelectorAll<HTMLElement>(`[data-colgroup="${group}"]`);
    cells.forEach((c) => {
      c.classList.add(styles.colFlash);
      window.setTimeout(() => c.classList.remove(styles.colFlash), 1200);
    });
  }, []);

  const filteredData = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data;
    return data.filter((student) =>
      student.name.toLowerCase().includes(q) ||
      getStudentCode(student).toLowerCase().includes(q)
    );
  }, [data, search]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [filteredData]);

  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const uniqueRegions = React.useMemo(() => {
    const activeRegions = data.map(s => s.region).filter((reg): reg is string => Boolean(reg));
    return Array.from(new Set([...availableRegions, ...activeRegions])).sort((a, b) => a.localeCompare(b));
  }, [data, availableRegions]);

  const uniqueLevels = React.useMemo(() => {
    const activeLevels = data.map(s => s.fase).filter((f): f is string => Boolean(f));
    return Array.from(new Set([...availableLevels, ...activeLevels])).sort((a, b) => a.localeCompare(b));
  }, [data, availableLevels]);

  const [weekPage, setWeekPage] = useState(0);
  const monthGroups = React.useMemo(() => {
    const byMonth = new Map<string, { label: string; sortTime: number; maxMeetings: number }>();

    for (const student of data) {
      const studentMonths = new Map<string, { label: string; sortTime: number; count: number }>();
      for (const meeting of student.kbmDates ?? []) {
        const date = new Date(meeting.date);
        if (Number.isNaN(date.getTime())) continue;
        const key = new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
        }).format(date);
        const current = studentMonths.get(key) ?? {
          label: new Intl.DateTimeFormat("id-ID", {
            timeZone: "Asia/Jakarta",
            month: "long",
            year: "numeric",
          }).format(date),
          sortTime: date.getTime(),
          count: 0,
        };
        current.count += 1;
        current.sortTime = Math.min(current.sortTime, date.getTime());
        studentMonths.set(key, current);
      }

      for (const [key, studentMonth] of studentMonths) {
        const current = byMonth.get(key);
        byMonth.set(key, {
          label: studentMonth.label,
          sortTime: Math.min(current?.sortTime ?? studentMonth.sortTime, studentMonth.sortTime),
          maxMeetings: Math.max(current?.maxMeetings ?? 0, studentMonth.count),
        });
      }
    }

    const scheduled = Array.from(byMonth.entries())
      .sort(([, a], [, b]) => a.sortTime - b.sortTime)
      .map(([key, group]) => ({
        key,
        label: group.label,
        slots: Array.from({ length: group.maxMeetings }, (_, index) => index),
      }));

    if (scheduled.length > 0) return scheduled;

    const fallbackWeeks = Array.from(
      new Set(data.flatMap((student) => student.meetings?.map((meeting) => meeting.week) ?? []))
    ).sort((a, b) => a - b);
    return fallbackWeeks.length > 0
      ? [{ key: "fallback", label: "Semua Pekan", slots: fallbackWeeks.map((_, index) => index) }]
      : [];
  }, [data]);
  const totalWeekPages = monthGroups.length;
  const activeMonth = monthGroups[Math.min(weekPage, Math.max(0, totalWeekPages - 1))];
  const weekSlots = activeMonth?.slots ?? [];

  const getStudentWeekForSlot = (student: GradeSummary, slot: number) => {
    if (!activeMonth) return undefined;
    if (activeMonth.key === "fallback") {
      return Array.from(new Set(student.meetings?.map((meeting) => meeting.week) ?? []))
        .sort((a, b) => a - b)[slot];
    }
    return (student.kbmDates ?? [])
      .filter((meeting) => {
        const date = new Date(meeting.date);
        if (Number.isNaN(date.getTime())) return false;
        return new Intl.DateTimeFormat("en-CA", {
          timeZone: "Asia/Jakarta",
          year: "numeric",
          month: "2-digit",
        }).format(date) === activeMonth.key;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[slot]?.week;
  };

  useEffect(() => {
    if (weekPage < monthGroups.length) return;
    const frame = window.requestAnimationFrame(() => setWeekPage(Math.max(0, monthGroups.length - 1)));
    return () => window.cancelAnimationFrame(frame);
  }, [monthGroups.length, weekPage]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const d = await res.json();
        if (d.availableSemesters) setAvailableSemesters(d.availableSemesters);
        if (d.availableRegions) setAvailableRegions(d.availableRegions);
        if (d.availableLevels) setAvailableLevels(d.availableLevels);
        if (d.activeSemester) setSelectedSemester(d.activeSemester);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchGrades = useCallback(async () => {
    if (!selectedSemester) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        semester: selectedSemester,
        region: selectedRegion,
        level: selectedLevel,
      });
      const res = await fetch(`/api/admin/grades?${query.toString()}`, {
        cache: "no-store",
      });
      if (res.ok) {
        const result = await res.json();
        const sorted = (result.data || []).sort((a: any, b: any) => a.name.localeCompare(b.name));
        setData(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester, selectedRegion, selectedLevel]);

  useEffect(() => {
    // Wrap dalam queueMicrotask supaya setState di dalam fetchSettings/Grades
    // tidak dianggap sync dalam effect body. React 19 strict mode flag pattern
    // setLoading(true) yang dipanggil sebelum await sebagai "cascading render".
    queueMicrotask(() => {
      fetchSettings();
    });
  }, []);
  useEffect(() => {
    queueMicrotask(() => {
      fetchGrades();
    });
  }, [fetchGrades]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setWeekPage(0));
    return () => window.cancelAnimationFrame(frame);
  }, [selectedLevel, selectedRegion, selectedSemester]);




  const getRandomColor = (str: string) => {
    const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };


  // Kumpulkan semua subject UAS unik dari faseConfig siswa di list saat ini
  // (bukan dari nilai aktual). Alasan: kolom UAS harus muncul sesuai fase
  // yang seharusnya, walaupun belum ada nilai tersimpan — kalau ngandalin
  // data nilai, kolom B.Ing bisa "hilang" pas pindah region cuma karena
  // belum ada siswa yg di-input UAS B.Ing-nya. Pakai Map by subject supaya
  // urutan stabil & gak duplikat antar fase.
  const collectUasSubjects = () => {
    const kog = new Map<string, { subject: string; label: string }>();
    const afk = new Map<string, { subject: string; label: string }>();
    const bing = new Map<string, { subject: string; label: string }>();
    for (const s of data) {
      const fc = s.faseConfig;
      if (!fc) continue;
      fc.uasKognitifSubjects.forEach((c) =>
        kog.set(c.subject, { subject: c.subject, label: c.label })
      );
      fc.uasAfektifSubjects.forEach((c) =>
        afk.set(c.subject, { subject: c.subject, label: c.label })
      );
      // B.Inggris: fase yg punya konfigurasi (`uasBInggris !== null`) dapet
      // 1 kolom dengan subject canonical "BING". Label tetap konsisten
      // walaupun fase berbeda kontribusi.
      if (fc.uasBInggris) {
        bing.set("BING", { subject: "BING", label: "B.Inggris" });
      }
    }
    return {
      kognitif: Array.from(kog.values()),
      afektif: Array.from(afk.values()),
      bing: Array.from(bing.values()),
    };
  };
  const uasSubjects = collectUasSubjects();

  const hasUasKog = uasSubjects.kognitif.length > 0;
  const hasUasAfk = uasSubjects.afektif.length > 0;
  const hasUasBing = uasSubjects.bing.length > 0;

  // Helper SNBT: ambil entry per pekan dari array (TO1/KBM/TO2). Kembali
  // null kalau pekan tsb tidak ada di array (sel ditampilkan "-"). Aman
  // untuk siswa fase reguler — `student.penilaian?.snbt` bakal undefined
  // dan helper short-circuit ke null. Untuk TO dengan sub-tes, `score`
  // sudah berupa rata-rata dari aggregator; rinciannya ada di `subTests`.
  const getSnbtEntry = (
    student: GradeSummary,
    bucket: "tryOut1" | "kbm" | "tryOut2",
    week: number
  ) => {
    const arr = student.penilaian?.snbt?.[bucket];
    if (!arr) return null;
    return arr.find((x) => x.week === week) ?? null;
  };
  const snbtSubTestTooltip = (
    entry: {
      week?: number;
      score?: number;
      title?: string;
      subTests?: Array<{ code: string; score: number }>;
    } | null
  ): string =>
    entry?.subTests && entry.subTests.length > 0
      ? ` — rata-rata ${entry.subTests.length} sub-tes: ${entry.subTests
          .map((s) => `${s.code} ${s.score}`)
          .join(", ")}`
      : "";

  // Window pekan SNBT (full 15 sekaligus, no pager — masih muat horizontal
  // di layar 1440px+ dan layout sheet referensi memang flat 15 kolom).
  const snbtWeeks = Array.from({ length: SNBT_TOTAL_WEEKS }, (_, i) => i + 1);

  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    const summaryRows = filteredData.map((student) => ({
      "No. Induk": getStudentCode(student) || "-",
      "Nama Siswa": student.name,
      Fase: formatFaseLabel(student.fase),
      "Lokasi Belajar": student.region || "-",
      "Rata-rata Konsep": student.summary.avgConcept,
      "Rata-rata Kuis": student.summary.avgQuiz,
      "Rata-rata Sikap": student.summary.avgAttitude,
      "Total KBM": student.summary.totalKbm ?? 0,
      "Total UAS": student.uasScore ?? 0,
      "Nilai Akhir": student.summary.finalScore,
      Hadir: student.attendanceSummary.HADIR,
      Izin: student.attendanceSummary.IZIN,
      Sakit: student.attendanceSummary.SAKIT,
      Alfa: student.attendanceSummary.ALFA,
      "Total Presensi": student.attendanceSummary.total,
    }));
    const meetingRows = filteredData.flatMap((student) =>
      (student.meetings ?? []).map((meeting) => ({
        "No. Induk": getStudentCode(student) || "-",
        "Nama Siswa": student.name,
        Fase: formatFaseLabel(student.fase),
        "Lokasi Belajar": student.region || "-",
        Pekan: meeting.week,
        Pertemuan: meeting.meetingIndex,
        Materi: meeting.title || "-",
        Konsep: meeting.scoreConcept,
        Kuis: meeting.scoreQuiz,
        Sikap: meeting.scoreAttitude,
        Total: meeting.score,
      })),
    );
    const workbook = XLSX.utils.book_new();
    const summarySheet = XLSX.utils.json_to_sheet(summaryRows);
    const meetingSheet = XLSX.utils.json_to_sheet(meetingRows.length ? meetingRows : [{ Info: "Belum ada nilai per pertemuan" }]);
    summarySheet["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 22 }];
    meetingSheet["!cols"] = [{ wch: 14 }, { wch: 28 }, { wch: 20 }, { wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 32 }];
    XLSX.utils.book_append_sheet(workbook, summarySheet, "Rekap Nilai");
    XLSX.utils.book_append_sheet(workbook, meetingSheet, "Nilai Pertemuan");
    XLSX.writeFile(workbook, `Rekap Nilai ${selectedSemester || "semester"}.xlsx`);
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Rekap Nilai</h1>
        <p className={styles.subtitle}>
          Rekapitulasi nilai akhir, KBM mingguan, UAS, dan presensi siswa.
        </p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <div className={styles.searchWrapper}>
            <span style={{ fontSize: "16px" }}>🔍</span>
            <input
              type="text"
              placeholder="Cari nama atau No. Induk..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${styles.filterSelect} ${styles.searchInput}`}
            />
          </div>
          <AdminFilterSelect
            value={selectedSemester}
            onChange={setSelectedSemester}
            options={availableSemesters.map(s => ({ value: s, label: formatSemester(s, semesterLabels) }))}
          />
          <AdminFilterSelect
            width="lg"
            value={selectedRegion === "ALL" ? "" : selectedRegion}
            onChange={(v) => setSelectedRegion(v || "ALL")}
            placeholder="Semua Lokasi Belajar"
            clearable
            clearLabel="Semua Lokasi Belajar"
            options={uniqueRegions.map(r => ({ value: r, label: r }))}
          />
          {/*
            Filter level satu-tampilan untuk semua mode (reguler & SNBT).
            Mode SNBT ke-trigger dari kombinasi region "Online SNBT" atau
            level "Fase E (SNBT)" — user bebas pilih, tidak dipaksa.
            Sumber data: union availableLevels (Settings) + fase yang
            beneran muncul di data siswa periode ini → user gak akan
            kebingungan ngeliat opsi yang gak relevan / kelewat.
          */}
          <AdminFilterSelect
            width="lg"
            value={selectedLevel === "ALL" ? "" : selectedLevel}
            onChange={(v) => setSelectedLevel(v || "ALL")}
            placeholder="Semua Fase dan Kelas"
            clearable
            clearLabel="Semua Fase dan Kelas"
            options={uniqueLevels.map(f => ({ value: f, label: formatFaseLabel(f) }))}
          />
        </div>

        <button
          type="button"
          className={styles.refreshBtn}
          onClick={fetchGrades}
          disabled={loading || !selectedSemester}
          title="Muat ulang data rekap nilai"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
        <button
          type="button"
          className={styles.archiveBtn}
          onClick={handleExportExcel}
          disabled={loading || filteredData.length === 0}
        >
          <Download size={14} />
          Export
        </button>

        {/* Pager per bulan mengikuti tanggal pertemuan jadwal. Mode SNBT tetap
            menampilkan 15 pekan flat sesuai format kelas SNBT. */}
        {!isSnbtView && (
          <div className={styles.weekPager}>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
              disabled={weekPage === 0}
              aria-label="Bulan sebelumnya"
            >
              ←
            </button>
            <span className={styles.pagerLabel}>
              {activeMonth
                ? `${activeMonth.label} · Pekan 1–${activeMonth.slots.length}`
                : "Belum ada jadwal pertemuan"}
            </span>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() =>
                setWeekPage((p) => Math.min(totalWeekPages - 1, p + 1))
              }
              disabled={totalWeekPages === 0 || weekPage >= totalWeekPages - 1}
              aria-label="Bulan berikutnya"
            >
              →
            </button>
          </div>
        )}
      </div>

      <div className={styles.legend}>
        {isSnbtView ? (
          <>
            {/* Legend SNBT — clickable scroll-to-column, sama pola dgn legend reguler. */}
            <button
              type="button"
              className={styles.legendItem}
              onClick={() => scrollToColumn("to1")}
            >
              <span className={styles.legendIcon}>🎯</span>
              <span>Try Out 1</span>
            </button>
            <button
              type="button"
              className={styles.legendItem}
              onClick={() => scrollToColumn("kbm-snbt")}
            >
              <span className={styles.legendIcon}>📚</span>
              <span>KBM SNBT</span>
            </button>
            <button
              type="button"
              className={styles.legendItem}
              onClick={() => scrollToColumn("to2")}
            >
              <span className={styles.legendIcon}>🏁</span>
              <span>Try Out 2</span>
            </button>
            <div className={styles.legendItem}>
              <span className={styles.legendHint}>
                Cara baca: tiap pekan punya 3 sel — Try Out 1 (sebelum KBM), KBM, dan Try Out 2 (sesudah KBM). Nilai TO = rata-rata sub-tes (hover sel untuk rincian); nilai KBM = rata-rata Konsep/Kuis/Sikap Minggu Cerdas. Total semester = total TO1 + KBM + TO2 (max 4500).
              </span>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              className={styles.legendItem}
              onClick={() => scrollToColumn("k")}
            >
              <span className={styles.legendIcon}>💡</span>
              <span>Pemahaman Konsep</span>
            </button>
            <button
              type="button"
              className={styles.legendItem}
              onClick={() => scrollToColumn("q")}
            >
              <span className={styles.legendIcon}>📝</span>
              <span>Pengerjaan Kuis</span>
            </button>
            <button
              type="button"
              className={styles.legendItem}
              onClick={() => scrollToColumn("s")}
            >
              <span className={styles.legendIcon}>⭐</span>
              <span>Sikap Pembelajaran</span>
            </button>
            <span className={styles.legendSep}></span>
            {hasUasKog && (
              <button
                type="button"
                className={styles.legendItem}
                onClick={() => scrollToColumn("kog")}
              >
                <span className={`${styles.legendDot} ${styles.dotKog}`}></span>
                <span>UAS Literasi</span>
              </button>
            )}
            {hasUasAfk && (
              <button
                type="button"
                className={styles.legendItem}
                onClick={() => scrollToColumn("afk")}
              >
                <span className={`${styles.legendDot} ${styles.dotAfk}`}></span>
                <span>UAS Afektif</span>
              </button>
            )}
            {hasUasBing && (
              <button
                type="button"
                className={styles.legendItem}
                onClick={() => scrollToColumn("bing")}
              >
                <span className={`${styles.legendDot} ${styles.dotBing}`}></span>
                <span>UAS B.Inggris</span>
              </button>
            )}
            <div className={styles.legendItem}>
              <span className={styles.legendHint}>
                Klik label untuk loncat ke kolomnya
              </span>
            </div>
          </>
        )}
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Menghitung rekap penilaian...</p>
          </div>
        ) : isSnbtView ? (
          // ── Layout SNBT: 15 pekan × (TO1 / KBM / TO2) + group Total (3 kolom)
          //    + Capaian/Presensi. Mirror sheet "Kelas Online SNBT".
          //    Reuse sebagian style (.scrollArea, .stickyCol, .table, .evalScore)
          //    supaya konsisten dgn layout reguler.
          <>
            <div className={styles.scrollArea} ref={scrollAreaRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className={styles.stickyCol}
                    >
                      Siswa
                    </th>
                    {snbtWeeks.map((w) => (
                      <th
                        key={`snbt-w-${w}`}
                        colSpan={3}
                        className={styles.weekGroupHeader}
                      >
                        Pekan {w}
                      </th>
                    ))}
                    <th colSpan={3} className={styles.weekGroupHeader}>
                      Total
                    </th>
                    <th
                      rowSpan={2}
                      className={styles.summaryCol}
                      title="Capaian total semester (TO1 + KBM + TO2) / 4500 × 100"
                    >
                      Capaian (%)
                    </th>
                    <th rowSpan={2}>Presensi</th>
                  </tr>
                  <tr>
                    {snbtWeeks.map((w) => (
                      <React.Fragment key={`snbt-sub-${w}`}>
                        <th
                          className={`${styles.subCol} ${styles.subColTO}`}
                          data-colgroup="to1"
                          title="Try Out 1 — sebelum KBM"
                        >
                          🎯
                        </th>
                        <th
                          className={`${styles.subCol} ${styles.subColKbmSnbt}`}
                          data-colgroup="kbm-snbt"
                          title="KBM SNBT"
                        >
                          📚
                        </th>
                        <th
                          className={`${styles.subCol} ${styles.subColTO2}`}
                          data-colgroup="to2"
                          title="Try Out 2 — sesudah KBM"
                        >
                          🏁
                        </th>
                      </React.Fragment>
                    ))}
                    <th
                      className={`${styles.evalCol} ${styles.subColTO}`}
                      data-colgroup="to1"
                      title="Total Try Out 1"
                    >
                      Total TO1
                    </th>
                    <th
                      className={`${styles.evalCol} ${styles.subColKbmSnbt}`}
                      data-colgroup="kbm-snbt"
                      title="Total KBM SNBT"
                    >
                      Total KBM
                    </th>
                    <th
                      className={`${styles.evalCol} ${styles.subColTO2}`}
                      data-colgroup="to2"
                      title="Total Try Out 2"
                    >
                      Total TO2
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((student) => {
                    const snbt = student.penilaian?.snbt;
                    return (
                      <tr
                        key={`snbt-${page}-${student._id}`}
                        className="admin-page-row"
                      >
                        <td
                          className={styles.stickyCol}
                        >
                          <div className={styles.studentInfo}>
                            <div
                              className={styles.avatar}
                              style={{
                                background: getRandomColor(student.name),
                              }}
                            >
                              {student.name.charAt(0)}
                            </div>
                            <div>
                              <span className={styles.studentName}>
                                {student.name}
                              </span>
                              <span className={styles.regionName}>
                                {student.region} - {student.fase}
                              </span>
                            </div>
                          </div>
                        </td>
                        {snbtWeeks.map((w) => {
                          // Sel pekan: 3 sub-kolom TO1/KBM/TO2. Kalau siswa
                          // bukan fase SNBT (snbt undefined), semua sel "-"
                          // — jangan throw runtime error, sesuai requirement
                          // di task body.
                          const to1 = getSnbtEntry(student, "tryOut1", w);
                          const kbm = getSnbtEntry(student, "kbm", w);
                          const to2 = getSnbtEntry(student, "tryOut2", w);
                          return (
                            <React.Fragment key={`snbt-cell-${w}`}>
                              <td
                                className={`${styles.scoreCell} ${styles.scoreCellTO}`}
                                title={`Pekan ${w} — Try Out 1${snbtSubTestTooltip(to1)}`}
                              >
                                {to1 == null ? "-" : (
                                  <span className={styles.meetingScore}>
                                    {to1.score || "—"}
                                  </span>
                                )}
                              </td>
                              <td
                                className={`${styles.scoreCell} ${styles.scoreCellKbmSnbt}`}
                                title={`Pekan ${w} — KBM SNBT`}
                              >
                                {kbm == null ? "-" : (
                                  <span className={styles.meetingScore}>
                                    {kbm.score || "—"}
                                  </span>
                                )}
                              </td>
                              <td
                                className={`${styles.scoreCell} ${styles.scoreCellTO2}`}
                                title={`Pekan ${w} — Try Out 2${snbtSubTestTooltip(to2)}`}
                              >
                                {to2 == null ? "-" : (
                                  <span className={styles.meetingScore}>
                                    {to2.score || "—"}
                                  </span>
                                )}
                              </td>
                            </React.Fragment>
                          );
                        })}
                        <td
                          className={`${styles.evalCol} ${styles.scoreCellTO}`}
                          title="Total Try Out 1 semester ini"
                        >
                          <div className={styles.evalScore}>
                            {snbt ? snbt.totalTryOut1 : "-"}
                          </div>
                        </td>
                        <td
                          className={`${styles.evalCol} ${styles.scoreCellKbmSnbt}`}
                          title="Total KBM SNBT semester ini"
                        >
                          <div className={styles.evalScore}>
                            {snbt ? snbt.totalKbm : "-"}
                          </div>
                        </td>
                        <td
                          className={`${styles.evalCol} ${styles.scoreCellTO2}`}
                          title="Total Try Out 2 semester ini"
                        >
                          <div className={styles.evalScore}>
                            {snbt ? snbt.totalTryOut2 : "-"}
                          </div>
                        </td>
                        <td className={styles.summaryCol}>
                          <div
                            className={styles.finalScore}
                            title={
                              snbt
                                ? `Persentase total: ${snbt.totalSnbt}/${snbt.maxSnbt} × 100`
                                : "Capaian total semester"
                            }
                          >
                            {student.summary.finalScore}%
                          </div>
                        </td>
                        <td style={{ fontSize: "12px" }}>
                          {student.attendanceSummary.HADIR}/
                          {student.attendanceSummary.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className={styles.scrollArea} ref={scrollAreaRef}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th
                      rowSpan={2}
                      className={styles.stickyCol}
                    >
                      Siswa
                    </th>
                    {weekSlots.map((slot, index) => (
                      <th
                        key={slot}
                        colSpan={3}
                        className={styles.weekGroupHeader}
                      >
                        Pekan {index + 1}
                      </th>
                    ))}
                    <th
                      colSpan={
                        1 + // UAS Total
                        (hasUasKog ? 1 : 0) +
                        (hasUasAfk ? 1 : 0) +
                        (hasUasBing ? 1 : 0)
                      }
                      className={styles.weekGroupHeader}
                    >
                      UAS
                    </th>
                    <th rowSpan={2} className={styles.summaryCol} title="Capaian total semester (KBM + UAS) sebagai persentase dari poin maksimal">
                      Capaian (%)
                    </th>
                    <th rowSpan={2}>Presensi</th>
                  </tr>
                  <tr>
                    {weekSlots.map((slot) => (
                      <React.Fragment key={`sub-${slot}`}>
                        <th
                          className={`${styles.subCol} ${styles.subColK}`}
                          data-colgroup="k"
                          title="Pemahaman Konsep — penguasaan materi harian"
                        >
                          💡
                        </th>
                        <th
                          className={`${styles.subCol} ${styles.subColQ}`}
                          data-colgroup="q"
                          title="Pengerjaan Kuis — hasil kuis di akhir sesi"
                        >
                          📝
                        </th>
                        <th
                          className={`${styles.subCol} ${styles.subColS}`}
                          data-colgroup="s"
                          title="Sikap Pembelajaran — adab dan keaktifan kelas"
                        >
                          ⭐
                        </th>
                      </React.Fragment>
                    ))}
                    {hasUasKog && (
                      <th
                        className={`${styles.evalCol} ${styles.evalColKog}`}
                        data-colgroup="kog"
                        title="UAS Literasi (Kognitif) — total dari Numerasi, Sains, B.Indonesia"
                      >
                        Literasi
                      </th>
                    )}
                    {hasUasAfk && (
                      <th
                        className={`${styles.evalCol} ${styles.evalColAfk}`}
                        data-colgroup="afk"
                        title="UAS Afektif — total dari Ketekunan, Ketelitian, Tanggung Jawab"
                      >
                        Afektif
                      </th>
                    )}
                    {hasUasBing && (
                      <th
                        className={`${styles.evalCol} ${styles.evalColBing}`}
                        data-colgroup="bing"
                        title="UAS Bahasa Inggris"
                      >
                        B.Inggris
                      </th>
                    )}
                    <th className={styles.evalCol}>UAS Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedData.map((student) => (
                    <tr
                      key={`${page}-${student._id}`}
                      className="admin-page-row"
                    >
                      <td className={styles.stickyCol}>
                        <div className={styles.studentInfo}>
                          <div
                            className={styles.avatar}
                            style={{ background: getRandomColor(student.name) }}
                          >
                            {student.name.charAt(0)}
                          </div>
                          <div>
                            <span className={styles.studentName}>
                              {student.name}
                            </span>
                            <span className={styles.regionName}>
                              {student.region} - {student.fase}
                            </span>
                          </div>
                        </div>
                      </td>
                      {weekSlots.map((slot) => {
                        const w = getStudentWeekForSlot(student, slot);
                        if (w === undefined) {
                          return (
                            <React.Fragment key={`empty-${slot}`}>
                              <td className={`${styles.scoreCell} ${styles.scoreCellK}`}>-</td>
                              <td className={`${styles.scoreCell} ${styles.scoreCellQ}`}>-</td>
                              <td className={`${styles.scoreCell} ${styles.scoreCellS}`}>-</td>
                            </React.Fragment>
                          );
                        }
                        // Prefer raw meetings (bisa >1 per minggu).
                        // Fallback ke weeklyGrades aggregated kalau API lama.
                        const meetingsInWeek =
                          student.meetings?.filter((m) => m.week === w) ?? [];
                        const wgFallback = student.weeklyGrades[w];
                        const rawDisplay =
                          meetingsInWeek.length > 0
                            ? meetingsInWeek
                            : wgFallback
                              ? [
                                {
                                  week: w,
                                  meetingIndex: 1,
                                  scoreConcept: wgFallback.scoreConcept,
                                  scoreQuiz: wgFallback.scoreQuiz,
                                  scoreAttitude: wgFallback.scoreAttitude,
                                  score: wgFallback.score,
                                  title: wgFallback.title,
                                },
                              ]
                              : [];

                        // Skip pertemuan dummy (semua komponen 0). Ini biasanya
                        // dari record lama yang ke-save sebelum validasi
                        // pre-submit di /evaluation aktif.
                        const display = rawDisplay.filter(
                          (m) =>
                            (m.scoreConcept || 0) > 0 ||
                            (m.scoreQuiz || 0) > 0 ||
                            (m.scoreAttitude || 0) > 0
                        );

                        // Gabung title semua pertemuan supaya tooltip informatif
                        const tooltip =
                          display.length === 0
                            ? ""
                            : display
                              .map((m, i) =>
                                display.length > 1
                                  ? `Pertemuan ${i + 1}: ${m.title}`
                                  : m.title
                              )
                              .join(" · ");

                        return (
                          <React.Fragment key={`${slot}-${w}`}>
                            <td
                              className={`${styles.scoreCell} ${styles.scoreCellK}`}
                              title={tooltip}
                            >
                              {display.length === 0 ? (
                                "-"
                              ) : (
                                <div className={styles.meetingStack}>
                                  {display.map((m, i) => (
                                    <div
                                      key={i}
                                      className={styles.meetingRow}
                                    >
                                      {display.length > 1 && (
                                        <span className={styles.meetingLabel}>
                                          P{i + 1}
                                        </span>
                                      )}
                                      <span className={styles.meetingScore}>
                                        {m.scoreConcept || "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td
                              className={`${styles.scoreCell} ${styles.scoreCellQ}`}
                              title={tooltip}
                            >
                              {display.length === 0 ? (
                                "-"
                              ) : (
                                <div className={styles.meetingStack}>
                                  {display.map((m, i) => (
                                    <div
                                      key={i}
                                      className={styles.meetingRow}
                                    >
                                      {display.length > 1 && (
                                        <span className={styles.meetingLabel}>
                                          P{i + 1}
                                        </span>
                                      )}
                                      <span className={styles.meetingScore}>
                                        {m.scoreQuiz || "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                            <td
                              className={`${styles.scoreCell} ${styles.scoreCellS}`}
                              title={tooltip}
                            >
                              {display.length === 0 ? (
                                "-"
                              ) : (
                                <div className={styles.meetingStack}>
                                  {display.map((m, i) => (
                                    <div
                                      key={i}
                                      className={styles.meetingRow}
                                    >
                                      {display.length > 1 && (
                                        <span className={styles.meetingLabel}>
                                          P{i + 1}
                                        </span>
                                      )}
                                      <span className={styles.meetingScore}>
                                        {m.scoreAttitude || "—"}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </React.Fragment>
                        );
                      })}
                      {hasUasKog && (() => {
                        const t = student.penilaian?.uasLiterasi.kognitifTotal;
                        return (
                          <td
                            className={`${styles.evalCol} ${styles.evalColKog}`}
                            title={
                              t
                                ? `UAS Literasi (Kognitif): ${t.siswa}/${t.max}`
                                : "UAS Literasi (Kognitif): belum ada nilai"
                            }
                          >
                            {t && t.siswa > 0 ? (
                              <div className={styles.evalScore}>
                                {t.siswa}
                                <span className={styles.evalMax}>/{t.max}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })()}
                      {hasUasAfk && (() => {
                        const t = student.penilaian?.uasLiterasi.afektifTotal;
                        return (
                          <td
                            className={`${styles.evalCol} ${styles.evalColAfk}`}
                            title={
                              t
                                ? `UAS Afektif: ${t.siswa}/${t.max}`
                                : "UAS Afektif: belum ada nilai"
                            }
                          >
                            {t && t.siswa > 0 ? (
                              <div className={styles.evalScore}>
                                {t.siswa}
                                <span className={styles.evalMax}>/{t.max}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })()}
                      {hasUasBing && (() => {
                        const t = student.penilaian?.uasBahasaInggrisTotal;
                        return (
                          <td
                            className={`${styles.evalCol} ${styles.evalColBing}`}
                            title={
                              t
                                ? `UAS Bahasa Inggris: ${t.siswa}/${t.max}`
                                : "UAS Bahasa Inggris: belum ada nilai"
                            }
                          >
                            {t && t.siswa > 0 ? (
                              <div className={styles.evalScore}>
                                {t.siswa}
                                <span className={styles.evalMax}>/{t.max}</span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })()}
                      <td className={styles.evalCol}>
                        <div className={styles.evalScore}>
                          {student.uasScore || "-"}
                        </div>
                      </td>
                      <td className={styles.summaryCol}>
                        <div
                          className={styles.finalScore}
                          title="Persentase total: (poin KBM + UAS) / poin maksimal × 100"
                        >
                          {student.summary.finalScore}%
                        </div>
                      </td>
                      <td style={{ fontSize: "12px" }}>
                        {student.attendanceSummary.HADIR}/
                        {student.attendanceSummary.total}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {!loading && (
        <AdminPagination
          page={page}
          totalItems={filteredData.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}

export default function AdminGradesPage() {
  return (
    <Suspense fallback={
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat...</p>
      </div>
    }>
      <GradesContent />
    </Suspense>
  );
}
