import styles from "../report.module.css";

type DeleteConfirmModalProps = {
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function DeleteConfirmModal({ isDeleting, onCancel, onConfirm }: DeleteConfirmModalProps) {
  return (
    <div className={styles.previewOverlay} onClick={onCancel}>
      <div className={styles.reportFormPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "400px", padding: "24px", textAlign: "center", margin: "auto" }}>
        <div style={{ marginBottom: "16px", color: "#dc2626" }}>
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: "0 auto" }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
        <h3 style={{ fontSize: "1.2rem", marginBottom: "8px", color: "var(--text, #111)" }}>Hapus Laporan?</h3>
        <p style={{ color: "var(--text-muted, #6b7280)", fontSize: "0.9rem", marginBottom: "24px" }}>
          Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
          <button onClick={onCancel} disabled={isDeleting} style={{ padding: "10px 20px", borderRadius: "8px", border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", fontWeight: 600 }}>Batal</button>
          <button onClick={onConfirm} disabled={isDeleting} style={{ padding: "10px 20px", borderRadius: "8px", border: "none", background: "#dc2626", color: "#fff", cursor: "pointer", fontWeight: 600 }}>
            {isDeleting ? "Menghapus..." : "Ya, Hapus"}
          </button>
        </div>
      </div>
    </div>
  );
}
