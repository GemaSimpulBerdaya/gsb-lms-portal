"use client";

import { ReactNode } from "react";
import { createPortal } from "react-dom";
import { X, type LucideIcon } from "lucide-react";
import { useMounted } from "@/hooks/useMounted";
import styles from "./AdminModal.module.css";

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  size?: "sm" | "md" | "lg";
  /** Body content (form fields, etc.) — sits in scrollable area */
  children: ReactNode;
  /** Footer content (typically Cancel + Submit buttons) — sticky at bottom */
  footer?: ReactNode;
  /** Optional onSubmit if children are wrapped in a form */
  onSubmit?: (e: React.FormEvent) => void;
}

/**
 * Shared modal shell for the admin area.
 * - Sticky dark header with title, subtitle, optional icon, and close button
 * - Scrollable light body
 * - Optional sticky footer (for action buttons)
 *
 * The whole modal is wrapped in a `<form>` if `onSubmit` is provided so buttons in
 * the footer can submit naturally.
 */
export default function AdminModal({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  size = "md",
  children,
  footer,
  onSubmit,
}: AdminModalProps) {
  const mounted = useMounted();

  if (!isOpen || !mounted) return null;

  const sizeClass =
    size === "lg" ? styles.modalLg : size === "sm" ? styles.modalSm : "";

  const innerWrapper = onSubmit ? (
    <form
      onSubmit={onSubmit}
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
      }}
    >
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </form>
  ) : (
    <>
      <div className={styles.body}>{children}</div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </>
  );

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={`${styles.modal} ${sizeClass}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.header}>
          <div className={styles.headerTitle}>
            {Icon && (
              <div className={styles.headerIcon}>
                <Icon size={22} />
              </div>
            )}
            <div className={styles.titleGroup}>
              <h2 className={styles.title}>{title}</h2>
              {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label="Tutup"
          >
            <X size={18} />
          </button>
        </div>
        {innerWrapper}
      </div>
    </div>,
    document.body
  );
}
