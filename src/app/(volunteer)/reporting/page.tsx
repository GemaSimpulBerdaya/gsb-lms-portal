"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import NextImage from "next/image";
import styles from "./report.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getCurrentSemester, formatSemester, dateToIso, formatKbmDateShort, isFutureDate } from "@/utils/formatters";
import { compressDataUrl, dataUrlToFile, extFromDataUrl } from "@/utils/image";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import { uploadFiles } from "@/lib/uploadthing";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import PhotoGallery from "./_components/PhotoGallery";
import CameraModal from "./_components/CameraModal";
import { MONTH_FILTERS, excerpt, formatDate, formatShortDate, getReportPhotos } from "./_lib/reportingUtils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Report = {
  _id: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  photoUrls?: string[];
  location?: string;
  scheduleId?: string;
  region?: string;
  level?: string;
  createdAt: string;
};

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

type Toast = { type: "success" | "error"; message: string } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getReportsPerPage = () => {
  if (typeof window === "undefined") return 12;
  return window.matchMedia("(max-width: 640px)").matches ? 10 : 12;
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA MODAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────


// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat...</p>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}

function ReportContent() {
  const searchParams = useSearchParams();

  // Query params dari schedule timeline (auto-fill flow)
  const qsScheduleId = searchParams.get("scheduleId");
  const qsDate = searchParams.get("date");

  const [mounted, setMounted] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [photoOptionOpen, setPhotoOptionOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formScheduleId, setFormScheduleId] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  // Photos: array of data-URLs (captured) atau URL eksternal.
  const [formPhotos, setFormPhotos] = useState<string[]>([]);

  // Camera modal
  const [cameraOpen, setCameraOpen] = useState(false);

  // Photo preview modal
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Detail modal
  const [detailReport, setDetailReport] = useState<Report | null>(null);

  const semesterLabels = useSemesterLabels();

  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });

  const [availableSemesters, setAvailableSemesters] = useState<string[]>(["2025-1"]);

  const [reportsPerPage, setReportsPerPage] = useState(() => getReportsPerPage());

  const fetchReports = useCallback(async (pg = 1, append = false) => {
    setLoading(append ? false : true);
    if (!append && typeof window !== "undefined") {
      // Scroll ke top saat ganti page (bukan saat load more append)
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    try {
      const query = new URLSearchParams({
        page: pg.toString(),
        limit: reportsPerPage.toString(),
        semester: selectedSemester
      });
      const selectedSchedule = schedules.find((s) => String(s._id) === String(searchQuery));
      if (selectedSchedule) {
        query.set("scheduleId", selectedSchedule._id);
        query.set("region", selectedSchedule.region);
        query.set("fase", selectedSchedule.fase);
      }
      if (monthFilter) {
        query.set("month", monthFilter);
      }
      if (keywordFilter.trim()) {
        query.set("q", keywordFilter.trim());
      }
      const res = await fetch(`/api/reports/me?${query.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports((prev) => (append ? [...prev, ...data.reports] : data.reports));
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setToast({ type: "error", message: "Gagal memuat laporan. Silakan coba lagi." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setLoading(false);
    }
  }, [keywordFilter, monthFilter, reportsPerPage, schedules, searchQuery, selectedSemester]);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error("Gagal memuat jadwal:", err);
    }
  }, []);

  // Sync with global semester only on initial mount
  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);

          const stored = localStorage.getItem("activeSemester");
          if (data.activeSemester && (!stored || stored === "2025-1")) {
            setSelectedSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };

    fetchGlobalSemester();

    const handleStorage = () => {
      const active = localStorage.getItem("activeSemester");
      if (active) {
        setSelectedSemester(active);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []); // Run only once

  // Keep localStorage in sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", selectedSemester);
    }
  }, [selectedSemester]);

  const isReadOnly = selectedSemester !== getCurrentSemester();

  // ── Initial Data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true);
      fetchSchedules();
    }, 30);
    return () => clearTimeout(t);
  }, [fetchSchedules]);

  // Auto-open create form kalau ada query params dari schedule timeline.
  // Dilakukan via ref guard supaya cuma trigger sekali setelah schedules ke-load.
  const autoOpenedFromQueryRef = useRef(false);
  useEffect(() => {
    if (autoOpenedFromQueryRef.current) return;
    if (!qsScheduleId && !qsDate) return;
    if (schedules.length === 0) return;

    autoOpenedFromQueryRef.current = true;

    // Defer state updates ke microtask untuk avoid set-state-in-effect.
    Promise.resolve().then(() => {
      setEditingId(null);
      setFormDate(qsDate || "");
      setFormTitle("");
      setFormDesc("");
      setFormLocation("");
      setFormScheduleId(qsScheduleId || "");
      setFormPhotos([]);
      setFormOpen(true);
    });
  }, [qsScheduleId, qsDate, schedules]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports(1, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReports]);

  useEffect(() => {
    const updateReportsPerPage = () => {
      setReportsPerPage(getReportsPerPage());
    };

    window.addEventListener("resize", updateReportsPerPage);
    return () => window.removeEventListener("resize", updateReportsPerPage);
  }, []);

  // Lock body scroll
  useEffect(() => {
    const anyOpen = formOpen || !!photoUrl || !!detailReport;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, photoUrl, detailReport]);

  // ── Form ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setFormDate("");
    setFormTitle("");
    setFormDesc("");
    setFormLocation("");
    setFormScheduleId("");
    setFormPhotos([]);
    setFormOpen(true);
  };

  const openEdit = (r: Report) => {
    setEditingId(r._id);
    setFormDate(r.date ? dateToIso(r.date) : "");
    setFormTitle(r.title);
    setFormDesc(r.description);
    setFormLocation(r.location || "");
    setFormScheduleId(r.scheduleId || "");
    // Prefer photoUrls array; fallback ke photoUrl single (legacy)
    const initial = Array.isArray(r.photoUrls) && r.photoUrls.length > 0
      ? r.photoUrls
      : r.photoUrl ? [r.photoUrl] : [];
    setFormPhotos(initial);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  /**
   * Upload a base64 dataURL ke UploadThing (reportPhoto endpoint).
   * Returns the hosted URL string. Throws kalau upload gagal — caller bertanggung jawab
   * tampil error ke user (jangan simpan dataURL ke DB sebagai fallback).
   */
  const resolvePhotoUrl = async (dataUrl: string): Promise<string> => {
    const ext = extFromDataUrl(dataUrl);
    const filename = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const file = dataUrlToFile(dataUrl, filename);
    const result = await uploadFiles("reportPhoto", { files: [file] });
    const first = result?.[0];
    if (!first || !first.ufsUrl) throw new Error("upload failed");
    return first.ufsUrl;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setToast({ type: "error", message: `${file.name} terlalu besar (maks 10MB)` });
        setTimeout(() => setToast(null), 3500);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length === 0) {
      e.target.value = "";
      return;
    }

    // Read & compress paralel — push hasil compressed ke state setelah semua selesai
    Promise.all(
      accepted.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const raw = ev.target?.result as string;
              const compressed = await compressDataUrl(raw);
              resolve(compressed);
            };
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          })
      )
    ).then((results) => {
      const valid = results.filter(Boolean);
      if (valid.length > 0) {
        setFormPhotos((prev) => [...prev, ...valid]);
      }
    });

    // Reset input supaya bisa pilih file yang sama lagi nanti
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setFormPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (isReadOnly) return;
    if (!formTitle.trim() || !formDesc.trim() || !formDate) {
      setToast({ type: "error", message: "Tanggal, Judul, dan Deskripsi wajib diisi." });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    setSubmitting(true);
    try {
      // Resolve setiap data:URL ke hosted URL via UploadThing (reportPhoto endpoint).
      // Yang sudah berupa http URL dilewati apa adanya.
      const resolvedPhotos: string[] = [];
      for (const p of formPhotos) {
        if (p.startsWith("data:")) {
          const url = await resolvePhotoUrl(p);
          resolvedPhotos.push(url);
        } else if (p) {
          resolvedPhotos.push(p);
        }
      }

      // Find schedule info if selected
      let region, fase;
      if (formScheduleId) {
         const schedule = schedules.find(s => s._id === formScheduleId);
         if (schedule) {
            region = schedule.region;
            fase = schedule.fase;
         }
      }

      const isEdit = editingId !== null;
      const res = await fetch("/api/reports", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? {
                id: editingId,
                title: formTitle.trim(),
                description: formDesc.trim(),
                date: formDate,
                location: formLocation.trim() || undefined,
                photoUrl: resolvedPhotos[0] || undefined,
                photoUrls: resolvedPhotos,
                scheduleId: formScheduleId || undefined,
                region,
                fase,
                semester: selectedSemester,
              }
            : {
                title: formTitle.trim(),
                description: formDesc.trim(),
                date: formDate,
                location: formLocation.trim() || undefined,
                photoUrl: resolvedPhotos[0] || undefined,
                photoUrls: resolvedPhotos,
                scheduleId: formScheduleId || undefined,
                region,
                fase,
                semester: selectedSemester,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
      
      if (isEdit) {
        setReports((prev) => prev.map(r => r._id === editingId ? data.report : r));
        setToast({ type: "success", message: "Laporan berhasil diperbarui." });
      } else {
        setReports((prev) => [data.report, ...prev]);
        setTotal((t) => t + 1);
        setToast({ type: "success", message: "Laporan berhasil dikirim." });
      }
      setTimeout(() => setToast(null), 3500);
      closeForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim laporan.";
      setToast({ type: "error", message: msg });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isReadOnly) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus laporan.");
      setReports((prev) => prev.filter((r) => r._id !== id));
      setTotal((t) => t - 1);
      setToast({ type: "success", message: "Laporan berhasil dihapus." });
      setTimeout(() => setToast(null), 3500);
      if (detailReport && detailReport._id === id) {
        setDetailReport(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setToast({ type: "error", message: msg });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const handleScheduleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setFormScheduleId(newId);
    if (newId) {
      const schedule = schedules.find(s => s._id === newId);
      if (schedule) {
        setFormLocation(`${schedule.region} - ${schedule.fase}`);
      }
    } else {
      setFormLocation("");
    }
  };

  const selectedScheduleFilter = schedules.find(
    (s) => String(s._id) === String(searchQuery)
  );
  const selectedScheduleLabel = selectedScheduleFilter
    ? `${selectedScheduleFilter.region} - ${selectedScheduleFilter.fase}`
    : "";
  const filtered = reports;
  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Camera modal sits above everything */}
      {cameraOpen && (
        <CameraModal
          onCapture={async (dataUrl) => {
            // Kompres juga foto hasil capture supaya konsisten dengan upload manual
            const compressed = await compressDataUrl(dataUrl);
            setFormPhotos((prev) => [...prev, compressed]);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>

        {/* ── Hero ── */}
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <span className={styles.heroLabel}>PELAPORAN KEGIATAN</span>
              <h1 className={styles.heroTitle}>
                Laporan Kegiatan.
              </h1>
              <p className={styles.heroDesc}>
                Kirimkan laporan aktivitas mengajar di lapangan kepada Super Admin.
                Foto bukti diambil langsung dari kamera untuk memastikan keaslian laporan.
              </p>
              {isReadOnly && (
                <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(192, 57, 43, 0.1)', color: '#c0392b', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  ARSIP SEMESTER LAMPAU (READ-ONLY)
                </div>
              )}
            </div>
            <div className={styles.heroActions}>
              {!isReadOnly && (
                <button className={styles.btnPublish} onClick={openAdd}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span>Buat<br />Laporan</span>
                </button>
              )}
            </div>
          </div>
        </div>
        {/* ── Filter Bar ── */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            {availableSemesters.length > 1 && (
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>Semester</label>
                <div style={{ position: 'relative' }}>
                  <select 
                    className={styles.searchInput} 
                    style={{ appearance: 'none', cursor: 'pointer', paddingRight: '40px', minWidth: '160px' }}
                    value={selectedSemester}
                    onChange={(e) => setSelectedSemester(e.target.value)}
                  >
                    {availableSemesters.map(sem => (
                      <option key={sem} value={sem}>{formatSemester(sem, semesterLabels)}</option>
                    ))}
                  </select>
                  <svg style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>
            )}
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>TOTAL LAPORAN</label>
              <div className={styles.reportCountBadge}>{total} laporan</div>
            </div>
          </div>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <select
              className={styles.searchInput}
              style={{ appearance: 'none', cursor: 'pointer', paddingLeft: '36px' }}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
            >
              {MONTH_FILTERS.map((month) => (
                <option key={month.value || "all"} value={month.value}>{month.label}</option>
              ))}
            </select>
          </div>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <select
              className={styles.searchInput}
              style={{ appearance: 'none', cursor: 'pointer', paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            >
              <option value="">Semua Jadwal</option>
              {schedules
                .filter(s => s.semester === selectedSemester)
                .map(s => (
                  <option key={s._id} value={s._id}>{s.region} - {s.fase}</option>
                ))
              }
            </select>
          </div>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className={styles.searchInput}
              type="search"
              placeholder="Cari judul/deskripsi"
              value={keywordFilter}
              onChange={(e) => setKeywordFilter(e.target.value)}
            />
          </div>
        </div>

        {/* ── Cards ── */}
        {loading ? (
          <div className={styles.reportTableWrap}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className={styles.reportSkeletonRow}>
                <span />
                <span />
                <span />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.reportEmptyState}>
            <div className={styles.reportEmptyIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <p className={styles.reportEmptyTitle}>
              {searchQuery ? "Laporan tidak ditemukan" : "Belum ada laporan"}
            </p>
            <p className={styles.reportEmptyDesc}>
              {selectedScheduleLabel
                ? `Tidak ada laporan untuk jadwal ${selectedScheduleLabel}.`
                : monthFilter || keywordFilter
                ? "Tidak ada laporan yang cocok dengan filter saat ini."
                : "Mulai buat laporan kegiatan pertama Anda."}
            </p>
            {!searchQuery && !isReadOnly && (
              <button className={styles.btnEmptyCreate} onClick={openAdd} type="button">
                + Buat Laporan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className={styles.reportTableWrap}>
            <table className={styles.reportTable}>
              <thead>
                <tr>
                  <th>Tanggal KBM</th>
                  <th>Dibuat</th>
                  <th>Judul</th>
                  <th>Deskripsi</th>
                  <th>Lokasi Belajar</th>
                  <th>Foto</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
            {filtered.map((report, index) => {
              const photos = getReportPhotos(report);
              const reportLocation = report.region && report.level
                ? `${report.region} - ${report.level}`
                : report.location || "Tanpa lokasi";
              return (
              <tr
                key={report._id}
                className={`${styles.reportRow} ${mounted ? styles[`cardAnim${(index % 4) + 1}` as keyof typeof styles] : styles.cardHidden}`}
              >
                <td className={styles.reportDateCell} data-label="Tanggal KBM">
                  <span className={styles.reportDate}>{formatShortDate(report.date)}</span>
                </td>
                <td className={styles.reportCreatedCell} data-label="Dibuat">
                  <span className={styles.reportCreatedDate}>{formatShortDate(report.createdAt)}</span>
                </td>
                <td className={styles.reportTitleCell} data-label="Judul">
                  <div className={styles.reportTitleWrap}>
                    <div className={styles.reportTitleText}>
                      <strong>{report.title}</strong>
                    </div>
                  </div>
                </td>
                <td className={styles.reportDescCell} data-label="Deskripsi">
                  <span>{excerpt(report.description, 14)}</span>
                </td>
                <td className={styles.reportLocationCell} data-label="Lokasi Belajar">
                  <span>{reportLocation}</span>
                </td>
                <td className={styles.reportPhotoCell} data-label="Foto">
                  <span className={styles.reportPhotoBadge}>{photos.length || 0} foto</span>
                </td>
                <td className={styles.reportActionsCell} data-label="Aksi">
                  <div className={styles.reportActions}>
                    <button className={styles.reportActionButton} onClick={() => setDetailReport(report)} type="button" title="Lihat detail">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                  </button>
                    {!isReadOnly && (
                      <>
                        <button className={styles.reportActionButton} onClick={() => openEdit(report)} type="button" title="Edit laporan">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className={`${styles.reportActionButton} ${styles.reportActionDanger}`} onClick={() => setConfirmId(report._id)} type="button" title="Hapus laporan">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className={styles.paginationWrapper}>
            <AdminPagination
              page={page}
              totalItems={total}
              itemsPerPage={reportsPerPage}
              onPageChange={(nextPage) => fetchReports(nextPage, false)}
            />
          </div>
        )}

      </div>

      {/* ── DETAIL MODAL ── */}
      {detailReport && (
        <div className={styles.previewOverlay} onClick={() => setDetailReport(null)}>
          <div className={styles.previewPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewTopBar}>
              <div className={styles.previewBreadcrumb}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>LAPORAN KEGIATAN</span>
                <span className={styles.previewBadge}>DETAIL</span>
              </div>
              <h2 className={styles.previewTitle}>{detailReport.title}</h2>
              <p className={styles.previewSubtitle}>
                {detailReport.region && detailReport.level 
                   ? `${detailReport.region} - ${detailReport.level} — ${formatDate(detailReport.date)}`
                   : detailReport.location 
                     ? `${detailReport.location} — ${formatDate(detailReport.date)}` 
                     : formatDate(detailReport.date)}
              </p>
              <div className={styles.previewActions}>
                {(() => {
                  const detailPhotos = getReportPhotos(detailReport);
                  return detailPhotos.length > 0 && (
                    <button className={styles.btnShareLink} onClick={() => { setDetailReport(null); setPhotoUrl(detailPhotos[0]); }} type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      Lihat Foto{detailPhotos.length > 1 ? ` (${detailPhotos.length})` : ""}
                    </button>
                  );
                })()}
                <button className={styles.previewClose} onClick={() => setDetailReport(null)} type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={styles.previewScroll}>
              <div className={styles.premiumDetailContent}>
                <div className={styles.detailHeroSection}>
                  {(() => {
                    const detailPhotos = getReportPhotos(detailReport);
                    if (detailPhotos.length === 0) {
                      return (
                        <div className={styles.detailNoPhoto}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                          <p>Tidak ada bukti foto</p>
                        </div>
                      );
                    }
                    return (
                      <PhotoGallery
                        photos={detailPhotos}
                        onZoom={(src) => { setDetailReport(null); setPhotoUrl(src); }}
                      />
                    );
                  })()}
                </div>

                <div className={styles.detailInfoSection}>
                  <div className={styles.detailHeaderMeta}>
                    <div className={styles.detailDateBadge}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      {formatDate(detailReport.date)}
                    </div>
                    <div className={styles.detailRegionBadge}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {detailReport.region && detailReport.level ? `${detailReport.region} - ${detailReport.level}` : (detailReport.location || "Lokasi tidak spesifik")}
                    </div>
                  </div>

                  <div className={styles.detailDescriptionCard}>
                    <h4 className={styles.detailSectionTitle}>Deskripsi Kegiatan</h4>
                    <p className={styles.detailDescriptionText}>{detailReport.description}</p>
                  </div>

                  <div className={styles.detailFooterMeta}>
                    <p>ID Laporan: <span style={{ fontFamily: 'monospace' }}>{detailReport._id}</span></p>
                    <p>Dikirim pada: {formatDate(detailReport.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE REPORT MODAL ── */}
      {formOpen && (
        <div className={styles.previewOverlay} onClick={closeForm}>
          <div className={styles.reportFormPanel} onClick={(e) => e.stopPropagation()}>

            <div className={styles.reportFormHeader}>
              <div>
                <p className={styles.reportFormLabel}>LAPORAN KEGIATAN</p>
                <h2 className={styles.reportFormTitle}>{editingId ? "Edit Laporan" : "Buat Laporan Baru"}</h2>
              </div>
              <button className={styles.previewClose} onClick={closeForm} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.reportFormBody}>
              <div className={styles.reportFormRow}>
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Pilih Jadwal </label>
                  <select 
                      className={styles.reportFormInput} 
                      style={{ appearance: 'none', cursor: 'pointer' }}
                      value={formScheduleId} 
                      onChange={handleScheduleChange}
                  >
                      <option value="">-- Tidak Terkait Jadwal --</option>
                      {schedules.map(s => <option key={s._id} value={s._id}>{s.region} - {s.fase}</option>)}
                  </select>
                </div>
              </div>
              <div className={styles.reportFormRow}>
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Tanggal Kegiatan <span className={styles.required}>*</span></label>
                  {(() => {
                    const sched = schedules.find((s) => s._id === formScheduleId);
                    const list = sched?.kbmDates ?? [];
                    if (formScheduleId && list.length > 0) {
                      // Schedule terpilih + ada kbmDates → dropdown grouped per bulan
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
                        <select
                          className={styles.reportFormInput}
                          style={{ appearance: "none", cursor: "pointer" }}
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                        >
                          <option value="">-- Pilih Tanggal Pertemuan --</option>
                          {groups.map((g) => (
                            <optgroup key={g.month} label={g.month}>
                              {g.items.map((k) => {
                                const iso = dateToIso(k.date);
                                const future = isFutureDate(k.date);
                                return (
                                  <option key={`${k.week}-${iso}`} value={iso} disabled={future}>
                                    Pekan {k.week} · {formatKbmDateShort(k.date)}
                                    {future ? " · belum mulai" : ""}
                                  </option>
                                );
                              })}
                            </optgroup>
                          ))}
                        </select>
                      );
                    }
                    // Tanpa jadwal / kbmDates kosong → input date manual (fallback)
                    return (
                      <input
                        type="date"
                        className={styles.reportFormInput}
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        max={dateToIso(new Date())}
                      />
                    );
                  })()}
                </div>
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Lokasi Detail (Opsional)</label>
                  <input type="text" className={styles.reportFormInput} placeholder="Contoh: SDN 01 Kebayoran Baru" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
                </div>
              </div>

              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>Judul Laporan <span className={styles.required}>*</span></label>
                <input type="text" className={styles.reportFormInput} placeholder="Contoh: Kegiatan Mengajar Minggu ke-3" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>

              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>Deskripsi Kegiatan <span className={styles.required}>*</span></label>
                <textarea className={styles.reportFormTextarea} placeholder="Ceritakan kegiatan yang dilakukan, kendala yang dihadapi, dan perkembangan siswa..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={5} />
              </div>

              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>
                  Foto Bukti
                  <span className={styles.optionalTag}>opsional · bisa lebih dari 1 · kamera/galeri</span>
                </label>

                {/* Hidden file input — multiple = bisa pilih banyak file */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />

                {formPhotos.length > 0 ? (
                  <div>
                    {/* Grid foto */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
                      {formPhotos.map((src, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            aspectRatio: '4/3',
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb',
                            background: '#f9fafb',
                          }}
                        >
                          <NextImage
                            src={src}
                            alt={`foto ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            width={200}
                            height={150}
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'rgba(0,0,0,0.6)',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Hapus foto"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {idx + 1}
                          </div>
                        </div>
                      ))}

                      {/* Tombol tambah foto */}
                      <button
                        type="button"
                        onClick={() => setPhotoOptionOpen(true)}
                        style={{
                          aspectRatio: '4/3',
                          borderRadius: 8,
                          border: '2px dashed #d1d5db',
                          background: '#f9fafb',
                          color: '#6b7280',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Tambah
                      </button>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0 }}>
                      {formPhotos.length} foto dipilih · klik tanda silang untuk hapus
                    </p>
                  </div>
                ) : (
                  <button type="button" onClick={() => setPhotoOptionOpen(true)} className={styles.uploadPlaceholder}>
                    <div className={styles.uploadIconCircle}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111", margin: 0 }}>Unggah Bukti Foto</p>
                      <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "3px 0 0" }}>Bisa lebih dari satu — kamera atau galeri</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className={styles.reportFormFooter}>
              <button className={styles.btnCancelForm} onClick={closeForm} disabled={submitting} type="button">Batal</button>
              <button className={styles.btnSubmitForm} onClick={handleSubmit} disabled={submitting} type="button">
                {submitting ? (
                  <><Spinner size="sm" style={{ marginRight: "6px" }} />Menyimpan...</>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {editingId ? "Simpan Perubahan" : "Kirim Laporan"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO FULLSCREEN ── */}
      {photoUrl && (
        <div className={styles.previewOverlay} onClick={() => setPhotoUrl(null)}>
          <div className={styles.photoModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.previewClose} onClick={() => setPhotoUrl(null)} type="button" style={{ alignSelf: "flex-end", marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <NextImage 
              src={photoUrl} 
              alt="Bukti foto laporan" 
              className={styles.photoModalImg} 
              width={1200} 
              height={900} 
              unoptimized 
            />
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={styles.reportToastWrapper}>
          <div className={`${styles.reportToast} ${toast.type === "error" ? styles.reportToastError : styles.reportToastSuccess}`}>
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
      
      {photoOptionOpen && (
        <div className={styles.previewOverlay} onClick={() => setPhotoOptionOpen(false)}>
          <div className={styles.optionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.optionHeader}>
              <h3>Pilih Sumber Foto</h3>
              <p>Ambil foto baru atau pilih dari galeri perangkat Anda</p>
            </div>
            
            <div className={styles.optionGrid}>
              <button
                type="button"
                className={styles.optionBtn}
                onClick={() => {
                  setPhotoOptionOpen(false);
                  setCameraOpen(true);
                }}
              >
                <div className={styles.optionIcon} style={{ background: '#f0f4ff', color: '#4f6ef7' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <span>Kamera</span>
              </button>

              <button
                type="button"
                className={styles.optionBtn}
                onClick={() => {
                  setPhotoOptionOpen(false);
                  fileInputRef.current?.click();
                }}
              >
                <div className={styles.optionIcon} style={{ background: '#fdf4ff', color: '#9b5de5' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </div>
                <span>Galeri</span>
              </button>
            </div>

            <button type="button" className={styles.optionCancel} onClick={() => setPhotoOptionOpen(false)}>
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {confirmId && (
        <div className={styles.previewOverlay} onClick={() => setConfirmId(null)}>
          <div className={styles.reportFormPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '24px', textAlign: 'center', margin: 'auto' }}>
            <div style={{ marginBottom: '16px', color: '#dc2626' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text, #111)' }}>Hapus Laporan?</h3>
            <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmId(null)} disabled={deletingId === confirmId} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
              <button onClick={() => handleDelete(confirmId)} disabled={deletingId === confirmId} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {deletingId === confirmId ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
