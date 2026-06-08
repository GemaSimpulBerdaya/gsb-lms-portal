"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./report.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getCurrentSemester, formatSemester, dateToIso } from "@/utils/formatters";
import { compressDataUrl, dataUrlToFile, extFromDataUrl } from "@/utils/image";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import { uploadFiles } from "@/lib/uploadthing";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import CameraModal from "./_components/CameraModal";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import PhotoLightbox from "./_components/PhotoLightbox";
import PhotoSourceModal from "./_components/PhotoSourceModal";
import ReportFormModal from "./_components/ReportFormModal";
import ReportsTable from "./_components/ReportsTable";
import ReportDetailModal from "./_components/ReportDetailModal";
import { MONTH_FILTERS } from "./_lib/reportingUtils";

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
          <ReportsTable
            reports={filtered}
            mounted={mounted}
            isReadOnly={isReadOnly}
            onOpenDetail={setDetailReport}
            onEdit={openEdit}
            onDelete={setConfirmId}
          />
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
        <ReportDetailModal
          report={detailReport}
          onClose={() => setDetailReport(null)}
          onOpenPhoto={setPhotoUrl}
        />
      )}

      {/* ── CREATE REPORT MODAL ── */}
      {formOpen && (
        <ReportFormModal
          editingId={editingId}
          schedules={schedules}
          formScheduleId={formScheduleId}
          formDate={formDate}
          formLocation={formLocation}
          formTitle={formTitle}
          formDesc={formDesc}
          formPhotos={formPhotos}
          submitting={submitting}
          fileInputRef={fileInputRef}
          onClose={closeForm}
          onSubmit={handleSubmit}
          onScheduleChange={handleScheduleChange}
          onDateChange={setFormDate}
          onLocationChange={setFormLocation}
          onTitleChange={setFormTitle}
          onDescChange={setFormDesc}
          onFileChange={handleFileChange}
          onRemovePhoto={removePhoto}
          onOpenPhotoOptions={() => setPhotoOptionOpen(true)}
        />
      )}

      {/* ── PHOTO FULLSCREEN ── */}
      {photoUrl && (
        <PhotoLightbox src={photoUrl} onClose={() => setPhotoUrl(null)} />
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
        <PhotoSourceModal
          onClose={() => setPhotoOptionOpen(false)}
          onOpenCamera={() => {
            setPhotoOptionOpen(false);
            setCameraOpen(true);
          }}
          onOpenGallery={() => {
            setPhotoOptionOpen(false);
            fileInputRef.current?.click();
          }}
        />
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {confirmId && (
        <DeleteConfirmModal
          isDeleting={deletingId === confirmId}
          onCancel={() => setConfirmId(null)}
          onConfirm={() => handleDelete(confirmId)}
        />
      )}
    </>
  );
}
