"use client";

import React, { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./grades.module.css";
import {
  type RaportStudent,
} from "@/components/admin/Raport/RaportContent";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import { formatSemester, formatFaseLabel } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";

type GradeSummary = RaportStudent;

// SNBT layout pakai 15 pekan (default sheet "Kelas Online SNBT").
// Ditahan terpisah dari TOTAL_WEEKS reguler (48) supaya legend & header
// tidak overflow horizontal di mode SNBT.
const SNBT_TOTAL_WEEKS = 15;

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
    // Scroll horizontal supaya kolom kelihatan (kolom Siswa sticky di kiri).
    const left = target.offsetLeft - 160;
    area.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
    // Flash highlight semua sel di grup itu.
    const cells = area.querySelectorAll<HTMLElement>(`[data-colgroup="${group}"]`);
    cells.forEach((c) => {
      c.classList.add(styles.colFlash);
      window.setTimeout(() => c.classList.remove(styles.colFlash), 1200);
    });
  }, []);

  const filteredData = React.useMemo(() => {
    if (!search) return data;
    return data.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));
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
  const WEEKS_PER_PAGE = 4;
  const TOTAL_WEEKS = 48;
  const totalWeekPages = Math.ceil(TOTAL_WEEKS / WEEKS_PER_PAGE);
  const MONTH_NAMES = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
  ];

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
      const res = await fetch(`/api/admin/grades?${query.toString()}`);
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




  const getRandomColor = (str: string) => {
    const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const weeks = Array.from(
    { length: WEEKS_PER_PAGE },
    (_, i) => weekPage * WEEKS_PER_PAGE + i + 1
  ).filter((w) => w <= TOTAL_WEEKS);

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

  // Helper SNBT: ambil score per pekan dari array (TO1/KBM/TO2). Kembali
  // null kalau pekan tsb tidak ada di array (sel ditampilkan "-"). Aman
  // untuk siswa fase reguler — `student.penilaian?.snbt` bakal undefined
  // dan helper short-circuit ke null.
  const getSnbtScore = (
    student: GradeSummary,
    bucket: "tryOut1" | "kbm" | "tryOut2",
    week: number
  ): number | null => {
    const arr = student.penilaian?.snbt?.[bucket];
    if (!arr) return null;
    const hit = arr.find((x) => x.week === week);
    return hit ? hit.score : null;
  };

  // Window pekan SNBT (full 15 sekaligus, no pager — masih muat horizontal
  // di layar 1440px+ dan layout sheet referensi memang flat 15 kolom).
  const snbtWeeks = Array.from({ length: SNBT_TOTAL_WEEKS }, (_, i) => i + 1);

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
          <div className={styles.searchWrapper} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "16px" }}>🔍</span>
            <input
              type="text"
              placeholder="Cari nama siswa..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.filterSelect}
              style={{ width: "220px", cursor: "text" }}
            />
          </div>
          <select
            className={styles.filterSelect}
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            {availableSemesters.map((s) => (
              <option key={s} value={s}>
                {formatSemester(s, semesterLabels)}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <option value="ALL">Semua Lokasi Belajar</option>
            {uniqueRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {/*
            Filter level satu-tampilan untuk semua mode (reguler & SNBT).
            Mode SNBT ke-trigger dari kombinasi region "Online SNBT" atau
            level "Fase E (SNBT)" — user bebas pilih, tidak dipaksa.
            Sumber data: union availableLevels (Settings) + fase yang
            beneran muncul di data siswa periode ini → user gak akan
            kebingungan ngeliat opsi yang gak relevan / kelewat.
          */}
          <select
            className={styles.filterSelect}
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option value="ALL">Semua Fase dan Kelas</option>
            {uniqueLevels.map((f) => (
              <option key={f} value={f}>
                {formatFaseLabel(f)}
              </option>
            ))}
          </select>
        </div>

        {/* Pager pekan reguler 4-pekan/halaman tidak relevan di SNBT (15 pekan
            ditampilkan flat). Sembunyikan supaya UI tidak misleading. */}
        {!isSnbtView && (
          <div className={styles.weekPager}>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() => setWeekPage((p) => Math.max(0, p - 1))}
              disabled={weekPage === 0}
              aria-label="Minggu sebelumnya"
            >
              ←
            </button>
            <span className={styles.pagerLabel}>
              Pekan {weekPage * WEEKS_PER_PAGE + 1}-{Math.min((weekPage + 1) * WEEKS_PER_PAGE, TOTAL_WEEKS)}: {MONTH_NAMES[weekPage] ?? ""}
            </span>
            <button
              type="button"
              className={styles.pagerBtn}
              onClick={() =>
                setWeekPage((p) => Math.min(totalWeekPages - 1, p + 1))
              }
              disabled={weekPage >= totalWeekPages - 1}
              aria-label="Minggu berikutnya"
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
                Cara baca: tiap pekan punya 3 sel — Try Out 1 (sebelum KBM), KBM SNBT, dan Try Out 2 (sesudah KBM). Total semester = total TO1 + KBM + TO2 (max 4500).
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
                      style={{ background: "#fcfcfc" }}
                    >
                      Siswa
                    </th>
                    {snbtWeeks.map((w) => (
                      <th
                        key={`snbt-w-${w}`}
                        colSpan={3}
                        className={styles.weekGroupHeader}
                      >
                        W{w}
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
                          style={{ background: "#fff" }}
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
                          const to1 = getSnbtScore(student, "tryOut1", w);
                          const kbm = getSnbtScore(student, "kbm", w);
                          const to2 = getSnbtScore(student, "tryOut2", w);
                          return (
                            <React.Fragment key={`snbt-cell-${w}`}>
                              <td
                                className={`${styles.scoreCell} ${styles.scoreCellTO}`}
                                title={`Pekan ${w} — Try Out 1`}
                              >
                                {to1 == null ? "-" : (
                                  <span className={styles.meetingScore}>
                                    {to1 || "—"}
                                  </span>
                                )}
                              </td>
                              <td
                                className={`${styles.scoreCell} ${styles.scoreCellKbmSnbt}`}
                                title={`Pekan ${w} — KBM SNBT`}
                              >
                                {kbm == null ? "-" : (
                                  <span className={styles.meetingScore}>
                                    {kbm || "—"}
                                  </span>
                                )}
                              </td>
                              <td
                                className={`${styles.scoreCell} ${styles.scoreCellTO2}`}
                                title={`Pekan ${w} — Try Out 2`}
                              >
                                {to2 == null ? "-" : (
                                  <span className={styles.meetingScore}>
                                    {to2 || "—"}
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
                      style={{ background: "#fcfcfc" }}
                    >
                      Siswa
                    </th>
                    {weeks.map((w) => (
                      <th
                        key={w}
                        colSpan={3}
                        className={styles.weekGroupHeader}
                      >
                        W{w}
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
                    {weeks.map((w) => (
                      <React.Fragment key={`sub-${w}`}>
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
                      <td className={styles.stickyCol} style={{ background: "#fff" }}>
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
                      {weeks.map((w) => {
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
                          <React.Fragment key={w}>
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
