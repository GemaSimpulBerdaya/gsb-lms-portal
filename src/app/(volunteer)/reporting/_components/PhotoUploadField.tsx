import type { ChangeEvent, RefObject } from "react";
import NextImage from "next/image";
import styles from "../report.module.css";

type PhotoUploadFieldProps = {
  photos: string[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemovePhoto: (index: number) => void;
  onOpenOptions: () => void;
};

export default function PhotoUploadField({
  photos,
  fileInputRef,
  onFileChange,
  onRemovePhoto,
  onOpenOptions,
}: PhotoUploadFieldProps) {
  return (
    <div className={styles.reportFormField}>
      <label className={styles.reportFormFieldLabel}>
        Foto Bukti
        <span className={styles.optionalTag}>bisa lebih dari 1 - kamera/galeri</span>
      </label>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: "none" }}
        accept="image/*"
        multiple
        onChange={onFileChange}
      />

      {photos.length > 0 ? (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 8, marginBottom: 10 }}>
            {photos.map((src, idx) => (
              <div
                key={idx}
                style={{
                  position: "relative",
                  aspectRatio: "4/3",
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid #e5e7eb",
                  background: "#f9fafb",
                }}
              >
                <NextImage
                  src={src}
                  alt={`foto ${idx + 1}`}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  width={200}
                  height={150}
                  unoptimized
                />
                <button
                  type="button"
                  onClick={() => onRemovePhoto(idx)}
                  style={{
                    position: "absolute",
                    top: 4,
                    right: 4,
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.6)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  title="Hapus foto"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
                <div
                  style={{
                    position: "absolute",
                    bottom: 4,
                    left: 4,
                    padding: "2px 6px",
                    borderRadius: 4,
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 600,
                  }}
                >
                  {idx + 1}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={onOpenOptions}
              style={{
                aspectRatio: "4/3",
                borderRadius: 8,
                border: "2px dashed #d1d5db",
                background: "#f9fafb",
                color: "#6b7280",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 500,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Tambah
            </button>
          </div>
          <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: 0 }}>
            {photos.length} foto dipilih - klik tanda silang untuk hapus
          </p>
        </div>
      ) : (
        <button type="button" onClick={onOpenOptions} className={styles.uploadPlaceholder}>
          <div className={styles.uploadIconCircle}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
          </div>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111", margin: 0 }}>Unggah Bukti Foto</p>
            <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "3px 0 0" }}>Bisa lebih dari satu - kamera atau galeri</p>
          </div>
        </button>
      )}
    </div>
  );
}
