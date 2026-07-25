"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./report.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import ToastNotification from "@/components/toast/Toast";
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
import { useReportForm } from "./_hooks/useReportForm";
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
    reportsPerPage,
    fetchReports,
    isReadOnly,
    selectedScheduleLabel,
  } = useReportingList({ setToast });

  const {
    photoOptionOpen,
    setPhotoOptionOpen,
    formOpen,
    editingId,
    submitting,
    formDate,
    setFormDate,
    formTitle,
    setFormTitle,
    formDesc,
    setFormDesc,
    formLocation,
    setFormLocation,
    formScheduleId,
    formPhotos,
    cameraOpen,
    setCameraOpen,
    fileInputRef,
    openAdd,
    openEdit,
    closeForm,
    handleFileChange,
    removePhoto,
    handleSubmit,
    handleScheduleChange,
    handleCameraCapture,
    openCameraFromSource,
    openGalleryFromSource,
  } = useReportForm({
    isReadOnly,
    selectedSemester,
    schedules,
    queryScheduleId: qsScheduleId,
    queryDate: qsDate,
    setReports,
    setTotal,
    setToast,
  });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  // Photo preview modal
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Detail modal
  const [detailReport, setDetailReport] = useState<Report | null>(null);

  // Lock body scroll
  useEffect(() => {
    const anyOpen = formOpen || !!photoUrl || !!detailReport;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, photoUrl, detailReport]);

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

  const filtered = reports;
  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Camera modal sits above everything */}
      {cameraOpen && (
        <CameraModal
          onCapture={handleCameraCapture}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>

        {/* ── Hero ── */}
        <ReportingHero isReadOnly={isReadOnly} />

        {/* ── Filter Bar ── */}
        <ReportingFilters
          selectedSemester={selectedSemester}
          schedules={schedules}
          total={total}
          monthFilter={monthFilter}
          scheduleFilter={searchQuery}
          keywordFilter={keywordFilter}
          isReadOnly={isReadOnly}
          onMonthChange={setMonthFilter}
          onScheduleChange={setSearchQuery}
          onKeywordChange={setKeywordFilter}
          onCreateClick={openAdd}
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
        <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      
      {photoOptionOpen && (
        <PhotoSourceModal
          onClose={() => setPhotoOptionOpen(false)}
          onOpenCamera={openCameraFromSource}
          onOpenGallery={openGalleryFromSource}
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
