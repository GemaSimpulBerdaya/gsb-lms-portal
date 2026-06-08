"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./report.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import { dateToIso } from "@/utils/formatters";
import { compressDataUrl, dataUrlToFile, extFromDataUrl } from "@/utils/image";
import { uploadFiles } from "@/lib/uploadthing";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import CameraModal from "./_components/CameraModal";
import DeleteConfirmModal from "./_components/DeleteConfirmModal";
import PhotoLightbox from "./_components/PhotoLightbox";
import PhotoSourceModal from "./_components/PhotoSourceModal";
import ReportFormModal from "./_components/ReportFormModal";
import ReportingFilters from "./_components/ReportingFilters";
import ReportingHero from "./_components/ReportingHero";
import ReportsEmptyState from "./_components/ReportsEmptyState";
import ReportsSkeleton from "./_components/ReportsSkeleton";
import ReportsTable from "./_components/ReportsTable";
import ReportDetailModal from "./_components/ReportDetailModal";
import { useReportingList } from "./_hooks/useReportingList";
import type { Report, Toast } from "./_lib/reportingTypes";

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

  const [toast, setToast] = useState<Toast>(null);
  const {
    mounted,
    reports,
    setReports,
    loading,
    page,
    totalPages,
    total,
    setTotal,
    searchQuery,
    setSearchQuery,
    monthFilter,
    setMonthFilter,
    keywordFilter,
    setKeywordFilter,
    schedules,
    selectedSemester,
    setSelectedSemester,
    availableSemesters,
    reportsPerPage,
    fetchReports,
    isReadOnly,
    selectedScheduleLabel,
  } = useReportingList({ setToast });

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
  // Photos: array of data-URLs (captured) atau URL eksternal.
  const [formPhotos, setFormPhotos] = useState<string[]>([]);

  // Camera modal
  const [cameraOpen, setCameraOpen] = useState(false);

  // Photo preview modal
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Detail modal
  const [detailReport, setDetailReport] = useState<Report | null>(null);

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
        <ReportingHero isReadOnly={isReadOnly} onCreate={openAdd} />

        {/* ── Filter Bar ── */}
        <ReportingFilters
          availableSemesters={availableSemesters}
          selectedSemester={selectedSemester}
          schedules={schedules}
          total={total}
          monthFilter={monthFilter}
          scheduleFilter={searchQuery}
          keywordFilter={keywordFilter}
          onSemesterChange={setSelectedSemester}
          onMonthChange={setMonthFilter}
          onScheduleChange={setSearchQuery}
          onKeywordChange={setKeywordFilter}
        />

        {/* ── Cards ── */}
        {loading ? (
          <ReportsSkeleton />
        ) : filtered.length === 0 ? (
          <ReportsEmptyState
            hasScheduleFilter={Boolean(searchQuery)}
            hasMonthOrKeywordFilter={Boolean(monthFilter || keywordFilter)}
            isReadOnly={isReadOnly}
            scheduleLabel={selectedScheduleLabel}
            onCreate={openAdd}
          />
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
