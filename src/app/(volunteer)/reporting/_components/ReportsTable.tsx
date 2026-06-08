import { excerpt, formatShortDate, getReportPhotos } from "../_lib/reportingUtils";
import styles from "../report.module.css";

type Report = {
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

type ReportsTableProps = {
  reports: Report[];
  mounted: boolean;
  isReadOnly: boolean;
  onOpenDetail: (report: Report) => void;
  onEdit: (report: Report) => void;
  onDelete: (reportId: string) => void;
};

export default function ReportsTable({
  reports,
  mounted,
  isReadOnly,
  onOpenDetail,
  onEdit,
  onDelete,
}: ReportsTableProps) {
  return (
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
          {reports.map((report, index) => {
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
                    <button className={styles.reportActionButton} onClick={() => onOpenDetail(report)} type="button" title="Lihat detail">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                      </svg>
                    </button>
                    {!isReadOnly && (
                      <>
                        <button className={styles.reportActionButton} onClick={() => onEdit(report)} type="button" title="Edit laporan">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                        </button>
                        <button className={`${styles.reportActionButton} ${styles.reportActionDanger}`} onClick={() => onDelete(report._id)} type="button" title="Hapus laporan">
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
  );
}
