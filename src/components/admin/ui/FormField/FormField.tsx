"use client";

import {
  ReactNode,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { AlertCircle, type LucideIcon } from "lucide-react";
import styles from "./FormField.module.css";

/* ===================== Section ===================== */

interface SectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function Section({ title, description, children }: SectionProps) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {description && <p className={styles.sectionDesc}>{description}</p>}
      {children}
    </div>
  );
}

/* ===================== Row ===================== */

export function Row({ children }: { children: ReactNode }) {
  return <div className={styles.row}>{children}</div>;
}

export function Row3({ children }: { children: ReactNode }) {
  return <div className={styles.row3}>{children}</div>;
}

/* ===================== Field shell ===================== */

interface FieldProps {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}

export function Field({ label, required, hint, children }: FieldProps) {
  return (
    <div className={styles.field}>
      <label className={styles.label}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </label>
      {children}
      {hint && <p className={styles.hint}>{hint}</p>}
    </div>
  );
}

/* ===================== Input ===================== */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: LucideIcon;
}

export function Input({ icon: Icon, className, ...rest }: InputProps) {
  if (!Icon) {
    return <input className={`${styles.input} ${className || ""}`} {...rest} />;
  }
  return (
    <div className={styles.inputWrap}>
      <Icon size={16} className={styles.inputIcon} />
      <input
        className={`${styles.input} ${styles.hasIcon} ${className || ""}`}
        {...rest}
      />
    </div>
  );
}

/* ===================== Select ===================== */

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  icon?: LucideIcon;
  children: ReactNode;
}

export function Select({ icon: Icon, className, children, ...rest }: SelectProps) {
  if (!Icon) {
    return (
      <select className={`${styles.select} ${className || ""}`} {...rest}>
        {children}
      </select>
    );
  }
  return (
    <div className={styles.inputWrap}>
      <Icon size={16} className={styles.inputIcon} />
      <select
        className={`${styles.select} ${styles.hasIcon} ${className || ""}`}
        {...rest}
      >
        {children}
      </select>
    </div>
  );
}

/* ===================== Textarea ===================== */

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  icon?: LucideIcon;
}

export function Textarea({ icon: Icon, className, ...rest }: TextareaProps) {
  if (!Icon) {
    return (
      <textarea className={`${styles.textarea} ${className || ""}`} {...rest} />
    );
  }
  return (
    <div className={styles.inputWrap}>
      <Icon size={16} className={`${styles.inputIcon} ${styles.inputIconTop}`} />
      <textarea
        className={`${styles.textarea} ${styles.hasIcon} ${className || ""}`}
        {...rest}
      />
    </div>
  );
}

/* ===================== Buttons ===================== */

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "cancel" | "danger";
  children: ReactNode;
}

export function Button({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonProps) {
  const variantClass =
    variant === "cancel"
      ? styles.btnCancel
      : variant === "danger"
      ? styles.btnDanger
      : styles.btnPrimary;
  return (
    <button
      className={`${styles.btn} ${variantClass} ${className || ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* ===================== ErrorBox ===================== */

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className={styles.errorBox}>
      <AlertCircle size={18} />
      <span>{message}</span>
    </div>
  );
}

/* ===================== File Upload ===================== */

interface FileUploadProps {
  accept?: string;
  uploading?: boolean;
  uploaded?: boolean;
  uploadedLabel?: string;
  heading?: string;
  hint?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function FileUpload({
  accept,
  uploading,
  uploaded,
  uploadedLabel = "File siap diunggah",
  heading = "Pilih atau Tarik File",
  hint = "Klik untuk memilih file",
  onChange,
}: FileUploadProps) {
  return (
    <div className={styles.fileUpload}>
      <input
        type="file"
        accept={accept}
        onChange={onChange}
        className={styles.fileInputRaw}
      />
      <UploadCloudIcon className={styles.uploadIcon} />
      <div>
        <h4 className={styles.uploadHeading}>{heading}</h4>
        <p className={styles.uploadHint}>{hint}</p>
      </div>
      {uploading && (
        <div className={`${styles.fileStatusBar} ${styles.statusUploading}`}>
          MENGUNGGAH...
        </div>
      )}
      {!uploading && uploaded && (
        <div className={`${styles.fileStatusBar} ${styles.statusSuccess}`}>
          ✓ {uploadedLabel}
        </div>
      )}
    </div>
  );
}

export function OrDivider({ label = "ATAU" }: { label?: string }) {
  return <div className={styles.orDivider}>{label}</div>;
}

/* Local upload icon (avoid extra import) */
function UploadCloudIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" />
      <path d="m16 16-4-4-4 4" />
    </svg>
  );
}
