"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./grades.module.css";
import Modal from "@/components/ui/Modal/Modal";
import RaportContent, {
  type RaportStudent,
  type UasSubjectScore,
  type TryoutScore,
} from "@/components/admin/Raport/RaportContent";

type GradeSummary = RaportStudent;

function GradesContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<GradeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<GradeSummary | null>(null);
  const [weekPage, setWeekPage] = useState(0);
  const [cleaning, setCleaning] = useState(false);
  const WEEKS_PER_PAGE = 8;
  const TOTAL_WEEKS = 16;
  const totalWeekPages = Math.ceil(TOTAL_WEEKS / WEEKS_PER_PAGE);

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
        setData(result.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester, selectedRegion, selectedLevel]);

  useEffect(() => {
    fetchSettings();
  }, []);
  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // ─── Cleanup pertemuan dummy 0/0/0 ────────────────────────────────────────
  // Flow: dry-run dulu (preview hitungan + sample) → confirm → execute.
  const handleCleanupEmpty = async () => {
    if (cleaning) return;
    setCleaning(true);
    try {
      // Step 1: dry-run untuk hitung & ambil sample
      const previewRes = await fetch("/api/admin/grades/cleanup-empty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: true }),
      });
      if (!previewRes.ok) {
        const err = await previewRes.json().catch(() => ({}));
        alert(`Gagal mengambil preview: ${err.error || previewRes.statusText}`);
        return;
      }
      const preview = await previewRes.json();
      if (preview.matched === 0) {
        alert("Tidak ada pertemuan TUGAS dengan K=Q=S=0. Database sudah bersih.");
        return;
      }

      const sampleLines = preview.sample
        .slice(0, 5)
        .map(
          (s: any) =>
            `• ${s.student} — Pekan ${s.week ?? "?"} — "${s.title || "-"}"`
        )
        .join("\n");
      const confirmMsg =
        `Ditemukan ${preview.matched} pertemuan TUGAS dengan K=Q=S=0.\n\n` +
        `Contoh (5 dari ${preview.sample.length}):\n${sampleLines}\n\n` +
        `Yakin hapus permanen? Aksi ini tidak bisa di-undo.`;
      if (!window.confirm(confirmMsg)) return;

      // Step 2: execute
      const execRes = await fetch("/api/admin/grades/cleanup-empty", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dryRun: false }),
      });
      if (!execRes.ok) {
        const err = await execRes.json().catch(() => ({}));
        alert(`Gagal menghapus: ${err.error || execRes.statusText}`);
        return;
      }
      const result = await execRes.json();
      alert(`Sukses. ${result.deleted} pertemuan dummy dihapus.`);
      fetchGrades();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCleaning(false);
    }
  };

  useEffect(() => {
    const studentId = searchParams.get("student");
    if (studentId && data.length > 0) {
      const student = data.find((s) => s._id === studentId);
      if (student) setSelectedStudent(student);
    }
  }, [searchParams, data]);

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

  // Kumpulkan semua subject UAS unik dari data siswa — tiap fase bisa
  // punya komponen UAS berbeda. Pakai Map supaya urutan konsisten:
  // KOGNITIF dulu, lalu AFEKTIF, lalu BAHASA INGGRIS.
  const collectUasSubjects = () => {
    const kog = new Map<string, { subject: string; label: string }>();
    const afk = new Map<string, { subject: string; label: string }>();
    const bing = new Map<string, { subject: string; label: string }>();
    for (const s of data) {
      s.penilaian?.uasLiterasi.kognitif.forEach((c) =>
        kog.set(c.subject, { subject: c.subject, label: c.label })
      );
      s.penilaian?.uasLiterasi.afektif.forEach((c) =>
        afk.set(c.subject, { subject: c.subject, label: c.label })
      );
      s.penilaian?.uasBahasaInggris.forEach((c) =>
        bing.set(c.subject, { subject: c.subject, label: c.label })
      );
    }
    return {
      kognitif: Array.from(kog.values()),
      afektif: Array.from(afk.values()),
      bing: Array.from(bing.values()),
    };
  };
  const uasSubjects = collectUasSubjects();

  // Tryouts: kumpulkan nomor tryout unik (untuk kelas SNBT)
  const tryoutNumbers = Array.from(
    new Set(
      data.flatMap((s) => (s.tryouts ?? []).map((t) => t.tryoutNumber))
    )
  ).sort((a, b) => a - b);

  const hasUasKog = uasSubjects.kognitif.length > 0;
  const hasUasAfk = uasSubjects.afektif.length > 0;
  const hasUasBing = uasSubjects.bing.length > 0;
  const hasTryout = tryoutNumbers.length > 0;

  // Lookup helper untuk cari nilai UAS siswa per subject
  const getUasScore = (
    student: GradeSummary,
    bucket: "KOGNITIF" | "AFEKTIF" | "BING",
    subject: string
  ): UasSubjectScore | null => {
    if (!student.penilaian) return null;
    const arr =
      bucket === "KOGNITIF"
        ? student.penilaian.uasLiterasi.kognitif
        : bucket === "AFEKTIF"
        ? student.penilaian.uasLiterasi.afektif
        : student.penilaian.uasBahasaInggris;
    return arr.find((c) => c.subject === subject) ?? null;
  };

  const getTryoutScore = (
    student: GradeSummary,
    tryoutNumber: number
  ): TryoutScore | null =>
    student.tryouts?.find((t) => t.tryoutNumber === tryoutNumber) ?? null;

  const buildPrintUrl = (studentId: string, auto: boolean) => {
    const qs = new URLSearchParams({
      studentId,
      semester: selectedSemester,
    });
    if (auto) qs.set("auto", "1");
    return `/print/raport?${qs.toString()}`;
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Rekap Penilaian & Raport</h1>
        <p className={styles.subtitle}>
          Pantau capaian akademik siswa dan generate raport otomatis.
        </p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <select
            className={styles.filterSelect}
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
          >
            {availableSemesters.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
          >
            <option value="ALL">Semua Wilayah</option>
            {availableRegions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className={styles.filterSelect}
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
          >
            <option value="ALL">Semua Jenjang</option>
            {availableLevels.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </div>

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
            Minggu {weekPage * WEEKS_PER_PAGE + 1}–
            {Math.min((weekPage + 1) * WEEKS_PER_PAGE, TOTAL_WEEKS)}
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
          <button
            type="button"
            className={styles.pagerBtn}
            onClick={handleCleanupEmpty}
            disabled={cleaning}
            title="Hapus permanen pertemuan TUGAS yang K=Q=S=0 (record dummy/legacy)"
            style={{ marginLeft: 8 }}
          >
            🧹 {cleaning ? "..." : "Bersihkan 0/0/0"}
          </button>
        </div>
      </div>

      <div className={styles.legend}>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotK}`}></span>
          <span>💡 Pemahaman Konsep</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotQ}`}></span>
          <span>📝 Pengerjaan Kuis</span>
        </div>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotS}`}></span>
          <span>⭐ Sikap Pembelajaran</span>
        </div>
        <span className={styles.legendSep}></span>
        <div className={styles.legendItem}>
          <span className={`${styles.legendDot} ${styles.dotEval}`}></span>
          <span>UTS</span>
        </div>
        {hasUasKog && (
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotKog}`}></span>
            <span>UAS Kognitif</span>
          </div>
        )}
        {hasUasAfk && (
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotAfk}`}></span>
            <span>UAS Afektif</span>
          </div>
        )}
        {hasUasBing && (
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotBing}`}></span>
            <span>UAS B.Inggris</span>
          </div>
        )}
        {hasTryout && (
          <div className={styles.legendItem}>
            <span className={`${styles.legendDot} ${styles.dotTryout}`}></span>
            <span>Tryout</span>
          </div>
        )}
        <div className={styles.legendItem}>
          <span className={styles.legendHint}>
            Arahkan kursor ke sel untuk lihat detail
          </span>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>Menghitung rekap penilaian...</div>
        ) : (
          <div className={styles.scrollArea}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className={styles.stickyCol}
                    style={{ background: "#fcfcfc" }}
                  >
                    Anak Didik
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
                      2 + // UTS + UAS total
                      uasSubjects.kognitif.length +
                      uasSubjects.afektif.length +
                      uasSubjects.bing.length +
                      tryoutNumbers.length
                    }
                    className={styles.weekGroupHeader}
                  >
                    Evaluasi
                  </th>
                  <th rowSpan={2} className={styles.summaryCol} title="Capaian total semester (KBM + UAS) sebagai persentase dari poin maksimal">
                    Capaian (%)
                  </th>
                  <th rowSpan={2}>Presensi</th>
                  <th rowSpan={2}>Aksi</th>
                </tr>
                <tr>
                  {weeks.map((w) => (
                    <React.Fragment key={`sub-${w}`}>
                      <th
                        className={`${styles.subCol} ${styles.subColK}`}
                        title="Pemahaman Konsep — penguasaan materi harian"
                      >
                        💡
                      </th>
                      <th
                        className={`${styles.subCol} ${styles.subColQ}`}
                        title="Pengerjaan Kuis — hasil kuis di akhir sesi"
                      >
                        📝
                      </th>
                      <th
                        className={`${styles.subCol} ${styles.subColS}`}
                        title="Sikap Pembelajaran — adab dan keaktifan kelas"
                      >
                        ⭐
                      </th>
                    </React.Fragment>
                  ))}
                  <th className={styles.evalCol}>UTS</th>
                  {hasUasKog &&
                    uasSubjects.kognitif.map((c) => (
                      <th
                        key={`head-kog-${c.subject}`}
                        className={`${styles.evalCol} ${styles.evalColKog}`}
                        title={`UAS Kognitif — ${c.label}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  {hasUasAfk &&
                    uasSubjects.afektif.map((c) => (
                      <th
                        key={`head-afk-${c.subject}`}
                        className={`${styles.evalCol} ${styles.evalColAfk}`}
                        title={`UAS Afektif — ${c.label}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  {hasUasBing &&
                    uasSubjects.bing.map((c) => (
                      <th
                        key={`head-bing-${c.subject}`}
                        className={`${styles.evalCol} ${styles.evalColBing}`}
                        title={`UAS B.Inggris — ${c.label}`}
                      >
                        {c.label}
                      </th>
                    ))}
                  <th className={styles.evalCol}>UAS Total</th>
                  {hasTryout &&
                    tryoutNumbers.map((n) => (
                      <th
                        key={`head-tryout-${n}`}
                        className={`${styles.evalCol} ${styles.evalColTryout}`}
                        title={`Try Out ke-${n}`}
                      >
                        TO{n}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {data.map((student) => (
                  <tr key={student._id}>
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
                            {student.region} - {student.category}
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
                            {display.length === 0
                              ? "-"
                              : display.map((m, i) => (
                                  <span
                                    key={i}
                                    className={styles.scoreInline}
                                  >
                                    {m.scoreConcept || "—"}
                                    {i < display.length - 1 ? (
                                      <span className={styles.scoreSep}>/</span>
                                    ) : null}
                                  </span>
                                ))}
                          </td>
                          <td
                            className={`${styles.scoreCell} ${styles.scoreCellQ}`}
                            title={tooltip}
                          >
                            {display.length === 0
                              ? "-"
                              : display.map((m, i) => (
                                  <span
                                    key={i}
                                    className={styles.scoreInline}
                                  >
                                    {m.scoreQuiz || "—"}
                                    {i < display.length - 1 ? (
                                      <span className={styles.scoreSep}>/</span>
                                    ) : null}
                                  </span>
                                ))}
                          </td>
                          <td
                            className={`${styles.scoreCell} ${styles.scoreCellS}`}
                            title={tooltip}
                          >
                            {display.length === 0
                              ? "-"
                              : display.map((m, i) => (
                                  <span
                                    key={i}
                                    className={styles.scoreInline}
                                  >
                                    {m.scoreAttitude || "—"}
                                    {i < display.length - 1 ? (
                                      <span className={styles.scoreSep}>/</span>
                                    ) : null}
                                  </span>
                                ))}
                          </td>
                        </React.Fragment>
                      );
                    })}
                    <td className={styles.evalCol}>
                      <div className={styles.evalScore}>
                        {student.utsScore || "-"}
                      </div>
                    </td>
                    {hasUasKog &&
                      uasSubjects.kognitif.map((c) => {
                        const s = getUasScore(student, "KOGNITIF", c.subject);
                        return (
                          <td
                            key={`kog-${c.subject}`}
                            className={`${styles.evalCol} ${styles.evalColKog}`}
                            title={
                              s
                                ? `${c.label}: ${s.score}/${s.maxScore}`
                                : `${c.label}: belum ada nilai`
                            }
                          >
                            {s ? (
                              <div className={styles.evalScore}>
                                {s.score}
                                <span className={styles.evalMax}>
                                  /{s.maxScore}
                                </span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}
                    {hasUasAfk &&
                      uasSubjects.afektif.map((c) => {
                        const s = getUasScore(student, "AFEKTIF", c.subject);
                        return (
                          <td
                            key={`afk-${c.subject}`}
                            className={`${styles.evalCol} ${styles.evalColAfk}`}
                            title={
                              s
                                ? `${c.label}: ${s.score}/${s.maxScore}`
                                : `${c.label}: belum ada nilai`
                            }
                          >
                            {s ? (
                              <div className={styles.evalScore}>
                                {s.score}
                                <span className={styles.evalMax}>
                                  /{s.maxScore}
                                </span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}
                    {hasUasBing &&
                      uasSubjects.bing.map((c) => {
                        const s = getUasScore(student, "BING", c.subject);
                        return (
                          <td
                            key={`bing-${c.subject}`}
                            className={`${styles.evalCol} ${styles.evalColBing}`}
                            title={
                              s
                                ? `${c.label}: ${s.score}/${s.maxScore}`
                                : `${c.label}: belum ada nilai`
                            }
                          >
                            {s ? (
                              <div className={styles.evalScore}>
                                {s.score}
                                <span className={styles.evalMax}>
                                  /{s.maxScore}
                                </span>
                              </div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}
                    <td className={styles.evalCol}>
                      <div className={styles.evalScore}>
                        {student.uasScore || "-"}
                      </div>
                    </td>
                    {hasTryout &&
                      tryoutNumbers.map((n) => {
                        const t = getTryoutScore(student, n);
                        return (
                          <td
                            key={`tryout-${n}`}
                            className={`${styles.evalCol} ${styles.evalColTryout}`}
                            title={
                              t
                                ? `Tryout ${n}: ${t.score}`
                                : `Tryout ${n}: belum ada nilai`
                            }
                          >
                            {t ? (
                              <div className={styles.evalScore}>{t.score}</div>
                            ) : (
                              "-"
                            )}
                          </td>
                        );
                      })}
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
                    <td>
                      <button
                        className={styles.raportBtn}
                        onClick={() => setSelectedStudent(student)}
                      >
                        📄 Raport
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title={`Preview Raport - ${selectedStudent.name}`}
          maxWidth="900px"
          footer={
            <div style={{ display: "flex", gap: 8 }}>
              <a
                className={styles.raportBtn}
                href={buildPrintUrl(selectedStudent._id, true)}
                target="_blank"
                rel="noreferrer"
              >
                📥 Unduh PDF
              </a>
              <a
                className={styles.raportBtn}
                href={buildPrintUrl(selectedStudent._id, false)}
                target="_blank"
                rel="noreferrer"
              >
                🖨️ Buka Preview
              </a>
            </div>
          }
        >
          <RaportContent student={selectedStudent} semester={selectedSemester} />
        </Modal>
      )}
    </div>
  );
}

export default function AdminGradesPage() {
  return (
    <Suspense fallback={<div>Memuat...</div>}>
      <GradesContent />
    </Suspense>
  );
}
