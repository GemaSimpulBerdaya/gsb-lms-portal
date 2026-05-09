"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import styles from "../relawan.module.css"; 

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Token tidak valid atau tidak ditemukan.");
    }
  }, [token]);

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!token) {
      setError("Token tidak valid.");
      return;
    }

    if (!password || !confirmPassword) {
      setError("Semua field wajib diisi.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Terjadi kesalahan.");
      } else {
        setMessage(data.message || "Password berhasil diubah.");
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      }
    } catch (err: any) {
      setError("Tidak dapat terhubung ke server.");
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

        <h1 className={styles.cardTitle}>Reset Password</h1>
        <p className={styles.cardSubtitle}>Silakan atur ulang password baru Anda di bawah ini.</p>

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
          <label className={styles.fieldLabel}>Password Baru</label>
          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              className={styles.inputField}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading || !token}
            />
            <button className={styles.eyeToggle} onClick={() => setShowPassword(!showPassword)} type="button">
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Konfirmasi Password</label>
          <div className={styles.inputWrapper}>
            <input
              type={showPassword ? "text" : "password"}
              className={styles.inputField}
              placeholder="••••••••"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading || !token}
            />
          </div>
        </div>

        <button 
          className={styles.signInBtn} 
          onClick={handleSubmit}
          disabled={loading || !token}
          style={(loading || !token) ? { opacity: 0.7, cursor: "not-allowed" } : {}}
        >
          {loading ? "Menyimpan..." : "Simpan Password"}
        </button>
      </div>
    </div>
  );
}
