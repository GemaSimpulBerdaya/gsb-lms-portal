"use client";

import { useEffect, useState } from "react";
import NextImage from "next/image";
import styles from "../report.module.css";

type PhotoGalleryProps = {
  photos: string[];
  onZoom: (src: string) => void;
};

/**
 * Slider multi-foto untuk detail laporan.
 * Satu foto render sederhana; banyak foto render main image + panah + thumbnail strip.
 */
export default function PhotoGallery({ photos, onZoom }: PhotoGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const total = photos.length;

  // Reset ke 0 kalau jumlah foto berubah (mis. modal dibuka untuk laporan lain).
  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveIdx(0);
    }, 0);
    return () => clearTimeout(timer);
  }, [total]);

  const goPrev = () => setActiveIdx((i) => (i - 1 + total) % total);
  const goNext = () => setActiveIdx((i) => (i + 1) % total);
  const activeSrc = photos[activeIdx];

  if (total === 1) {
    return (
      <div className={styles.detailPhotoWrapper} onClick={() => onZoom(photos[0])}>
        <NextImage
          src={photos[0]}
          alt="bukti foto"
          className={styles.detailPhoto}
          width={800}
          height={600}
          unoptimized
        />
        <div className={styles.detailPhotoOverlay}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
          <span>Perbesar Foto</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.galleryWrapper}>
      <div className={styles.galleryMain}>
        <NextImage
          src={activeSrc}
          alt={`foto ${activeIdx + 1}`}
          className={styles.galleryMainImg}
          onClick={() => onZoom(activeSrc)}
          width={800}
          height={600}
          unoptimized
        />
        <button className={`${styles.galleryNav} ${styles.galleryNavPrev}`} onClick={goPrev} type="button" aria-label="Foto sebelumnya">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <button className={`${styles.galleryNav} ${styles.galleryNavNext}`} onClick={goNext} type="button" aria-label="Foto selanjutnya">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
        <div className={styles.galleryCounter}>{activeIdx + 1} / {total}</div>
        <button className={styles.galleryZoomBtn} onClick={() => onZoom(activeSrc)} type="button" aria-label="Perbesar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>
        </button>
      </div>
      <div className={styles.galleryThumbs}>
        {photos.map((src, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => setActiveIdx(idx)}
            className={`${styles.galleryThumb} ${idx === activeIdx ? styles.galleryThumbActive : ""}`}
            aria-label={`Pilih foto ${idx + 1}`}
          >
            <NextImage
              src={src}
              alt={`thumb ${idx + 1}`}
              width={80}
              height={60}
              unoptimized
            />
          </button>
        ))}
      </div>
    </div>
  );
}
