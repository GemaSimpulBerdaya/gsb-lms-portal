"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import NextImage from "next/image";
import styles from "../report.module.css";

type CameraModalProps = {
  onCapture: (dataUrl: string) => void;
  onClose: () => void;
};

export default function CameraModal({ onCapture, onClose }: CameraModalProps) {
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
