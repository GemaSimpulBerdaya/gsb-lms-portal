"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./report.module.css";

type Report = {
  _id: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  location?: string;
  createdAt: string;
};

type Toast = { type: "success" | "error"; message: string } | null;

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formPhoto, setFormPhoto] = useState("");

  // Photo preview modal
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReports = useCallback(async (pg = 1, append = false) => {
    try {
      const res = await fetch(`/api/reports/me?page=${pg}&limit=9`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports((prev) => (append ? [...prev, ...data.reports] : data.reports));
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      showToast("error", "Gagal memuat laporan. Silakan coba lagi.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    fetchReports(1);
    return () => clearTimeout(t);
  }, [fetchReports]);

  // Lock body scroll when modal open
  useEffect(() => {
    if (formOpen || photoUrl) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, photoUrl]);

  const openForm = () => {
    setFormDate("");
    setFormTitle("");
    setFormDesc("");
    setFormLocation("");
    setFormPhoto("");
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formDesc.trim() || !formDate) {
      showToast("error", "Tanggal, Judul, dan Deskripsi wajib diisi.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc.trim(),
          date: formDate,
          location: formLocation.trim() || undefined,
          photoUrl: formPhoto.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");

      setReports((prev) => [data.report, ...prev]);
      setTotal((t) => t + 1);
      closeForm();
      showToast("success", "Laporan berhasil dikirim.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim laporan.";
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const loadMore = () => {
    if (page >= totalPages) return;
    setLoadingMore(true);
    fetchReports(page + 1, true);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const formatShortDate = (iso: string) =>
    new Date(iso).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });

  const filtered = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.location ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>

      {/* Hero */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>PELAPORAN KEGIATAN</span>
            <h1 className={styles.heroTitle}>
              Laporan<br />Kegiatan.
            </h1>
            <p className={styles.heroDesc}>
              Kirimkan laporan aktivitas mengajar di lapangan kepada Super Admin.
              Lampirkan bukti foto dan lokasi untuk laporan yang lebih lengkap.
            </p>
          </div>
          <div className={styles.heroActions}>
            <button className={styles.btnPublish} onClick={openForm}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Buat<br />Laporan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>TOTAL LAPORAN</label>
            <div className={styles.reportCountBadge}>{total} laporan</div>
          </div>
        </div>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Cari berdasarkan judul atau lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Report Cards */}
      {loading ? (
        <div className={styles.reportLoadingState}>
          <div className={styles.reportSpinner} />
          Memuat laporan...
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.reportEmptyState}>
          <div className={styles.reportEmptyIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <p className={styles.reportEmptyTitle}>
            {searchQuery ? "Laporan tidak ditemukan" : "Belum ada laporan"}
          </p>
          <p className={styles.reportEmptyDesc}>
            {searchQuery
              ? `Tidak ada laporan yang cocok dengan "${searchQuery}".`
              : "Mulai buat laporan kegiatan pertama Anda untuk melaporkan aktivitas di lapangan."}
          </p>
          {!searchQuery && (
            <button className={styles.btnEmptyCreate} onClick={openForm} type="button">
              + Buat Laporan Pertama
            </button>
          )}
        </div>
      ) : (
        <div className={styles.reportGrid}>
          {filtered.map((report, i) => (
            <div
              key={report._id}
              className={`${styles.reportCard} ${mounted ? styles[`cardAnim${Math.min(i + 1, 4)}` as keyof typeof styles] : styles.cardHidden}`}
            >
              {/* Date badge + photo indicator */}
              <div className={styles.reportCardTop}>
                <span className={styles.reportDateBadge}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  {formatShortDate(report.date)}
                </span>
                {report.photoUrl && (
                  <button
                    className={styles.reportPhotoBadge}
                    onClick={() => setPhotoUrl(report.photoUrl!)}
                    type="button"
                    title="Lihat foto"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <polyline points="21 15 16 10 5 21" />
                    </svg>
                    Foto
                  </button>
                )}
              </div>

              {/* Title */}
              <h3 className={styles.reportCardTitle}>{report.title}</h3>

              {/* Description */}
              <p className={styles.reportCardDesc}>{report.description}</p>

              {/* Bottom meta */}
              <div className={styles.reportCardMeta}>
                {report.location && (
                  <span className={styles.reportLocationTag}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {report.location}
                  </span>
                )}
                <span className={styles.reportCardCreated}>
                  Dikirim {formatDate(report.createdAt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Load More */}
      {!loading && page < totalPages && !searchQuery && (
        <div className={styles.loadMoreWrapper}>
          <button
            className={styles.btnLoadMore}
            onClick={loadMore}
            disabled={loadingMore}
          >
            {loadingMore ? "Memuat..." : "Muat Lebih Banyak"}
          </button>
        </div>
      )}

      {/* ── CREATE REPORT MODAL ── */}
      {formOpen && (
        <div className={styles.previewOverlay} onClick={closeForm}>
          <div className={styles.reportFormPanel} onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <div className={styles.reportFormHeader}>
              <div>
                <p className={styles.reportFormLabel}>LAPORAN KEGIATAN</p>
                <h2 className={styles.reportFormTitle}>Buat Laporan Baru</h2>
              </div>
              <button className={styles.previewClose} onClick={closeForm} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Form Body */}
            <div className={styles.reportFormBody}>
              <div className={styles.reportFormRow}>
                {/* Date */}
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Tanggal Kegiatan <span className={styles.required}>*</span></label>
                  <input
                    type="date"
                    className={styles.reportFormInput}
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    max={new Date().toISOString().split("T")[0]}
                  />
                </div>
                {/* Location */}
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Lokasi</label>
                  <input
                    type="text"
                    className={styles.reportFormInput}
                    placeholder="Contoh: SDN 01 Kebayoran Baru"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                  />
                </div>
              </div>

              {/* Title */}
              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>Judul Laporan <span className={styles.required}>*</span></label>
                <input
                  type="text"
                  className={styles.reportFormInput}
                  placeholder="Contoh: Kegiatan Mengajar Minggu ke-3"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                />
              </div>

              {/* Description */}
              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>Deskripsi Kegiatan <span className={styles.required}>*</span></label>
                <textarea
                  className={styles.reportFormTextarea}
                  placeholder="Ceritakan kegiatan yang dilakukan, kendala yang dihadapi, dan perkembangan anak didik..."
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  rows={5}
                />
              </div>

              {/* Photo URL */}
              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>
                  URL Foto Bukti
                  <span className={styles.optionalTag}>opsional</span>
                </label>
                <input
                  type="url"
                  className={styles.reportFormInput}
                  placeholder="https://..."
                  value={formPhoto}
                  onChange={(e) => setFormPhoto(e.target.value)}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className={styles.reportFormFooter}>
              <button className={styles.btnCancelForm} onClick={closeForm} disabled={submitting} type="button">
                Batal
              </button>
              <button className={styles.btnSubmitForm} onClick={handleSubmit} disabled={submitting} type="button">
                {submitting ? (
                  <>
                    <span className={styles.reportSpinnerSm} />
                    Mengirim...
                  </>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    Kirim Laporan
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO PREVIEW MODAL ── */}
      {photoUrl && (
        <div className={styles.previewOverlay} onClick={() => setPhotoUrl(null)}>
          <div className={styles.photoModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.previewClose} onClick={() => setPhotoUrl(null)} type="button" style={{ alignSelf: "flex-end", marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Bukti foto laporan" className={styles.photoModalImg} />
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={styles.reportToastWrapper}>
          <div className={`${styles.reportToast} ${toast.type === "error" ? styles.reportToastError : styles.reportToastSuccess}`}>
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
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
    </div>
  );
}
