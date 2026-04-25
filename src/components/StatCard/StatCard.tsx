import styles from "./StatCard.module.css";
import { ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | ReactNode;
  icon: ReactNode;
  badge?: ReactNode;
  progress?: number;
  animationDelay?: number;
}

export default function StatCard({
  title,
  value,
  icon,
  badge,
  progress,
  animationDelay = 0,
}: StatCardProps) {
  return (
    <div
      className={styles.card}
      style={{ animationDelay: `${animationDelay}s` }}
    >
      <div className={styles.cardTop}>
        <div className={styles.cardIcon}>{icon}</div>
        {badge}
      </div>
      <p className={styles.cardLabel}>{title}</p>
      <p className={styles.cardValue}>{value}</p>
      
      {progress !== undefined && (
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
