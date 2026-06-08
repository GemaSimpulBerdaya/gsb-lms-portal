import styles from "../report.module.css";

export default function ReportsSkeleton() {
  return (
    <div className={styles.reportTableWrap}>
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className={styles.reportSkeletonRow}>
          <span />
          <span />
          <span />
        </div>
      ))}
    </div>
  );
}
