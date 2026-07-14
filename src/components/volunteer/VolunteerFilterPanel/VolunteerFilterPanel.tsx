import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SlidersHorizontal } from "lucide-react";
import styles from "./VolunteerFilterPanel.module.css";

type VolunteerFilterPanelProps = {
  title: string;
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

/** Kartu filter standar untuk halaman portal relawan. */
export default function VolunteerFilterPanel({
  title,
  children,
  icon: Icon = SlidersHorizontal,
  className,
}: VolunteerFilterPanelProps) {
  return (
    <section className={`${styles.panel} ${className || ""}`}>
      <div className={styles.header}>
        <Icon size={16} aria-hidden />
        <h2 className={styles.title}>{title}</h2>
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
