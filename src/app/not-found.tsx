"use client";

import { useState, useEffect } from "react";
import styles from "./(volunteer)/dashboard/dashboard.module.css";
import { useRouter, usePathname } from "next/navigation";

const navItems = [
  {
    label: "Dashboard",
    path: "/dashboard",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Students",
    path: "/students",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Input Grade",
    path: "/input-grade",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    label: "Report",
    path: "/reporting",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    label: "Schedule",
    path: "/schedule",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
];

const quickLinks = [
  {
    label: "Students",
    path: "/students",
    desc: "Kelola siswa",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Input Grade",
    path: "/input-grade",
    desc: "Input nilai",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    label: "Report",
    path: "/reporting",
    desc: "Lihat laporan",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
];

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState("--:--:--");

  const currentYear = new Date().getFullYear();

  // Jam real-time
  useEffect(() => {
    const update = () => {
      const now = new Date();
      setTime(
        now.toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Ambil nama halaman dari pathname (misal /dashboard/xyz → "dashboard/xyz")
  const errorPath = pathname || "/tidak-diketahui";

  return (
    <div className={`${styles.container} ${mounted ? styles.mounted : ""}`}>

      {/* ── SIDEBAR ── */}
      

      {/* ── MAIN ── */}
      <main className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100%",
          padding: "48px 24px",
          textAlign: "center",
          position: "relative",
        }}>

          {/* 404 outline dekoratif belakang */}
          <div style={{
            fontSize: "clamp(110px, 20vw, 200px)",
            fontWeight: 900,
            lineHeight: 1,
            color: "transparent",
            WebkitTextStroke: "1.5px #e9ecef",
            letterSpacing: "-0.05em",
            userSelect: "none",
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -58%)",
            opacity: mounted ? 1 : 0,
            transition: "opacity 1s 0.1s ease",
            pointerEvents: "none",
          }}>
            404
          </div>

          {/* Konten utama */}
          <div style={{
            position: "relative",
            zIndex: 1,
            opacity: mounted ? 1 : 0,
            transform: mounted ? "translateY(0)" : "translateY(14px)",
            transition: "all 0.6s 0.2s cubic-bezier(0.22, 1, 0.36, 1)",
          }}>

            {/* Ikon jam + konstruksi */}
            <div style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "#fff8e1",
              border: "1px solid #ffe082",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
              position: "relative",
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f9a825" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {/* Titik kecil animasi di pojok ikon */}
              <span style={{
                position: "absolute",
                top: -2,
                right: -2,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "#ff9800",
                border: "2px solid #fff",
              }} />
            </div>

            {/* Label Page Not Found */}
            <span style={{
              display: "inline-block",
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.1em",
              textTransform: "uppercase" as const,
              color: "#adb5bd",
              marginBottom: 10,
            }}>
              Page Not Found
            </span>

            {/* Heading */}
            <h1 style={{
              fontSize: 21,
              fontWeight: 700,
              color: "#212529",
              margin: "0 0 8px",
              lineHeight: 1.3,
            }}>
              Halaman ini segera hadir
            </h1>

            {/* Deskripsi */}
            <p style={{
              fontSize: 14,
              color: "#868e96",
              maxWidth: 380,
              margin: "0 auto 24px",
              lineHeight: 1.65,
            }}>
              Halaman yang kamu tuju masih dalam tahap pengembangan. Silakan kembali ke dashboard atau navigasi melalui menu di samping.
            </p>

            {/* Info box: path error + jam + tahun */}
            <div style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0,
              background: "#f8f9fa",
              border: "1px solid #e9ecef",
              borderRadius: 10,
              padding: "12px 0",
              marginBottom: 32,
              overflow: "hidden",
              fontSize: 12,
            }}>
              {/* Path error */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 18px",
                borderRight: "1px solid #e9ecef",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span style={{ color: "#868e96", fontWeight: 500 }}>Halaman:</span>
                <code style={{
                  color: "#495057",
                  background: "#e9ecef",
                  padding: "2px 8px",
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', monospace",
                }}>
                  {errorPath}
                </code>
              </div>

              {/* Jam real-time */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 18px",
                borderRight: "1px solid #e9ecef",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span style={{
                  color: "#495057",
                  fontWeight: 600,
                  fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', monospace",
                  fontSize: 12,
                  letterSpacing: "0.02em",
                  minWidth: 70,
                }}>
                  {time}
                </span>
              </div>

              {/* Tahun */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "0 18px",
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#adb5bd" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span style={{
                  color: "#495057",
                  fontWeight: 600,
                  fontFamily: "'SF Mono', 'Fira Code', 'Fira Mono', monospace",
                  fontSize: 12,
                }}>
                  {currentYear}
                </span>
              </div>
            </div>

            {/* Tombol aksi */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              marginBottom: 48,
              flexWrap: "wrap" as const,
            }}>
              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: "none",
                  background: "#212529",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.2s, transform 0.2s, box-shadow 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "#343a40";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.12)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "#212529";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
                Ke Dashboard
              </button>

              <button
                onClick={() => router.back()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 22px",
                  borderRadius: 8,
                  border: "1px solid #dee2e6",
                  background: "#fff",
                  color: "#495057",
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "border-color 0.2s, background 0.2s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "#adb5bd";
                  e.currentTarget.style.background = "#f8f9fa";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "#dee2e6";
                  e.currentTarget.style.background = "#fff";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="19" y1="12" x2="5" y2="12" />
                  <polyline points="12 19 5 12 12 5" />
                </svg>
                Kembali
              </button>
            </div>

            {/* Quick Links */}
            <div style={{ maxWidth: 480, margin: "0 auto" }}>
              <p style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                textTransform: "uppercase" as const,
                color: "#ced4da",
                marginBottom: 14,
              }}>
                Atau langsung ke
              </p>

              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
              }}>
                {quickLinks.map((link, i) => (
                  <button
                    key={link.label}
                    onClick={() => router.push(link.path)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                      padding: "20px 12px",
                      borderRadius: 10,
                      border: "1px solid #e9ecef",
                      background: "#fff",
                      cursor: "pointer",
                      transition: "border-color 0.2s, box-shadow 0.2s, background 0.2s",
                      opacity: mounted ? 1 : 0,
                      animation: mounted
                        ? `qlIn 0.45s ${0.35 + i * 0.07}s cubic-bezier(0.22,1,0.36,1) both`
                        : "none",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = "#dee2e6";
                      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.05)";
                      e.currentTarget.style.background = "#fafbfc";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = "#e9ecef";
                      e.currentTarget.style.boxShadow = "none";
                      e.currentTarget.style.background = "#fff";
                    }}
                  >
                    <div style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: "#f8f9fa",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {link.icon}
                    </div>
                    <div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#343a40",
                        marginBottom: 2,
                      }}>
                        {link.label}
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: "#adb5bd",
                      }}>
                        {link.desc}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <style jsx global>{`
        @keyframes qlIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        button:focus { outline: none; }
        button:focus-visible {
          outline: 2px solid rgba(33,37,41,0.25);
          outline-offset: 2px;
        }
      `}</style>
    </div>
  );
}