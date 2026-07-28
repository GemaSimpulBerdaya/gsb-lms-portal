"use client";

import type { ChangeEvent } from "react";
import { FileUp, Link as LinkIcon } from "lucide-react";
import { Input } from "@/components/admin/ui/FormField";
import styles from "./FileOrLinkField.module.css";

export type MaterialSourceMode = "upload" | "link";

const ACCEPTED_TYPES = ".pdf,.doc,.docx,.ppt,.pptx,image/*";

export default function FileOrLinkField({
  mode,
  url,
  file,
  disabled,
  onModeChange,
  onUrlChange,
  onFileChange,
  onError,
}: {
  mode: MaterialSourceMode;
  url: string;
  file: File | null;
  disabled?: boolean;
  onModeChange: (mode: MaterialSourceMode) => void;
  onUrlChange: (url: string) => void;
  onFileChange: (file: File | null) => void;
  onError: (message: string) => void;
}) {
  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!selected) return;
    const maxSize = selected.type.startsWith("image/") ? 8 : 16;
    if (selected.size > maxSize * 1024 * 1024) {
      onError(`Ukuran ${selected.type.startsWith("image/") ? "gambar" : "file"} maksimal ${maxSize}MB.`);
      return;
    }
    onFileChange(selected);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.tabs} role="group" aria-label="Sumber materi">
        <button
          type="button"
          className={mode === "upload" ? styles.active : ""}
          onClick={() => onModeChange("upload")}
          disabled={disabled}
        >
          <FileUp size={16} /> Upload File
        </button>
        <button
          type="button"
          className={mode === "link" ? styles.active : ""}
          onClick={() => onModeChange("link")}
          disabled={disabled}
        >
          <LinkIcon size={16} /> Tempel Link
        </button>
      </div>

      {mode === "upload" ? (
        <label className={styles.dropzone}>
          <FileUp size={24} />
          <strong>{file?.name || (url ? "File tersimpan — pilih untuk mengganti" : "Pilih file materi")}</strong>
          <span>PDF, Word, PowerPoint maksimal 16MB · gambar maksimal 8MB</span>
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            disabled={disabled}
          />
        </label>
      ) : (
        <Input
          icon={LinkIcon}
          type="url"
          placeholder="https://drive.google.com/... atau https://docs.google.com/..."
          value={url}
          onChange={(event) => onUrlChange(event.target.value)}
          disabled={disabled}
        />
      )}

      {url && !file && (
        <a href={url} target="_blank" rel="noopener noreferrer" className={styles.currentLink}>
          Buka materi saat ini ↗
        </a>
      )}
    </div>
  );
}
