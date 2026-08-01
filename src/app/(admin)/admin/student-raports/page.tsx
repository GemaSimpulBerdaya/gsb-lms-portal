"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import { useSearchParams } from "next/navigation";
import { Download, FileArchive, FileText, RefreshCw, X } from "lucide-react";
import RaportContent, { type RaportStudent } from "@/components/admin/Raport/RaportContent";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import { formatFaseLabel, formatSemester } from "@/utils/formatters";
import styles from "../grades/grades.module.css";

type GradeSummary = RaportStudent;
type CachedRaportPdf = {
  objectUrl: string;
  filename: string;
};

const PDF_CACHE_LIMIT = 8;
const PDF_TEMPLATE_VERSION = "2";

function safeDownloadName(value: string) {
  return value.replace(/[^a-zA-Z0-9_\-]+/g, "_").replace(/^_+|_+$/g, "") || "rapor";
}

function filenameFromDisposition(disposition: string | null, fallback: string) {
  if (!disposition) return fallback;
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(utfMatch[1].replace(/["']/g, ""));
    } catch {
      return utfMatch[1].replace(/["']/g, "");
    }
  }
  const regularMatch = disposition.match(/filename="?([^";]+)"?/i);
  return regularMatch?.[1] || fallback;
}

function getStudentCode(student: GradeSummary) {
  return student.profile?.studentCode || student.studentCode || "";
}

function triggerDownload(url: string, filename: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function downloadResponse(url: string, fallbackName: string) {
  const res = await fetch(url);
  if (!res.ok) {
    const contentType = res.headers.get("Content-Type") || "";
    if (contentType.includes("application/json")) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error || `Gagal mengunduh file (${res.status})`);
    }
    throw new Error(`Gagal mengunduh file (${res.status})`);
  }

  const blob = await res.blob();
  const filename = filenameFromDisposition(
    res.headers.get("Content-Disposition"),
    fallbackName
  );
  const objectUrl = URL.createObjectURL(blob);
  triggerDownload(objectUrl, filename);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function RaportsContent() {
  const semesterLabels = useSemesterLabels();
  const searchParams = useSearchParams();
  const studentQuery = searchParams?.get("student") ?? null;

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
  const [previewStudent, setPreviewStudent] = useState<GradeSummary | null>(null);
  const [previewAsHtml, setPreviewAsHtml] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [archiveDownloading, setArchiveDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState<string | null>(null);
  const [previewPdfLoading, setPreviewPdfLoading] = useState(false);
  const [previewPdfError, setPreviewPdfError] = useState<string | null>(null);
  const pdfCacheRef = useRef(new Map<string, CachedRaportPdf>());
  const pdfRequestsRef = useRef(new Map<string, Promise<CachedRaportPdf>>());
  const itemsPerPage = 12;

  const selectedSemesterLabel = useMemo(
    () => formatSemester(selectedSemester, semesterLabels),
    [selectedSemester, semesterLabels]
  );

  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.trim().toLowerCase();
    return data.filter((student) =>
      student.name.toLowerCase().includes(q) ||
      getStudentCode(student).toLowerCase().includes(q)
    );
  }, [data, search]);

  const paginatedData = filteredData.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const uniqueRegions = useMemo(() => {
    const activeRegions = data.map((s) => s.region).filter((reg): reg is string => Boolean(reg));
    return Array.from(new Set([...availableRegions, ...activeRegions])).sort((a, b) => a.localeCompare(b));
  }, [availableRegions, data]);

  const uniqueLevels = useMemo(() => {
    const activeLevels = data.map((s) => s.fase).filter((fase): fase is string => Boolean(fase));
    return Array.from(new Set([...availableLevels, ...activeLevels])).sort((a, b) => a.localeCompare(b));
  }, [availableLevels, data]);

  const fetchSettings = useCallback(async () => {
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
  }, []);

  const fetchRaports = useCallback(async () => {
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
        const sorted = (result.data || []).sort((a: GradeSummary, b: GradeSummary) =>
          a.name.localeCompare(b.name)
        );
        setData(sorted);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedLevel, selectedRegion, selectedSemester]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchSettings();
    });
  }, [fetchSettings]);

  useEffect(() => {
    queueMicrotask(() => {
      fetchRaports();
    });
  }, [fetchRaports]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [filteredData]);

  const autoOpenedStudentRef = useRef<string | null>(null);
  const openPreview = useCallback((student: GradeSummary) => {
    setPreviewAsHtml(window.matchMedia("(max-width: 899px)").matches);
    setPreviewStudent(student);
  }, []);

  useEffect(() => {
    if (!studentQuery || loading || autoOpenedStudentRef.current === studentQuery) {
      return;
    }
    const found = data.find((student) => student._id === studentQuery);
    if (!found) return;
    setSearch(found.name);
    openPreview(found);
    autoOpenedStudentRef.current = studentQuery;
  }, [data, loading, openPreview, studentQuery]);

  useEffect(() => {
    if (!previewStudent) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [previewStudent]);

  useEffect(() => {
    if (!actionError) return;
    const timer = window.setTimeout(() => setActionError(null), 4200);
    return () => window.clearTimeout(timer);
  }, [actionError]);

  const getRaportPdf = useCallback(async (student: GradeSummary) => {
    const cacheKey = `${PDF_TEMPLATE_VERSION}:${selectedSemester}:${student._id}`;
    const cached = pdfCacheRef.current.get(cacheKey);
    if (cached) {
      // Sentuh ulang agar Map berfungsi sebagai cache LRU sederhana.
      pdfCacheRef.current.delete(cacheKey);
      pdfCacheRef.current.set(cacheKey, cached);
      return cached;
    }

    const activeRequest = pdfRequestsRef.current.get(cacheKey);
    if (activeRequest) return activeRequest;

    const request = (async (): Promise<CachedRaportPdf> => {
      const qs = new URLSearchParams({
        studentId: student._id,
        semester: selectedSemester,
      });
      const response = await fetch(`/api/admin/grades/pdf?${qs.toString()}`);
      if (!response.ok) {
        const contentType = response.headers.get("Content-Type") || "";
        if (contentType.includes("application/json")) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `Gagal membuat PDF (${response.status})`);
        }
        throw new Error(`Gagal membuat PDF (${response.status})`);
      }

      const blob = await response.blob();
      const entry: CachedRaportPdf = {
        objectUrl: URL.createObjectURL(blob),
        filename: filenameFromDisposition(
          response.headers.get("Content-Disposition"),
          `rapor_${safeDownloadName(student.name)}_${safeDownloadName(selectedSemesterLabel)}.pdf`
        ),
      };

      if (pdfCacheRef.current.size >= PDF_CACHE_LIMIT) {
        const oldest = pdfCacheRef.current.entries().next().value as
          | [string, CachedRaportPdf]
          | undefined;
        if (oldest) {
          pdfCacheRef.current.delete(oldest[0]);
          URL.revokeObjectURL(oldest[1].objectUrl);
        }
      }
      pdfCacheRef.current.set(cacheKey, entry);
      return entry;
    })();

    pdfRequestsRef.current.set(cacheKey, request);
    try {
      return await request;
    } finally {
      if (pdfRequestsRef.current.get(cacheKey) === request) {
        pdfRequestsRef.current.delete(cacheKey);
      }
    }
  }, [selectedSemester, selectedSemesterLabel]);

  useEffect(() => {
    if (!previewStudent || !selectedSemester || previewAsHtml) {
      setPreviewPdfUrl(null);
      setPreviewPdfLoading(false);
      setPreviewPdfError(null);
      return;
    }

    const cacheKey = `${PDF_TEMPLATE_VERSION}:${selectedSemester}:${previewStudent._id}`;
    const cached = pdfCacheRef.current.get(cacheKey);
    if (cached) {
      setPreviewPdfUrl(cached.objectUrl);
      setPreviewPdfLoading(false);
      setPreviewPdfError(null);
      return;
    }

    let cancelled = false;
    setPreviewPdfUrl(null);
    setPreviewPdfLoading(true);
    setPreviewPdfError(null);

    void getRaportPdf(previewStudent)
      .then((pdf) => {
        if (!cancelled) setPreviewPdfUrl(pdf.objectUrl);
      })
      .catch((error) => {
        if (!cancelled) {
          setPreviewPdfError(error instanceof Error ? error.message : "Gagal memuat preview PDF");
        }
      })
      .finally(() => {
        if (!cancelled) setPreviewPdfLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [getRaportPdf, previewAsHtml, previewStudent, selectedSemester]);

  useEffect(() => {
    const cache = pdfCacheRef.current;
    return () => {
      for (const pdf of cache.values()) URL.revokeObjectURL(pdf.objectUrl);
      cache.clear();
    };
  }, []);

  const getRandomColor = (str: string) => {
    const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleDownloadRaport = useCallback(async (student: GradeSummary) => {
    if (!selectedSemester) return;
    setActionError(null);
    setDownloadingId(student._id);
    try {
      const pdf = await getRaportPdf(student);
      triggerDownload(pdf.objectUrl, pdf.filename);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengunduh rapor");
    } finally {
      setDownloadingId(null);
    }
  }, [getRaportPdf, selectedSemester]);

  const handleDownloadArchive = useCallback(async () => {
    if (!selectedSemester) return;
    if (selectedLevel === "ALL") {
      setActionError("Pilih satu fase terlebih dahulu untuk mengunduh rapor kolektif.");
      return;
    }
    setActionError(null);
    setArchiveDownloading(true);
    try {
      const qs = new URLSearchParams({
        semester: selectedSemester,
        level: selectedLevel,
      });
      if (selectedRegion !== "ALL") qs.set("region", selectedRegion);
      if (search.trim()) qs.set("search", search.trim());
      await downloadResponse(
        `/api/admin/grades/raports/archive?${qs.toString()}`,
        `rapor_${safeDownloadName(selectedLevel)}_${safeDownloadName(selectedSemesterLabel)}.zip`
      );
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Gagal mengunduh arsip rapor");
    } finally {
      setArchiveDownloading(false);
    }
  }, [search, selectedLevel, selectedRegion, selectedSemester, selectedSemesterLabel]);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Rapor Siswa</h1>
        <p className={styles.subtitle}>
          Lihat rapor, unduh rapor per siswa, dan unduh rapor kolektif per fase.
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

          <AdminFilterSelect
            value={selectedLevel === "ALL" ? "" : selectedLevel}
            onChange={(v) => setSelectedLevel(v || "ALL")}
            placeholder="Semua Fase"
            clearable
            clearLabel="Semua Fase"
            options={uniqueLevels.map(f => ({ value: f, label: formatFaseLabel(f) }))}
          />
        </div>

        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={fetchRaports}
            disabled={loading || !selectedSemester}
            title="Muat ulang data rapor"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            type="button"
            className={styles.archiveBtn}
            onClick={handleDownloadArchive}
            disabled={
              loading ||
              archiveDownloading ||
              filteredData.length === 0
            }
            title={
              selectedLevel === "ALL"
                ? "Unduh rapor kolektif per fase"
                : "Unduh rapor sesuai filter aktif"
            }
          >
            <FileArchive size={16} />
            {archiveDownloading
              ? "Menyiapkan rapor..."
              : selectedLevel === "ALL"
                ? "Unduh Rapor Kolektif"
                : `Unduh ${filteredData.length} Rapor`}
          </button>
        </div>
      </div>

      {actionError && (
        <div className={styles.inlineError}>
          {actionError}
        </div>
      )}

      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat data rapor...</p>
          </div>
        ) : (
          <div className={styles.scrollArea}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>
                    No. Induk
                  </th>
                  <th>
                    Siswa
                  </th>
                  <th>Fase</th>
                  <th>Lokasi Belajar</th>
                  <th className={styles.summaryCol}>Capaian</th>
                  <th>Presensi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedData.map((student) => (
                  <tr key={`${page}-${student._id}`} className="admin-page-row">
                    <td className={styles.stickyCol} style={{ fontWeight: 700, color: "var(--admin-muted)" }}>
                      {student.profile?.studentCode || "-"}
                    </td>
                    <td>
                      <div className={styles.studentInfo}>
                        <div
                          className={styles.avatar}
                          style={{ background: getRandomColor(student.name) }}
                        >
                          {student.name.charAt(0)}
                        </div>
                        <div>
                          <span className={styles.studentName}>{student.name}</span>
                          <span className={styles.regionName}>{selectedSemesterLabel}</span>
                        </div>
                      </div>
                    </td>
                    <td>{formatFaseLabel(student.fase)}</td>
                    <td>{student.region || "-"}</td>
                    <td className={styles.summaryCol}>
                      <div className={styles.finalScore}>{student.summary.finalScore}%</div>
                    </td>
                    <td style={{ fontSize: "12px" }}>
                      {student.attendanceSummary.HADIR}/{student.attendanceSummary.total}
                    </td>
                    <td>
                      <div className={styles.rowActions}>
                        <button
                          type="button"
                          className={styles.raportBtn}
                          onClick={() => openPreview(student)}
                        >
                          <FileText size={16} /> Lihat Rapor
                        </button>
                        <button
                          type="button"
                          className={styles.downloadBtn}
                          onClick={() => handleDownloadRaport(student)}
                          disabled={downloadingId === student._id}
                          title="Unduh rapor siswa"
                        >
                          <Download size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {paginatedData.length === 0 && (
                  <tr>
                    <td colSpan={7} className={styles.empty}>
                      Tidak ada siswa sesuai filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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

      {previewStudent && (
        <div
          className={styles.previewOverlay}
          role="dialog"
          aria-modal="true"
          aria-labelledby="raport-preview-title"
          onClick={() => setPreviewStudent(null)}
        >
          <div
            className={styles.previewModal}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.previewHeader}>
              <div className={styles.previewTitleGroup}>
                <h2 id="raport-preview-title" className={styles.previewTitle}>
                  Rapor {previewStudent.name}
                </h2>
                <p className={styles.previewSubtitle}>
                  {previewStudent.region} · {formatFaseLabel(previewStudent.fase)} · {selectedSemesterLabel}
                </p>
              </div>
              <div className={styles.previewActions}>
                <button
                  type="button"
                  className={styles.previewDownloadBtn}
                  onClick={() => handleDownloadRaport(previewStudent)}
                  disabled={downloadingId === previewStudent._id}
                >
                  <Download size={16} />
                  {downloadingId === previewStudent._id ? "Mengunduh..." : "Unduh Rapor"}
                </button>
                <button
                  type="button"
                  className={styles.previewCloseBtn}
                  onClick={() => setPreviewStudent(null)}
                  aria-label="Tutup preview rapor"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className={`${styles.previewBody} ${previewAsHtml ? styles.previewBodyHtml : ""}`}>
              {previewAsHtml ? (
                <RaportContent
                  student={previewStudent}
                  semester={selectedSemesterLabel}
                />
              ) : previewPdfLoading ? (
                <div className={styles.previewPdfState}>
                  <Spinner />
                  <p>Menyiapkan preview rapor…</p>
                </div>
              ) : previewPdfError ? (
                <div className={`${styles.previewPdfState} ${styles.previewPdfStateError}`}>
                  <p>{previewPdfError}</p>
                </div>
              ) : previewPdfUrl ? (
                <iframe
                  className={styles.previewPdf}
                  title={`Preview rapor ${previewStudent.name}`}
                  src={`${previewPdfUrl}#toolbar=0&navpanes=0&view=FitH`}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminStudentRaportsPage() {
  return (
    <Suspense fallback={
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat...</p>
      </div>
    }>
      <RaportsContent />
    </Suspense>
  );
}
