import React from "react";
import styles from "../auth.module.css";
import Image from "next/image";

export default function ResetPasswordPage() {
  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.logoWrapper}>
          <Image src="/images/logo_hitam.png" alt="GSB Logo" width={80} height={80} />
        </div>
        <h1 className={styles.title}>Reset Password</h1>
        <p className={styles.subtitle} style={{ marginBottom: "2rem" }}>
          Fitur reset password via link telah dinonaktifkan.
        </p>

        <div className={styles.backToLogin}>
          <a href="/login">Kembali ke halaman Login</a>
        </div>
      </div>
    </div>
  );
}
