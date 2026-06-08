import styles from "../report.module.css";

type ReportsEmptyStateProps = {
  hasScheduleFilter: boolean;
  hasMonthOrKeywordFilter: boolean;
  isReadOnly: boolean;
  scheduleLabel: string;
  onCreate: () => void;
};

export default function ReportsEmptyState({
  hasScheduleFilter,
  hasMonthOrKeywordFilter,
  isReadOnly,
  scheduleLabel,
  onCreate,
}: ReportsEmptyStateProps) {
  const title = hasScheduleFilter ? "Laporan tidak ditemukan" : "Belum ada laporan";
  const description = scheduleLabel
    ? `Tidak ada laporan untuk jadwal ${scheduleLabel}.`
    : hasMonthOrKeywordFilter
      ? "Tidak ada laporan yang cocok dengan filter saat ini."
      : "Mulai buat laporan kegiatan pertama Anda.";

  return (
    <div className={styles.reportEmptyState}>
      <div className={styles.reportEmptyIcon}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      </div>
      <p className={styles.reportEmptyTitle}>{title}</p>
      <p className={styles.reportEmptyDesc}>{description}</p>
      {!hasScheduleFilter && !isReadOnly && (
        <button className={styles.btnEmptyCreate} onClick={onCreate} type="button">
          + Buat Laporan Pertama
        </button>
      )}
    </div>
  );
}
