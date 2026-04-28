"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./report.module.css";

// ─── Types ────────────────────────────────────────────────────────────────────

type Report = {
  _id: string;
  title: string;
  description: string;
  date: string;
  photoUrl?: string;
  location?: string;
  createdAt: string;
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
  const [photoModeOpen, setPhotoModeOpen] = useState(false);;

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
    startStream(facingMode);
    return () => {
      // cleanup on unmount
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          <img
            src={capturedUrl}
            alt="hasil foto"
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
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
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
  const [submitting, setSubmitting] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formLocation, setFormLocation] = useState("");
  // Photo: stores either a data-URL (captured) or empty string
  const [formPhoto, setFormPhoto] = useState<string>("");

  // Camera modal
  const [cameraOpen, setCameraOpen] = useState(false);

  // Photo preview modal
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  // Detail modal
  const [detailReport, setDetailReport] = useState<Report | null>(null);

  // ── Utils ─────────────────────────────────────────────────────────────────
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchReports = useCallback(async (pg = 1, append = false) => {
    try {
      const res = await fetch(`/api/reports/me?page=${pg}&limit=9`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports((prev) => (append ? [...prev, ...data.reports] : data.reports));
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      showToast("error", "Gagal memuat laporan. Silakan coba lagi.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    fetchReports(1);
    return () => clearTimeout(t);
  }, [fetchReports]);

  // Lock body scroll
  useEffect(() => {
    const anyOpen = formOpen || !!photoUrl || !!detailReport;
    document.body.style.overflow = anyOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, photoUrl, detailReport]);

  // ── Form ──────────────────────────────────────────────────────────────────
  const openForm = () => {
    setFormDate("");
    setFormTitle("");
    setFormDesc("");
    setFormLocation("");
    setFormPhoto("");
    setFormOpen(true);
  };

  const closeForm = () => setFormOpen(false);

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

  const handleSubmit = async () => {
    if (!formTitle.trim() || !formDesc.trim() || !formDate) {
      showToast("error", "Tanggal, Judul, dan Deskripsi wajib diisi.");
      return;
    }
    setSubmitting(true);
    try {
      // If photo was captured (data URL), resolve to a hosted URL first
      let resolvedPhotoUrl: string | undefined;
      if (formPhoto.startsWith("data:")) {
        resolvedPhotoUrl = await resolvePhotoUrl(formPhoto);
      }

      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formTitle.trim(),
          description: formDesc.trim(),
          date: formDate,
          location: formLocation.trim() || undefined,
          photoUrl: resolvedPhotoUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
      setReports((prev) => [data.report, ...prev]);
      setTotal((t) => t + 1);
      closeForm();
      showToast("success", "Laporan berhasil dikirim.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Gagal mengirim laporan.";
      showToast("error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const loadMore = () => {
    if (page >= totalPages) return;
    setLoadingMore(true);
    fetchReports(page + 1, true);
  };

  const filtered = reports.filter(
    (r) =>
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.location ?? "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Camera modal sits above everything */}
      {cameraOpen && (
        <CameraModal
          onCapture={(dataUrl) => {
            setFormPhoto(dataUrl);
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
            </div>
            <div className={styles.heroActions}>
              <button className={styles.btnPublish} onClick={openForm}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                <span>Buat<br />Laporan</span>
              </button>
            </div>
          </div>
        </div>

        {/* ── Filter Bar ── */}
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>TOTAL LAPORAN</label>
              <div className={styles.reportCountBadge}>{total} laporan</div>
            </div>
          </div>
          <div className={styles.searchWrapper}>
            <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className={styles.searchInput}
              placeholder="Cari berdasarkan judul atau lokasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
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
            {!searchQuery && (
              <button className={styles.btnEmptyCreate} onClick={openForm} type="button">
                + Buat Laporan Pertama
              </button>
            )}
          </div>
        ) : (
          <div className={styles.gallery}>
            {filtered.map((report, index) => (
              <div
                key={report._id}
                className={`${styles.studentCard} ${mounted ? styles[`cardAnim${(index % 4) + 1}` as keyof typeof styles] : styles.cardHidden}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.avatarWrapper}>
                    {report.photoUrl ? (
                      <img src={report.photoUrl} alt="foto" className={styles.avatar} style={{ objectFit: "cover" }} />
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
                      <button className={styles.moreBtn}>•••</button>
                    </div>
                    <p className={styles.studentCourse}>
                      {report.location ? <>{report.location} •<br />Kegiatan Lapangan</> : <>Tanpa Lokasi •<br />Kegiatan Lapangan</>}
                    </p>
                  </div>
                </div>

                <div className={styles.idBadge}>
                  <span className={styles.idTag}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "middle" }}>
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    {formatShortDate(report.date)}
                  </span>
                  {report.photoUrl && (
                    <span
                      className={styles.idTag}
                      style={{ marginLeft: 6, cursor: "pointer" }}
                      onClick={() => setPhotoUrl(report.photoUrl!)}
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 4, verticalAlign: "middle" }}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      Foto
                    </span>
                  )}
                </div>

                <div className={styles.statsRow}>
                  <div className={styles.statBlock}>
                    <span className={styles.statLabel}>DIKIRIM</span>
                    <span className={styles.statValue} style={{ fontSize: "0.82rem" }}>
                      {formatShortDate(report.createdAt)}
                    </span>
                  </div>
                  <div className={styles.statBlock}>
                    <span className={styles.statLabel}>KATA</span>
                    <span className={`${styles.statValue} ${styles.scoreValue}`}>
                      {report.description.split(" ").length}
                      <span className={styles.statSuffix}> kata</span>
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: "0.78rem", color: "var(--text-muted,#6b7280)", lineHeight: 1.55, margin: "0 0 12px", padding: "0 2px" }}>
                  {excerpt(report.description)}
                </p>

                <div className={styles.cardActions}>
                  <button className={styles.btnDetails} onClick={() => setDetailReport(report)} type="button">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                    </svg>
                    Detail
                  </button>
                  {report.photoUrl ? (
                    <button className={styles.btnReview} onClick={() => setPhotoUrl(report.photoUrl!)} type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      Lihat<br />Foto
                    </button>
                  ) : (
                    <button className={styles.btnGenerate} onClick={openForm} type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Laporan<br />Baru
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More */}
        {!loading && page < totalPages && !searchQuery && (
          <div className={styles.loadMoreWrapper}>
            <button className={styles.btnLoadMore} onClick={loadMore} disabled={loadingMore} type="button">
              {loadingMore ? "Memuat..." : "Load More Gallery Entries"}
            </button>
          </div>
        )}

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
                  {detailReport.location ? `${detailReport.location} — ${formatDate(detailReport.date)}` : formatDate(detailReport.date)}
                </p>
                <div className={styles.previewActions}>
                  {detailReport.photoUrl && (
                    <button className={styles.btnShareLink} onClick={() => { setDetailReport(null); setPhotoUrl(detailReport.photoUrl!); }} type="button">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                      Lihat Foto
                    </button>
                  )}
                  <button className={styles.previewClose} onClick={() => setDetailReport(null)} type="button">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className={styles.previewScroll}>
                <div className={styles.docPaper}>
                  <div className={styles.docHeader}>
                    <div className={styles.docSchoolInfo}>
                      <div className={styles.docSchoolIcon}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <polyline points="14 2 14 8 20 8" />
                        </svg>
                      </div>
                      <div>
                        <p className={styles.docSchoolName}>Laporan Kegiatan Relawan</p>
                        <p className={styles.docSchoolTagline}>Program Pendidikan Lapangan</p>
                      </div>
                    </div>
                    <div className={styles.docTranscriptInfo}>
                      <p className={styles.docTranscriptLabel}>LAPORAN RESMI</p>
                      <p className={styles.docTranscriptTerm}>{formatDate(detailReport.date)}</p>
                      <p className={styles.docTranscriptIssued}>Dikirim {formatDate(detailReport.createdAt)}</p>
                    </div>
                  </div>
                  <div className={styles.docDivider} />
                  <div className={styles.docInfoGrid}>
                    <div className={styles.docInfoCell}><p className={styles.docInfoLabel}>JUDUL</p><p className={styles.docInfoValue}>{detailReport.title}</p></div>
                    <div className={styles.docInfoCell}><p className={styles.docInfoLabel}>TANGGAL</p><p className={styles.docInfoValue}>{formatDate(detailReport.date)}</p></div>
                    <div className={styles.docInfoCell}><p className={styles.docInfoLabel}>LOKASI</p><p className={styles.docInfoValue}>{detailReport.location || "—"}</p></div>
                    <div className={styles.docInfoCell}><p className={styles.docInfoLabel}>BUKTI FOTO</p><p className={styles.docInfoValue}>{detailReport.photoUrl ? "Tersedia" : "Tidak ada"}</p></div>
                  </div>
                  <div className={styles.docSection}>
                    <p className={styles.docSectionTitle}>Deskripsi Kegiatan</p>
                    <blockquote className={styles.docRemarks}>{detailReport.description}</blockquote>
                  </div>
                  {detailReport.photoUrl && (
                    <div className={styles.docSection}>
                      <p className={styles.docSectionTitle}>Bukti Foto</p>
                      <img src={detailReport.photoUrl} alt="bukti foto" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: 8, cursor: "pointer", marginTop: 8 }}
                        onClick={() => { setDetailReport(null); setPhotoUrl(detailReport.photoUrl!); }} />
                    </div>
                  )}
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
                  <h2 className={styles.reportFormTitle}>Buat Laporan Baru</h2>
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
                  <div className={styles.reportFormField}>
                    <label className={styles.reportFormFieldLabel}>Lokasi</label>
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

                {/* ── FOTO — camera only, no URL input ── */}
                <div className={styles.reportFormField}>
                  <label className={styles.reportFormFieldLabel}>
                    Foto Bukti
                    <span className={styles.optionalTag}>opsional · kamera langsung</span>
                  </label>

                  {formPhoto ? (
                    <div
                      style={{
                        position: "relative",
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1.5px solid var(--border,#e5e7eb)",
                      }}
                    >
                      <img
                        src={formPhoto}
                        alt="foto bukti"
                        style={{
                          width: "100%",
                          maxHeight: 200,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />

                      {/* ACTION BUTTONS */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 0,
                          left: 0,
                          right: 0,
                          background:
                            "linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 100%)",
                          padding: "20px 12px 12px",
                          display: "flex",
                          gap: 8,
                          justifyContent: "flex-end",
                        }}
                      >
                        {/* Ambil ulang kamera */}
                        <button
                          type="button"
                          onClick={() => setPhotoOptionOpen(true)}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 6,
                            background: "rgba(255,255,255,0.2)",
                            border: "1px solid rgba(255,255,255,0.3)",
                            color: "#fff",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          📷 Ambil Ulang
                        </button>

                        {/* Hapus */}
                        <button
                          type="button"
                          onClick={() => setFormPhoto("")}
                          style={{
                            padding: "6px 14px",
                            borderRadius: 6,
                            background: "rgba(220,38,38,0.3)",
                            border: "1px solid rgba(220,38,38,0.4)",
                            color: "#fca5a5",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          🗑️ Hapus
                        </button>
                      </div>

                      {/* CHECK ICON */}
                      <div
                        style={{
                          position: "absolute",
                          top: 10,
                          left: 10,
                          background: "#22c55e",
                          borderRadius: "50%",
                          width: 24,
                          height: 24,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        ✔
                      </div>
                    </div>
                  ) : (
                    /* Camera trigger button */
                    <button
                      type="button"
                      onClick={() => setCameraOpen(true)}
                      style={{
                        width: "100%", padding: "22px 16px",
                        borderRadius: 10, cursor: "pointer",
                        border: "2px dashed var(--border,#d1d5db)",
                        background: "var(--surface,#fafafa)",
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center", gap: 10,
                        transition: "border-color 0.2s, background 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent,#4f6ef7)";
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-hover,#f0f4ff)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border,#d1d5db)";
                        (e.currentTarget as HTMLButtonElement).style.background = "var(--surface,#fafafa)";
                      }}
                    >
                      <div style={{
                        width: 44, height: 44, borderRadius: "50%",
                        background: "var(--surface-hover,#f0f4ff)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "var(--accent,#4f6ef7)",
                      }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                          <circle cx="12" cy="13" r="4" />
                        </svg>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <p style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text,#111)", margin: 0 }}>
                          Aktifkan Kamera
                        </p>
                        <p style={{ fontSize: "0.72rem", color: "var(--text-muted,#6b7280)", margin: "3px 0 0" }}>
                          Foto diambil langsung · tidak bisa upload dari galeri
                        </p>
                      </div>
                    </button>
                  )}
                </div>
              </div>

              <div className={styles.reportFormFooter}>
                <button className={styles.btnCancelForm} onClick={closeForm} disabled={submitting} type="button">Batal</button>
                <button className={styles.btnSubmitForm} onClick={handleSubmit} disabled={submitting} type="button">
                  {submitting ? (
                    <><span className={styles.reportSpinnerSm} />Mengirim...</>
                  ) : (
                    <>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="22" y1="2" x2="11" y2="13" />
                        <polygon points="22 2 15 22 11 13 2 9 22 2" />
                      </svg>
                      Kirim Laporan
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
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Bukti foto laporan" className={styles.photoModalImg} />
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
            <div className={styles.photoModal} onClick={(e) => e.stopPropagation()}>

              <h3 style={{ color: "#fff", marginBottom: 16 }}>Pilih Foto</h3>

              {/* CAMERA */}
              <button
                type="button"
                onClick={() => {
                  setPhotoOptionOpen(false);
                  setCameraOpen(true);
                }}
                style={{
                  width: "100%",
                  padding: 12,
                  marginBottom: 10,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                📷 Kamera
              </button>

              {/* GALERI */}
              <button
                type="button"
                onClick={() => {
                  setPhotoOptionOpen(false);
                  fileInputRef.current?.click();
                }}
                style={{
                  width: "100%",
                  padding: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                }}
              >
                🖼️ Galeri
              </button>

              <button
                type="button"
                onClick={() => setPhotoOptionOpen(false)}
                style={{
                  marginTop: 10,
                  color: "red",
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                Batal
              </button>

            </div>
          </div>
        )}

      </div>
    </>
  );
}