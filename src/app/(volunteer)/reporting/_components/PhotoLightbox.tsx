import NextImage from "next/image";
import styles from "../report.module.css";

type PhotoLightboxProps = {
  src: string;
  onClose: () => void;
};

export default function PhotoLightbox({ src, onClose }: PhotoLightboxProps) {
  return (
    <div className={styles.previewOverlay} onClick={onClose}>
      <div className={styles.photoModal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.previewClose} onClick={onClose} type="button" style={{ alignSelf: "flex-end", marginBottom: 12 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        <NextImage
          src={src}
          alt="Bukti foto laporan"
          className={styles.photoModalImg}
          width={1200}
          height={900}
          unoptimized
        />
      </div>
    </div>
  );
}
