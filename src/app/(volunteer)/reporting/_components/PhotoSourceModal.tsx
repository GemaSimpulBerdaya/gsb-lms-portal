import styles from "../report.module.css";

type PhotoSourceModalProps = {
  onClose: () => void;
  onOpenCamera: () => void;
  onOpenGallery: () => void;
};

export default function PhotoSourceModal({ onClose, onOpenCamera, onOpenGallery }: PhotoSourceModalProps) {
  return (
    <div className={styles.previewOverlay} onClick={onClose}>
      <div className={styles.optionModal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.optionHeader}>
          <h3>Pilih Sumber Foto</h3>
          <p>Ambil foto baru atau pilih dari galeri perangkat Anda</p>
        </div>

        <div className={styles.optionGrid}>
          <button
            type="button"
            className={styles.optionBtn}
            onClick={onOpenCamera}
          >
            <div className={styles.optionIcon} style={{ background: "#f0f4ff", color: "#4f6ef7" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></svg>
            </div>
            <span>Kamera</span>
          </button>

          <button
            type="button"
            className={styles.optionBtn}
            onClick={onOpenGallery}
          >
            <div className={styles.optionIcon} style={{ background: "#fdf4ff", color: "#9b5de5" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
            </div>
            <span>Galeri</span>
          </button>
        </div>

        <button type="button" className={styles.optionCancel} onClick={onClose}>
          Batal
        </button>
      </div>
    </div>
  );
}
