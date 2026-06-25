"use client";

import { useEffect, useState } from "react";
import styles from "../auth.module.css";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getErrorMessage } from "@/lib/errors";
import { isAcademicRole, isAdminRole, ACADEMIC_LANDING } from "@/lib/roles";

const REMEMBERED_EMAIL_KEY = "gsb_lms_remembered_email";
const EMAIL_INPUT_ID = "gsb-login-email";
const PASSWORD_INPUT_ID = "gsb-login-password";

export default function LoginPage() {
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      setEmail(rememberedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Email dan password wajib diisi!");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Login gagal. Silakan coba lagi.");
        return;
      }

      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }

      const role = data.user?.role;
      if (isAdminRole(role)) {
        router.push("/admin/dashboard");
      } else if (isAcademicRole(role)) {
        router.push(ACADEMIC_LANDING);
      } else {
        router.push("/dashboard");
      }
    } catch (err: unknown) {
      setError(getErrorMessage(err) || "Tidak dapat terhubung ke server. Periksa koneksi Anda.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginRoot}>

      {/* Brand */}
      <div className={styles.brandLogo}>Gema Simpul Berdaya</div>

      {/* Card */}
      <div className={styles.card}>
       <div className={styles.logoCircle} style={{ background: "transparent", width: "auto", height: "auto" }}>
         <Image src="/logo-gsb.png" alt="GSB Logo" width={60} height={60} style={{ objectFit: "contain" }} priority />
       </div>

<h1 className={styles.cardTitle}>GSB LMS</h1>
<p className={styles.cardSubtitle}>Volunteer Portal</p>



        <form onSubmit={handleSubmit} style={{ width: "100%" }} autoComplete="on">
        {/* Email Field */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={EMAIL_INPUT_ID}>Email Address</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
              </svg>
            </span>
            <input
              id={EMAIL_INPUT_ID}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              className={styles.inputField}
              placeholder="hello@mindfulgallery.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        {/* Password Field */}
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel} htmlFor={PASSWORD_INPUT_ID}>Password</label>
          <div className={styles.inputWrapper}>
            <span className={styles.inputIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </span>
            <input
              id={PASSWORD_INPUT_ID}
              type={showPassword ? "text" : "password"}
              name="password"
              autoComplete="current-password"
              className={styles.inputField}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              className={styles.eyeToggle}
              onClick={() => setShowPassword(!showPassword)}
              type="button"
              aria-label="Toggle password visibility"
            >
              {showPassword ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Options Row */}
        <div className={styles.optionsRow}>
          <label
            className={styles.rememberLabel}
            onClick={() => setRememberMe(!rememberMe)}
          >
            <div className={`${styles.customCheckbox} ${rememberMe ? styles.checked : ""}`}>
              {rememberMe && (
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            Ingat Saya
          </label>
        </div>

        {/* Error Message */}
        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: "8px", textAlign: "center" }}>
            {error}
          </p>
        )}

        {/* Sign In Button */}
        <button 
          className={styles.signInBtn} 
          type="submit"
          disabled={loading}
          style={loading ? { opacity: 0.7, cursor: "not-allowed" } : {}}
        >
          {loading ? "Signing in..." : "Sign In"}
          {!loading && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          )}
        </button>
        </form>

        {/* Apply Row */}
        {/* Removed based on request */}
      </div>

    </div>
  );
}
