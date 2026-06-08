import PhotoGallery from "./PhotoGallery";
import { formatDate, getReportPhotos } from "../_lib/reportingUtils";
import styles from "../report.module.css";

type ReportDetail = {
  _id: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  photoUrls?: string[];
  location?: string;
  region?: string;
  level?: string;
  createdAt: string;
};

type ReportDetailModalProps = {
  report: ReportDetail;
  onClose: () => void;
  onOpenPhoto: (src: string) => void;
};

export default function ReportDetailModal({ report, onClose, onOpenPhoto }: ReportDetailModalProps) {
  const detailPhotos = getReportPhotos(report);
  const subtitle = report.region && report.level
    ? `${report.region} - ${report.level} - ${formatDate(report.date)}`
    : report.location
      ? `${report.location} - ${formatDate(report.date)}`
      : formatDate(report.date);

  const openPhoto = (src: string) => {
    onClose();
    onOpenPhoto(src);
  };

  return (
    <div className={styles.previewOverlay} onClick={onClose}>
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
          <h2 className={styles.previewTitle}>{report.title}</h2>
          <p className={styles.previewSubtitle}>{subtitle}</p>
          <div className={styles.previewActions}>
            {detailPhotos.length > 0 && (
              <button className={styles.btnShareLink} onClick={() => openPhoto(detailPhotos[0])} type="button">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
                Lihat Foto{detailPhotos.length > 1 ? ` (${detailPhotos.length})` : ""}
              </button>
            )}
            <button className={styles.previewClose} onClick={onClose} type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
        <div className={styles.previewScroll}>
          <div className={styles.premiumDetailContent}>
            <div className={styles.detailHeroSection}>
              {detailPhotos.length === 0 ? (
                <div className={styles.detailNoPhoto}>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                  <p>Tidak ada bukti foto</p>
                </div>
              ) : (
                <PhotoGallery photos={detailPhotos} onZoom={openPhoto} />
              )}
            </div>

            <div className={styles.detailInfoSection}>
              <div className={styles.detailHeaderMeta}>
                <div className={styles.detailDateBadge}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                  {formatDate(report.date)}
                </div>
                <div className={styles.detailRegionBadge}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>
                  {report.region && report.level ? `${report.region} - ${report.level}` : (report.location || "Lokasi tidak spesifik")}
                </div>
              </div>

              <div className={styles.detailDescriptionCard}>
                <h4 className={styles.detailSectionTitle}>Deskripsi Kegiatan</h4>
                <p className={styles.detailDescriptionText}>{report.description}</p>
              </div>

              <div className={styles.detailFooterMeta}>
                <p>ID Laporan: <span style={{ fontFamily: "monospace" }}>{report._id}</span></p>
                <p>Dikirim pada: {formatDate(report.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
