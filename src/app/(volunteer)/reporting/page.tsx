"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import NextImage from "next/image";
import styles from "./report.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Report = {
  _id: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  photoUrls?: string[];
  location?: string;
  scheduleId?: string;
  region?: string;
  level?: string;
  createdAt: string;
};

type Schedule = {
  _id: string;
  region: string;
  level: string;
  semester: string;
  activeWeek: number;
};

type Toast = { type: "success" | "error"; message: string } | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
  });

const excerpt = (text: string, words = 18) =>
  text.split(" ").slice(0, words).join(" ") +
  (text.split(" ").length > words ? "…" : "");

const accentIdx = (id: string) => id.charCodeAt(id.length - 1) % 4;

// ────────────────────────────────────────────────────────────────────────────
// PhotoGallery — slider untuk multi-foto dengan thumbnail strip + nav panah.
// Kalau cuma 1 foto, render full saja tanpa kontrol.
// ────────────────────────────────────────────────────────────────────────────
type PhotoGalleryProps = {
  photos: string[];
  onZoom: (src: string) => void;
};

function PhotoGallery({ photos, onZoom }: PhotoGalleryProps) {
  const [activeIdx, setActiveIdx] = useState(0);
  const total = photos.length;

  // Reset ke 0 kalau jumlah foto berubah (mis. modal dibuka untuk laporan lain)
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
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <button className={`${styles.galleryNav} ${styles.galleryNavNext}`} onClick={goNext} type="button" aria-label="Foto selanjutnya">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
        <div className={styles.galleryCounter}>{activeIdx + 1} / {total}</div>
        <button className={styles.galleryZoomBtn} onClick={() => onZoom(activeSrc)} type="button" aria-label="Perbesar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
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

// ────────────────────────────────────────────────────────────────────────────
// Normalisasi foto dari report — handle baik record lama (photoUrl tunggal)
// maupun record baru (photoUrls array). Return array yang sudah de-dup,
// urutan: photoUrls dulu, lalu photoUrl kalau belum termasuk.
const getReportPhotos = (r: { photoUrl?: string; photoUrls?: string[] }): string[] => {
  const list = Array.isArray(r.photoUrls) ? r.photoUrls.filter(Boolean) : [];
  if (r.photoUrl && !list.includes(r.photoUrl)) {
    list.unshift(r.photoUrl);
  }
  return list;
};

// ─────────────────────────────────────────────────────────────────────────────
// CAMERA MODAL COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

type CameraModalProps = {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
};

function CameraModal({ onCapture, onClose }: CameraModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null)

  const [phase, setPhase] = useState<"init" | "live" | "preview" | "error">("init");
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [shutter, setShutter] = useState(false); // flash animation

  // ── Start stream ──────────────────────────────────────────────────────────
  const startStream = useCallback(async (facing: "environment" | "user") => {
    // stop any existing stream first
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setPhase("init");
    setErrorMsg("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setPhase("live");
    } catch (err: unknown) {
      const msg =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Izin kamera ditolak. Buka pengaturan browser dan izinkan akses kamera."
          : err instanceof DOMException && err.name === "NotFoundError"
            ? "Kamera tidak ditemukan pada perangkat ini."
            : "Kamera tidak dapat diakses. Coba muat ulang halaman.";
      setErrorMsg(msg);
      setPhase("error");
    }
  }, []);

  // ── Mount → start ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      startStream(facingMode);
    }, 0);
    return () => {
      clearTimeout(timer);
      // cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [startStream, facingMode]);

  // ── Flip camera ───────────────────────────────────────────────────────────
  const flipCamera = async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    await startStream(next);
  };

  // ── Take photo ────────────────────────────────────────────────────────────
  const takePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // shutter flash
    setShutter(true);
    setTimeout(() => setShutter(false), 180);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // mirror if front camera
    if (facingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    setCapturedUrl(dataUrl);
    setPhase("preview");

    // stop camera after capture
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  // ── Retake ────────────────────────────────────────────────────────────────
  const retake = async () => {
    setCapturedUrl(null);
    await startStream(facingMode);
  };

  // ── Confirm ───────────────────────────────────────────────────────────────
  const confirmPhoto = () => {
    if (capturedUrl) {
      onCapture(capturedUrl);
      onClose();
    }
  };

  // ── Close ─────────────────────────────────────────────────────────────────
  const handleClose = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onClose();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER — dark full-screen camera UI
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 9999,
        background: "#000",
        display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Top bar ── */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 20px",
        background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
        zIndex: 10,
      }}>
        <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 600, letterSpacing: "0.1em", opacity: 0.8 }}>
          KAMERA BUKTI FOTO
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          {/* Flip camera button — only show when live */}
          {phase === "live" && (
            <button
              onClick={flipCamera}
              style={{
                background: "rgba(255,255,255,0.15)", border: "none",
                borderRadius: "50%", width: 40, height: 40,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#fff",
                backdropFilter: "blur(8px)",
              }}
              title="Balik kamera"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" />
                <path d="M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          )}
          {/* Close */}
          <button
            onClick={handleClose}
            style={{
              background: "rgba(255,255,255,0.15)", border: "none",
              borderRadius: "50%", width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: "#fff",
              backdropFilter: "blur(8px)",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Viewfinder / Preview ── */}
      <div style={{
        position: "relative",
        width: "100%", maxWidth: 640,
        aspectRatio: "16/9",
        background: "#111",
        overflow: "hidden",
      }}>
        {/* Shutter flash */}
        {shutter && (
          <div style={{
            position: "absolute", inset: 0, background: "#fff",
            zIndex: 20, opacity: 0.9,
            animation: "none", // controlled by state
          }} />
        )}

        {/* Live video */}
        {(phase === "init" || phase === "live") && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: "100%", height: "100%",
              objectFit: "cover",
              transform: facingMode === "user" ? "scaleX(-1)" : "none",
              display: phase === "live" ? "block" : "none",
            }}
          />
        )}

        {/* Loading init state */}
        {phase === "init" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%",
              border: "3px solid rgba(255,255,255,0.15)",
              borderTopColor: "#fff",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ color: "rgba(255,255,255,0.6)", fontSize: "0.8rem" }}>
              Mengaktifkan kamera…
            </span>
          </div>
        )}

        {/* Captured preview */}
        {phase === "preview" && capturedUrl && (
          <NextImage
            src={capturedUrl}
            alt="hasil foto"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            width={1280}
            height={720}
            unoptimized
          />
        )}

        {/* Error state */}
        {phase === "error" && (
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: "50%",
              background: "rgba(220,38,38,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>
            <p style={{ color: "#fca5a5", fontSize: "0.82rem", textAlign: "center", lineHeight: 1.6, maxWidth: 320 }}>
              {errorMsg}
            </p>
          </div>
        )}

        {/* Corner guides — only when live */}
        {phase === "live" && (
          <>
            {[
              { top: 12, left: 12, borderTop: "2px solid rgba(255,255,255,0.6)", borderLeft: "2px solid rgba(255,255,255,0.6)" },
              { top: 12, right: 12, borderTop: "2px solid rgba(255,255,255,0.6)", borderRight: "2px solid rgba(255,255,255,0.6)" },
              { bottom: 12, left: 12, borderBottom: "2px solid rgba(255,255,255,0.6)", borderLeft: "2px solid rgba(255,255,255,0.6)" },
              { bottom: 12, right: 12, borderBottom: "2px solid rgba(255,255,255,0.6)", borderRight: "2px solid rgba(255,255,255,0.6)" },
            ].map((s, i) => (
              <div key={i} style={{ position: "absolute", width: 20, height: 20, ...s }} />
            ))}
          </>
        )}
      </div>

      {/* hidden canvas for capture */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* ── Bottom controls ── */}
      <div style={{
        width: "100%", maxWidth: 640,
        padding: "24px 20px 32px",
        background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 24,
      }}>

        {/* LIVE: shutter button */}
        {phase === "live" && (
          <button
            onClick={takePhoto}
            style={{
              width: 68, height: 68, borderRadius: "50%",
              background: "#fff",
              border: "4px solid rgba(255,255,255,0.3)",
              cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 0 0 6px rgba(255,255,255,0.15)",
              transition: "transform 0.1s",
            }}
            title="Ambil foto"
          >
            {/* inner circle */}
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: "#fff", border: "2px solid #ccc" }} />
          </button>
        )}

        {/* PREVIEW: retake + confirm */}
        {phase === "preview" && (
          <>
            <button
              onClick={retake}
              style={{
                padding: "10px 22px",
                borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.1)",
                color: "#fff", fontSize: "0.85rem", fontWeight: 500,
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 4v6h6" />
                <path d="M3.51 15a9 9 0 1 0 .49-3" />
              </svg>
              Ambil Ulang
            </button>

            <button
              onClick={confirmPhoto}
              style={{
                padding: "10px 28px",
                borderRadius: 8, border: "none",
                background: "#fff",
                color: "#111", fontSize: "0.85rem", fontWeight: 600,
                cursor: "pointer",
                display: "flex", alignItems: "center", gap: 7,
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2\.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Gunakan Foto
            </button>
          </>
        )}

        {/* ERROR: retry */}
        {phase === "error" && (
          <button
            onClick={() => startStream(facingMode)}
            style={{
              padding: "10px 24px",
              borderRadius: 8, border: "1.5px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff", fontSize: "0.85rem", fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Coba Lagi
          </button>
        )}
      </div>

      {/* Hint text */}
      {phase === "live" && (
        <p style={{
          position: "absolute", bottom: 10,
          color: "rgba(255,255,255,0.4)", fontSize: "0.7rem",
          letterSpacing: "0.05em",
        }}>
          Foto hanya dapat diambil saat ini secara langsung
        </p>
      )}

      {/* Spin keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [photoOptionOpen, setPhotoOptionOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form modal
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formScheduleId, setFormScheduleId] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  // Photos: array of data-URLs (captured) atau URL eksternal.
  const [formPhotos, setFormPhotos] = useState<string[]>([]);

  // Camera modal
  const [cameraOpen, setCameraOpen] = useState(false);

  // Photo preview modal
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Detail modal
  const [detailReport, setDetailReport] = useState<Report | null>(null);

  const getCurrentSemester = () => {
    const d = new Date();
    return `${d.getFullYear()}-1`;
  };

  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });

  const [availableSemesters, setAvailableSemesters] = useState<string[]>(["2025-1"]);

  const fetchReports = useCallback(async (pg = 1, append = false) => {
    setLoading(append ? false : true);
    if (!append && typeof window !== "undefined") {
      // Scroll ke top saat ganti page (bukan saat load more append)
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    try {
      const query = new URLSearchParams({
        page: pg.toString(),
        limit: "9",
        semester: selectedSemester
      });
      const res = await fetch(`/api/reports/me?${query.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports((prev) => (append ? [...prev, ...data.reports] : data.reports));
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setToast({ type: "error", message: "Gagal memuat laporan. Silakan coba lagi." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [selectedSemester]);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error("Gagal memuat jadwal:", err);
    }
  }, []);

  // Sync with global semester only on initial mount
  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);

          const stored = localStorage.getItem("activeSemester");
          if (data.activeSemester && (!stored || stored === "2025-1")) {
            setSelectedSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };

    fetchGlobalSemester();

    const handleStorage = () => {
      const active = localStorage.getItem("activeSemester");
      if (active) {
        setSelectedSemester(active);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []); // Run only once

  // Keep localStorage in sync
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", selectedSemester);
    }
  }, [selectedSemester]);

  const isReadOnly = selectedSemester !== getCurrentSemester();

  // ── Initial Data ──────────────────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(() => {
      setMounted(true);
      fetchSchedules();
    }, 30);
    return () => clearTimeout(t);
  }, [fetchSchedules]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports(1, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReports]);

  // Lock body scroll
  useEffect(() => {
    const anyOpen = formOpen || !!photoUrl || !!detailReport;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, photoUrl, detailReport]);

  // ── Form ──────────────────────────────────────────────────────────────────
  const openAdd = () => {
    setEditingId(null);
    setFormDate("");
    setFormTitle("");
    setFormDesc("");
    setFormLocation("");
    setFormScheduleId("");
    setFormPhotos([]);
    setFormOpen(true);
  };

  const openEdit = (r: Report) => {
    setEditingId(r._id);
    setFormDate(r.date ? new Date(r.date).toISOString().split("T")[0] : "");
    setFormTitle(r.title);
    setFormDesc(r.description);
    setFormLocation(r.location || "");
    setFormScheduleId(r.scheduleId || "");
    // Prefer photoUrls array; fallback ke photoUrl single (legacy)
    const initial = Array.isArray(r.photoUrls) && r.photoUrls.length > 0
      ? r.photoUrls
      : r.photoUrl ? [r.photoUrl] : [];
    setFormPhotos(initial);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
  };

  /**
   * Kompres image data:URL via canvas — resize ke max 1280px (sisi terpanjang)
   * dan re-encode jadi JPEG quality 0.75. Foto 5MB jadi ~150-300KB, sehingga
   * multi-foto bisa muat di payload tanpa ketabrak body size limit.
   * Format input: data:image/...;base64, format output: data:image/jpeg;base64.
   */
  const compressDataUrl = (dataUrl: string, maxDim = 1280, quality = 0.75): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { resolve(dataUrl); return; }
        ctx.drawImage(img, 0, 0, w, h);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  /**
   * Upload a base64 dataURL to /api/upload (if endpoint exists),
   * otherwise send the dataURL directly as photoUrl.
   * Returns the final URL string.
   */
  const resolvePhotoUrl = async (dataUrl: string): Promise<string> => {
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      return data.url as string;
    } catch {
      // No upload endpoint — fall back to data URL directly
      return dataUrl;
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const accepted: File[] = [];
    Array.from(files).forEach((file) => {
      if (file.size > 10 * 1024 * 1024) {
        setToast({ type: "error", message: `${file.name} terlalu besar (maks 10MB)` });
        setTimeout(() => setToast(null), 3500);
        return;
      }
      accepted.push(file);
    });
    if (accepted.length === 0) {
      e.target.value = "";
      return;
    }

    // Read & compress paralel — push hasil compressed ke state setelah semua selesai
    Promise.all(
      accepted.map(
        (file) =>
          new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onload = async (ev) => {
              const raw = ev.target?.result as string;
              const compressed = await compressDataUrl(raw);
              resolve(compressed);
            };
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
          })
      )
    ).then((results) => {
      const valid = results.filter(Boolean);
      if (valid.length > 0) {
        setFormPhotos((prev) => [...prev, ...valid]);
      }
    });

    // Reset input supaya bisa pilih file yang sama lagi nanti
    e.target.value = "";
  };

  const removePhoto = (idx: number) => {
    setFormPhotos((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (isReadOnly) return;
    if (!formTitle.trim() || !formDesc.trim() || !formDate) {
      setToast({ type: "error", message: "Tanggal, Judul, dan Deskripsi wajib diisi." });
      setTimeout(() => setToast(null), 3500);
      return;
    }
    setSubmitting(true);
    try {
      // Resolve setiap data:URL ke hosted URL (kalau /api/upload tersedia).
      // Yang sudah berupa http URL dilewati apa adanya.
      const resolvedPhotos: string[] = [];
      for (const p of formPhotos) {
        if (p.startsWith("data:")) {
          const url = await resolvePhotoUrl(p);
          resolvedPhotos.push(url);
        } else if (p) {
          resolvedPhotos.push(p);
        }
      }

      // Find schedule info if selected
      let region, level;
      if (formScheduleId) {
         const schedule = schedules.find(s => s._id === formScheduleId);
         if (schedule) {
            region = schedule.region;
            level = schedule.level;
         }
      }

      const isEdit = editingId !== null;
      const res = await fetch("/api/reports", {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isEdit
            ? {
                id: editingId,
                title: formTitle.trim(),
                description: formDesc.trim(),
                date: formDate,
                location: formLocation.trim() || undefined,
                photoUrl: resolvedPhotos[0] || undefined,
                photoUrls: resolvedPhotos,
                scheduleId: formScheduleId || undefined,
                region,
                level,
                semester: selectedSemester,
              }
            : {
                title: formTitle.trim(),
                description: formDesc.trim(),
                date: formDate,
                location: formLocation.trim() || undefined,
                photoUrl: resolvedPhotos[0] || undefined,
                photoUrls: resolvedPhotos,
                scheduleId: formScheduleId || undefined,
                region,
                level,
                semester: selectedSemester,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
      
      if (isEdit) {
        setReports((prev) => prev.map(r => r._id === editingId ? data.report : r));
        setToast({ type: "success", message: "Laporan berhasil diperbarui." });
      } else {
        setReports((prev) => [data.report, ...prev]);
        setTotal((t) => t + 1);
        setToast({ type: "success", message: "Laporan berhasil dikirim." });
      }
      setTimeout(() => setToast(null), 3500);
      closeForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim laporan.";
      setToast({ type: "error", message: msg });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (isReadOnly) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/reports?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus laporan.");
      setReports((prev) => prev.filter((r) => r._id !== id));
      setTotal((t) => t - 1);
      setToast({ type: "success", message: "Laporan berhasil dihapus." });
      setTimeout(() => setToast(null), 3500);
      if (detailReport && detailReport._id === id) {
        setDetailReport(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Terjadi kesalahan.";
      setToast({ type: "error", message: msg });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setDeletingId(null);
      setConfirmId(null);
    }
  };

  const handleScheduleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setFormScheduleId(newId);
    if (newId) {
      const schedule = schedules.find(s => s._id === newId);
      if (schedule) {
        setFormLocation(`${schedule.region} - ${schedule.level}`);
      }
    } else {
      setFormLocation("");
    }
  };

  const filtered = reports.filter((r) => {
    if (!searchQuery) return true;

    const selectedSchedule = schedules.find(
      (s) => String(s._id) === String(searchQuery)
    );

    if (!selectedSchedule) return true;

    // 1. Cocokkan by scheduleId (utama)
    if (r.scheduleId && String(r.scheduleId) === String(searchQuery)) return true;

    // 2. Fallback (data lama atau input manual)
    const rRegion = (r.region || "").toLowerCase().trim();
    const rLevel = (r.level || "").toLowerCase().trim();
    const rLocation = (r.location || "").toLowerCase().trim();

    const sRegion = (selectedSchedule.region || "").toLowerCase().trim();
    const sLevel = (selectedSchedule.level || "").toLowerCase().trim();
    const sCombined = `${sRegion} - ${sLevel}`.toLowerCase().trim();

    return (
      (rRegion === sRegion && rLevel === sLevel) ||
      rLocation === sCombined ||
      rLocation.includes(sCombined)
    );
  });
  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Camera modal sits above everything */}
      {cameraOpen && (
        <CameraModal
          onCapture={async (dataUrl) => {
            // Kompres juga foto hasil capture supaya konsisten dengan upload manual
            const compressed = await compressDataUrl(dataUrl);
            setFormPhotos((prev) => [...prev, compressed]);
            setCameraOpen(false);
          }}
          onClose={() => setCameraOpen(false)}
        />
      )}

      <div className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>

        {/* ── Hero ── */}
        <div className={styles.hero}>
          <div className={styles.heroContent}>
            <div className={styles.heroText}>
              <span className={styles.heroLabel}>PELAPORAN KEGIATAN</span>
              <h1 className={styles.heroTitle}>
                Laporan<br />Kegiatan.
              </h1>
              <p className={styles.heroDesc}>
                Kirimkan laporan aktivitas mengajar di lapangan kepada Super Admin.
                Foto bukti diambil langsung dari kamera untuk memastikan keaslian laporan.
              </p>
              {isReadOnly && (
                <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(192, 57, 43, 0.1)', color: '#c0392b', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  ARSIP SEMESTER LAMPAU (READ-ONLY)
                </div>
              )}
            </div>
            <div className={styles.heroActions}>
              {!isReadOnly && (
                <button className={styles.btnPublish} onClick={openAdd}>
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
        {/* ── Filter Bar ── */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Semester</label>
              <div style={{ position: 'relative' }}>
                <select 
                  className={styles.searchInput} 
                  style={{ appearance: 'none', cursor: 'pointer', paddingRight: '40px', minWidth: '160px' }}
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                >
                  {/* formatSemester helper needed or use raw */}
                  {availableSemesters.map(sem => (
                    <option key={sem} value={sem}>{sem}</option>
                  ))}
                </select>
                <svg style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            </div>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>TOTAL LAPORAN</label>
              <div className={styles.reportCountBadge}>{total} laporan</div>
            </div>
          </div>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <select
              className={styles.searchInput}
              style={{ appearance: 'none', cursor: 'pointer', paddingLeft: '36px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            >
              <option value="">Semua Jadwal</option>
              {schedules
                .filter(s => s.semester === selectedSemester)
                .map(s => (
                  <option key={s._id} value={s._id}>{s.region} - {s.level}</option>
                ))
              }
            </select>
          </div>
        </div>

        {/* ── Cards ── */}
        {loading ? (
          <div className={styles.gallery}>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`${styles.studentCard} ${mounted ? styles[`cardAnim${i + 1}` as keyof typeof styles] : styles.cardHidden}`}
                style={{ opacity: 0.35, pointerEvents: "none" }}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.avatarWrapper}>
                    <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--surface-hover,#f3f4f6)" }} />
                  </div>
                  <div className={styles.cardInfo}>
                    <div style={{ height: 14, width: 130, background: "var(--surface-hover,#f3f4f6)", borderRadius: 4 }} />
                    <div style={{ height: 11, width: 80, background: "var(--surface-hover,#f3f4f6)", borderRadius: 4, marginTop: 8 }} />
                  </div>
                </div>
                <div className={styles.statsRow}>
                  <div className={styles.statBlock}><span className={styles.statLabel}>MEMUAT…</span></div>
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className={styles.reportEmptyState}>
            <div className={styles.reportEmptyIcon}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
            </div>
            <p className={styles.reportEmptyTitle}>
              {searchQuery ? "Laporan tidak ditemukan" : "Belum ada laporan"}
            </p>
            <p className={styles.reportEmptyDesc}>
              {searchQuery
                ? `Tidak ada laporan yang cocok dengan "${searchQuery}".`
                : "Mulai buat laporan kegiatan pertama Anda."}
            </p>
            {!searchQuery && !isReadOnly && (
              <button className={styles.btnEmptyCreate} onClick={openAdd} type="button">
                + Buat Laporan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className={styles.gallery}>
            {filtered.map((report, index) => {
              const photos = getReportPhotos(report);
              const firstPhoto = photos[0];
              return (
              <div
                key={report._id}
                className={`${styles.studentCard} ${mounted ? styles[`cardAnim${(index % 4) + 1}` as keyof typeof styles] : styles.cardHidden}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.avatarWrapper}>
                    {firstPhoto ? (
                      <NextImage 
                        src={firstPhoto} 
                        alt="foto" 
                        className={styles.avatar} 
                        style={{ objectFit: "cover" }} 
                        width={44}
                        height={44}
                        unoptimized
                      />
                    ) : (
                      <div
                        className={styles.avatar}
                        style={{
                          background: ["#f0f4ff", "#fff4f0", "#f0fff4", "#fdf4ff"][accentIdx(report._id)],
                          display: "flex", alignItems: "center", justifyContent: "center",
                          borderRadius: "50%",
                          color: ["#4f6ef7", "#e06c3a", "#3a9e6e", "#9b5de5"][accentIdx(report._id)],
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                          <line x1="16" y1="13" x2="8" y2="13" />
                          <line x1="16" y1="17" x2="8" y2="17" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className={styles.cardInfo}>
                    <div className={styles.cardNameRow}>
                      <h3 className={styles.studentName}>{report.title}</h3>
                      {!isReadOnly && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => openEdit(report)} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer' }} title="Edit">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          </button>
                          <button onClick={() => setConfirmId(report._id)} style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer' }} title="Hapus">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                          </button>
                        </div>
                      )}
                    </div>
                    <p className={styles.studentCourse}>
                      {report.region && report.level ? (
                        <>{report.region} - {report.level} •<br />Kegiatan Lapangan</>
                      ) : report.location ? (
                        <>{report.location} •<br />Kegiatan Lapangan</>
                      ) : (
                        <>Tanpa Lokasi •<br />Kegiatan Lapangan</>
                      )}
                    </p>
                  </div>
                </div>

                <div className={styles.idBadge}>
                  <span className={styles.idTag}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2\.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "middle" }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatShortDate(report.date)}
                  </span>
                  {photos.length > 1 && (
                    <span className={styles.idTag} style={{ marginLeft: 6 }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2\.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "middle" }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8\.5" r="1\.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      {photos.length} Foto
                    </span>
                  )}
                </div>

                <p style={{ fontSize: "0.78rem", color: "var(--text-muted,#6b7280)", lineHeight: 1.55, margin: "12px 0 12px", padding: "0 2px" }}>
                  <strong style={{ color: "var(--text,#111)", display: "block", marginBottom: "4px" }}>Deskripsi:</strong>
                  {excerpt(report.description)}
                </p>

                <div className={styles.cardActions}>
                  <button className={styles.btnDetails} onClick={() => setDetailReport(report)} type="button" style={{ flex: 1 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4\.5C7 4\.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                    Lihat Detail
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && !searchQuery && (
          <div className={styles.paginationWrapper}>
            <div className={styles.paginationInfo}>
              Halaman <strong>{page}</strong> dari <strong>{totalPages}</strong>
              {total > 0 && <span className={styles.paginationTotal}> · {total} laporan</span>}
            </div>
            <div className={styles.paginationControls}>
              <button
                className={styles.paginationBtn}
                onClick={() => fetchReports(1, false)}
                disabled={page <= 1 || loadingMore}
                type="button"
                aria-label="Halaman pertama"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="11 17 6 12 11 7"/><polyline points="18 17 13 12 18 7"/></svg>
              </button>
              <button
                className={styles.paginationBtn}
                onClick={() => fetchReports(page - 1, false)}
                disabled={page <= 1 || loadingMore}
                type="button"
                aria-label="Sebelumnya"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="15 18 9 12 15 6"/></svg>
                <span>Prev</span>
              </button>
              {(() => {
                const windowSize = 5;
                const half = Math.floor(windowSize / 2);
                let start = Math.max(1, page - half);
                const end = Math.min(totalPages, start + windowSize - 1);
                if (end - start + 1 < windowSize) start = Math.max(1, end - windowSize + 1);
                const pages: number[] = [];
                for (let p = start; p <= end; p++) pages.push(p);
                return pages.map((p) => (
                  <button
                    key={p}
                    className={`${styles.paginationBtn} ${p === page ? styles.paginationBtnActive : ""}`}
                    onClick={() => fetchReports(p, false)}
                    disabled={loadingMore}
                    type="button"
                  >
                    {p}
                  </button>
                ));
              })()}
              <button
                className={styles.paginationBtn}
                onClick={() => fetchReports(page + 1, false)}
                disabled={page >= totalPages || loadingMore}
                type="button"
                aria-label="Selanjutnya"
              >
                <span>Next</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="9 18 15 12 9 6"/></svg>
              </button>
              <button
                className={styles.paginationBtn}
                onClick={() => fetchReports(totalPages, false)}
                disabled={page >= totalPages || loadingMore}
                type="button"
                aria-label="Halaman terakhir"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* ── DETAIL MODAL ── */}
      {detailReport && (
        <div className={styles.previewOverlay} onClick={() => setDetailReport(null)}>
          <div className={styles.previewPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.previewTopBar}>
              <div className={styles.previewBreadcrumb}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>LAPORAN KEGIATAN</span>
                <span className={styles.previewBadge}>DETAIL</span>
              </div>
              <h2 className={styles.previewTitle}>{detailReport.title}</h2>
              <p className={styles.previewSubtitle}>
                {detailReport.region && detailReport.level 
                   ? `${detailReport.region} - ${detailReport.level} — ${formatDate(detailReport.date)}`
                   : detailReport.location 
                     ? `${detailReport.location} — ${formatDate(detailReport.date)}` 
                     : formatDate(detailReport.date)}
              </p>
              <div className={styles.previewActions}>
                {(() => {
                  const detailPhotos = getReportPhotos(detailReport);
                  return detailPhotos.length > 0 && (
                    <button className={styles.btnShareLink} onClick={() => { setDetailReport(null); setPhotoUrl(detailPhotos[0]); }} type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      Lihat Foto{detailPhotos.length > 1 ? ` (${detailPhotos.length})` : ""}
                    </button>
                  );
                })()}
                <button className={styles.previewClose} onClick={() => setDetailReport(null)} type="button">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
            <div className={styles.previewScroll}>
              <div className={styles.premiumDetailContent}>
                <div className={styles.detailHeroSection}>
                  {(() => {
                    const detailPhotos = getReportPhotos(detailReport);
                    if (detailPhotos.length === 0) {
                      return (
                        <div className={styles.detailNoPhoto}>
                          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                          <p>Tidak ada bukti foto</p>
                        </div>
                      );
                    }
                    return (
                      <PhotoGallery
                        photos={detailPhotos}
                        onZoom={(src) => { setDetailReport(null); setPhotoUrl(src); }}
                      />
                    );
                  })()}
                </div>

                <div className={styles.detailInfoSection}>
                  <div className={styles.detailHeaderMeta}>
                    <div className={styles.detailDateBadge}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                      {formatDate(detailReport.date)}
                    </div>
                    <div className={styles.detailRegionBadge}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      {detailReport.region && detailReport.level ? `${detailReport.region} - ${detailReport.level}` : (detailReport.location || "Lokasi tidak spesifik")}
                    </div>
                  </div>

                  <div className={styles.detailDescriptionCard}>
                    <h4 className={styles.detailSectionTitle}>Deskripsi Kegiatan</h4>
                    <p className={styles.detailDescriptionText}>{detailReport.description}</p>
                  </div>

                  <div className={styles.detailFooterMeta}>
                    <p>ID Laporan: <span style={{ fontFamily: 'monospace' }}>{detailReport._id}</span></p>
                    <p>Dikirim pada: {formatDate(detailReport.createdAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CREATE REPORT MODAL ── */}
      {formOpen && (
        <div className={styles.previewOverlay} onClick={closeForm}>
          <div className={styles.reportFormPanel} onClick={(e) => e.stopPropagation()}>

            <div className={styles.reportFormHeader}>
              <div>
                <p className={styles.reportFormLabel}>LAPORAN KEGIATAN</p>
                <h2 className={styles.reportFormTitle}>{editingId ? "Edit Laporan" : "Buat Laporan Baru"}</h2>
              </div>
              <button className={styles.previewClose} onClick={closeForm} type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={styles.reportFormBody}>
              <div className={styles.reportFormRow}>
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Tanggal Kegiatan <span className={styles.required}>*</span></label>
                  <input type="date" className={styles.reportFormInput} value={formDate} onChange={(e) => setFormDate(e.target.value)} max={new Date().toISOString().split("T")[0]} />
                </div>
              </div>
              <div className={styles.reportFormRow}>
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Pilih Jadwal </label>
                  <select 
                      className={styles.reportFormInput} 
                      style={{ appearance: 'none', cursor: 'pointer' }}
                      value={formScheduleId} 
                      onChange={handleScheduleChange}
                  >
                      <option value="">-- Tidak Terkait Jadwal --</option>
                      {schedules.map(s => <option key={s._id} value={s._id}>{s.region} - {s.level}</option>)}
                  </select>
                </div>
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>Lokasi Detail (Opsional)</label>
                  <input type="text" className={styles.reportFormInput} placeholder="Contoh: SDN 01 Kebayoran Baru" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} />
                </div>
              </div>

              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>Judul Laporan <span className={styles.required}>*</span></label>
                <input type="text" className={styles.reportFormInput} placeholder="Contoh: Kegiatan Mengajar Minggu ke-3" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
              </div>

              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>Deskripsi Kegiatan <span className={styles.required}>*</span></label>
                <textarea className={styles.reportFormTextarea} placeholder="Ceritakan kegiatan yang dilakukan, kendala yang dihadapi, dan perkembangan anak didik..." value={formDesc} onChange={(e) => setFormDesc(e.target.value)} rows={5} />
              </div>

              <div className={styles.reportFormField}>
                <label className={styles.reportFormFieldLabel}>
                  Foto Bukti
                  <span className={styles.optionalTag}>opsional · bisa lebih dari 1 · kamera/galeri</span>
                </label>

                {/* Hidden file input — multiple = bisa pilih banyak file */}
                <input
                  type="file"
                  ref={fileInputRef}
                  style={{ display: 'none' }}
                  accept="image/*"
                  multiple
                  onChange={handleFileChange}
                />

                {formPhotos.length > 0 ? (
                  <div>
                    {/* Grid foto */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, marginBottom: 10 }}>
                      {formPhotos.map((src, idx) => (
                        <div
                          key={idx}
                          style={{
                            position: 'relative',
                            aspectRatio: '4/3',
                            borderRadius: 8,
                            overflow: 'hidden',
                            border: '1px solid #e5e7eb',
                            background: '#f9fafb',
                          }}
                        >
                          <NextImage
                            src={src}
                            alt={`foto ${idx + 1}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            width={200}
                            height={150}
                            unoptimized
                          />
                          <button
                            type="button"
                            onClick={() => removePhoto(idx)}
                            style={{
                              position: 'absolute',
                              top: 4,
                              right: 4,
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: 'rgba(0,0,0,0.6)',
                              border: 'none',
                              color: '#fff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                            title="Hapus foto"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                          </button>
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              left: 4,
                              padding: '2px 6px',
                              borderRadius: 4,
                              background: 'rgba(0,0,0,0.6)',
                              color: '#fff',
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {idx + 1}
                          </div>
                        </div>
                      ))}

                      {/* Tombol tambah foto */}
                      <button
                        type="button"
                        onClick={() => setPhotoOptionOpen(true)}
                        style={{
                          aspectRatio: '4/3',
                          borderRadius: 8,
                          border: '2px dashed #d1d5db',
                          background: '#f9fafb',
                          color: '#6b7280',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Tambah
                      </button>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: '#6b7280', margin: 0 }}>
                      {formPhotos.length} foto dipilih · klik tanda silang untuk hapus
                    </p>
                  </div>
                ) : (
                  <button type="button" onClick={() => setPhotoOptionOpen(true)} className={styles.uploadPlaceholder}>
                    <div className={styles.uploadIconCircle}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "#111", margin: 0 }}>Unggah Bukti Foto</p>
                      <p style={{ fontSize: "0.72rem", color: "#6b7280", margin: "3px 0 0" }}>Bisa lebih dari satu — kamera atau galeri</p>
                    </div>
                  </button>
                )}
              </div>
            </div>

            <div className={styles.reportFormFooter}>
              <button className={styles.btnCancelForm} onClick={closeForm} disabled={submitting} type="button">Batal</button>
              <button className={styles.btnSubmitForm} onClick={handleSubmit} disabled={submitting} type="button">
                {submitting ? (
                  <><span className={styles.reportSpinnerSm} />Menyimpan...</>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    {editingId ? "Simpan Perubahan" : "Kirim Laporan"}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PHOTO FULLSCREEN ── */}
      {photoUrl && (
        <div className={styles.previewOverlay} onClick={() => setPhotoUrl(null)}>
          <div className={styles.photoModal} onClick={(e) => e.stopPropagation()}>
            <button className={styles.previewClose} onClick={() => setPhotoUrl(null)} type="button" style={{ alignSelf: "flex-end", marginBottom: 12 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <NextImage 
              src={photoUrl} 
              alt="Bukti foto laporan" 
              className={styles.photoModalImg} 
              width={1200} 
              height={900} 
              unoptimized 
            />
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className={styles.reportToastWrapper}>
          <div className={`${styles.reportToast} ${toast.type === "error" ? styles.reportToastError : styles.reportToastSuccess}`}>
            {toast.type === "success" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
            {toast.message}
          </div>
        </div>
      )}
      
      {photoOptionOpen && (
        <div className={styles.previewOverlay} onClick={() => setPhotoOptionOpen(false)}>
          <div className={styles.optionModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.optionHeader}>
              <h3>Pilih Sumber Foto</h3>
              <p>Ambil foto baru atau pilih dari galeri perangkat Anda</p>
            </div>
            
            <div className={styles.optionGrid}>
              <button
                type="button"
                className={styles.optionBtn}
                onClick={() => {
                  setPhotoOptionOpen(false);
                  setCameraOpen(true);
                }}
              >
                <div className={styles.optionIcon} style={{ background: '#f0f4ff', color: '#4f6ef7' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                </div>
                <span>Kamera</span>
              </button>

              <button
                type="button"
                className={styles.optionBtn}
                onClick={() => {
                  setPhotoOptionOpen(false);
                  fileInputRef.current?.click();
                }}
              >
                <div className={styles.optionIcon} style={{ background: '#fdf4ff', color: '#9b5de5' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><polyline points="21 15 16 10 5 21" /></svg>
                </div>
                <span>Galeri</span>
              </button>
            </div>

            <button type="button" className={styles.optionCancel} onClick={() => setPhotoOptionOpen(false)}>
              Batal
            </button>
          </div>
        </div>
      )}

      {/* ── DELETE CONFIRMATION MODAL ── */}
      {confirmId && (
        <div className={styles.previewOverlay} onClick={() => setConfirmId(null)}>
          <div className={styles.reportFormPanel} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '400px', padding: '24px', textAlign: 'center', margin: 'auto' }}>
            <div style={{ marginBottom: '16px', color: '#dc2626' }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto' }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '8px', color: 'var(--text, #111)' }}>Hapus Laporan?</h3>
            <p style={{ color: 'var(--text-muted, #6b7280)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmId(null)} disabled={deletingId === confirmId} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', fontWeight: 600 }}>Batal</button>
              <button onClick={() => handleDelete(confirmId)} disabled={deletingId === confirmId} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontWeight: 600 }}>
                {deletingId === confirmId ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
