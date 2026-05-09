"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "../relawan.module.css"; // Reuse login styles

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!email) {
      setError("Alamat email wajib diisi.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan. Coba lagi nanti.");
      } else {
        setMessage(data.message || "Tautan reset telah dikirim ke email Anda.");
        setEmail("");
      }
    } catch (err: any) {
      setError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginRoot}>
      <div className={styles.brandLogo}>Gema Simpul Berdaya</div>
      
      <div className={styles.card}>
        <div className={styles.logoCircle} style={{ background: "transparent", width: "auto", height: "auto" }}>
          <Image src="/logo-gsb.png" alt="GSB Logo" width={60} height={60} style={{ objectFit: "contain" }} priority />
        </div>

        <h1 className={styles.cardTitle}>Lupa Password</h1>
        <p className={styles.cardSubtitle}>Masukkan email Anda untuk menerima tautan reset password.</p>

        {error && (
          <div style={{ backgroundColor: "#fff1f0", border: "1px solid #ffa39e", padding: "10px", borderRadius: "8px", color: "#cf1322", fontSize: "13px", marginBottom: "20px", textAlign: "center", fontWeight: "600" }}>
            {error}
          </div>
        )}

        {message && (
          <div style={{ backgroundColor: "#f6ffed", border: "1px solid #b7eb8f", padding: "10px", borderRadius: "8px", color: "#389e0d", fontSize: "13px", marginBottom: "20px", textAlign: "center", fontWeight: "600" }}>
            {message}
          </div>
        )}

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Email Address</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input
              type="email"
              className={styles.inputField}
              placeholder="hello@gsb.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
            />
          </div>
        </div>

        <button 
          className={styles.signInBtn} 
          onClick={handleSubmit}
          disabled={loading}
          style={loading ? { opacity: 0.7, cursor: "not-allowed" } : {}}
        >
          {loading ? "Mengirim..." : "Kirim Tautan Reset"}
        </button>

        <div className={styles.optionsRow} style={{ justifyContent: "center", marginTop: "20px" }}>
          <button 
            type="button" 
            onClick={() => router.push("/login")} 
            className={styles.forgotLink}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px" }}
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    </div>
  );
}
