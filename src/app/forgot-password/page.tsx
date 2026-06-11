import React from "react";
import styles from "../auth.module.css";
import Image from "next/image";

export default function ForgotPasswordPage() {
  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.logoWrapper}>
          <Image src="/images/logo_hitam.png" alt="GSB Logo" width={80} height={80} />
        </div>
        <h1 className={styles.title}>Lupa Password?</h1>
        <p className={styles.subtitle} style={{ marginBottom: "2rem" }}>
          Keamanan akun Tim GSB sangat ketat. Fitur reset password otomatis telah dinonaktifkan.
        </p>

        <div style={{ backgroundColor: "#fffbeb", border: "1px solid #fde68a", padding: "16px", borderRadius: "8px", textAlign: "left", marginBottom: "2rem" }}>
          <p style={{ color: "#92400e", fontSize: "0.9rem", margin: 0, lineHeight: 1.5 }}>
            <strong>Solusi:</strong><br />
            Silakan hubungi <strong>Super Admin</strong> atau <strong>Tim Akademik</strong> untuk mereset password akun Tim Anda secara manual.
          </p>
        </div>

        <div className={styles.backToLogin}>
          <a href="/login">Kembali ke halaman Login</a>
        </div>
      </div>
    </div>
  );
}
