"use client";

import { useEffect, useState, useCallback } from "react";
import { usePathname } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar/AdminSidebar";
import styles from "./adminLayout.module.css";

const STORAGE_KEY = "gsb_admin_sidebar_collapsed";
const MOBILE_BREAKPOINT = 900;

/**
 * Client-side wrapper untuk shell admin.
 * Mengelola state collapse sidebar (desktop icon-rail) + drawer mobile,
 * persist preferensi user di localStorage, dan auto-close drawer saat
 * pindah halaman atau resize ke desktop.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();

  // Restore preferensi collapsed sekali di mount + cek viewport.
  useEffect(() => {
    if (typeof window === "undefined") return;
    queueMicrotask(() => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === "1") setCollapsed(true);
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    });

    const checkViewport = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    window.addEventListener("resize", checkViewport);
    return () => window.removeEventListener("resize", checkViewport);
  }, []);

  // Tutup drawer mobile saat user navigasi ke halaman lain.
  useEffect(() => {
    queueMicrotask(() => setMobileOpen(false));
  }, [pathname]);

  // Lock scroll body saat drawer terbuka di mobile.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (mobileOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, isMobile]);

  const toggleCollapsed = useCallback(() => {
    if (isMobile) {
      setMobileOpen((prev) => !prev);
      return;
    }
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      } catch {
        /* storage tidak tersedia */
      }
      return next;
    });
  }, [isMobile]);

  const closeMobileDrawer = useCallback(() => setMobileOpen(false), []);

  const containerClass = [
    styles.container,
    collapsed && !isMobile ? styles.containerCollapsed : "",
    isMobile ? styles.containerMobile : "",
    mobileOpen ? styles.drawerOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      <AdminSidebar
        collapsed={collapsed && !isMobile}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
        onToggle={toggleCollapsed}
        onMobileClose={closeMobileDrawer}
      />

      {isMobile && mobileOpen && (
        <div
          className={styles.backdrop}
          onClick={closeMobileDrawer}
          aria-hidden
        />
      )}

      <main className={styles.mainContent}>
        {/* Header bar mobile: tombol hamburger + brand */}
        {isMobile && (
          <div className={styles.mobileTopbar}>
            <button
              className={styles.mobileToggle}
              onClick={toggleCollapsed}
              aria-label="Buka menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className={styles.mobileBrand}>GSB LMS · Admin</span>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
