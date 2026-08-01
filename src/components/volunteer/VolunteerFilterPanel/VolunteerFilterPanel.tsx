import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { SlidersHorizontal } from "lucide-react";
import styles from "./VolunteerFilterPanel.module.css";

type VolunteerFilterPanelProps = {
  title: string;
  children: ReactNode;
  description?: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

/** Kartu filter standar untuk halaman portal relawan. */
export default function VolunteerFilterPanel({
  title,
  children,
  description,
  icon: Icon = SlidersHorizontal,
  className,
}: VolunteerFilterPanelProps) {
  return (
    <section className={`${styles.panel} ${className || ""}`}>
      <div className={styles.header}>
        <Icon size={16} aria-hidden />
        <div>
          <h2 className={styles.title}>{title}</h2>
          {description && <p className={styles.description}>{description}</p>}
        </div>
      </div>
      <div className={styles.content}>{children}</div>
    </section>
  );
}
