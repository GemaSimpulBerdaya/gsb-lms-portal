"use client";

import styles from "./StatCard.module.css";
import { ReactNode, useEffect, useRef, useState } from "react";

interface StatCardProps {
  title: string;
  value: string | ReactNode;
  icon: ReactNode;
  badge?: ReactNode;
  progress?: number;
  animationDelay?: number;
  /** Durasi animasi count-up (ms). Default 1200ms. */
  countDuration?: number;
}

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

const parseNumeric = (value: string | ReactNode): number | null => {
  if (typeof value !== "string") return null;
  // Ambil angka pertama dari string (handle "1.234", "1,234", "42 siswa", dst).
  const match = value.replace(/[^\d.,-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(/,/g, "");
  if (!match) return null;
  const num = Number(match);
  return Number.isFinite(num) ? num : null;
};

const formatNumber = (n: number) => n.toLocaleString("id-ID");

export default function StatCard({
  title,
  value,
  icon,
  badge,
  progress,
  animationDelay = 0,
  countDuration = 1200,
}: StatCardProps) {
  const target = parseNumeric(value);
  const isNumeric = target !== null;
  const [display, setDisplay] = useState<number>(0);
  const rafRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!isNumeric) return;
    // Reset & restart animation tiap value berubah.
    startedRef.current = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const startDelayMs = Math.max(0, animationDelay * 1000);
    const startTimer = window.setTimeout(() => {
      startedRef.current = true;
      const startValue = 0;
      const endValue = target as number;
      const startTime = performance.now();

      const tick = (now: number) => {
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / countDuration);
        const eased = easeOutCubic(t);
        const current = Math.round(startValue + (endValue - startValue) * eased);
        setDisplay(current);
        if (t < 1) {
          rafRef.current = requestAnimationFrame(tick);
        }
      };

      rafRef.current = requestAnimationFrame(tick);
    }, startDelayMs);

    return () => {
      window.clearTimeout(startTimer);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, isNumeric, animationDelay, countDuration]);

  const renderedValue = isNumeric ? formatNumber(display) : value;

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
      <p className={styles.cardValue}>{renderedValue}</p>

      {progress !== undefined && (
        <div className={styles.progressTrack}>
          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
