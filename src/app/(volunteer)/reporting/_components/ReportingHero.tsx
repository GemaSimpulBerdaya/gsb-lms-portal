import styles from "../report.module.css";

type ReportingHeroProps = {
  isReadOnly: boolean;
  onCreate: () => void;
};

export default function ReportingHero({ isReadOnly, onCreate }: ReportingHeroProps) {
  return (
    <div className={styles.hero}>
      <div className={styles.heroContent}>
        <div className={styles.heroText}>
          <span className={styles.heroLabel}>PELAPORAN KEGIATAN</span>
          <h1 className={styles.heroTitle}>Laporan Kegiatan.</h1>
          <p className={styles.heroDesc}>
            Kirimkan laporan aktivitas mengajar di lapangan kepada Super Admin.
            Foto bukti diambil langsung dari kamera untuk memastikan keaslian laporan.
          </p>
          {isReadOnly && (
            <div style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 14px", background: "rgba(192, 57, 43, 0.1)", color: "#c0392b", borderRadius: "8px", fontSize: "12px", fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
              ARSIP SEMESTER LAMPAU (READ-ONLY)
            </div>
          )}
        </div>
        <div className={styles.heroActions}>
          {!isReadOnly && (
            <button className={styles.btnPublish} onClick={onCreate} type="button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>Buat<br />Laporan</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
