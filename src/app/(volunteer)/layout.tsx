"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/sidebar/Sidebar";
import styles from "./volunteerLayout.module.css";

const MOBILE_BREAKPOINT = 900;

export default function VolunteerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    });

    const checkViewport = () => {
      const nextIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(nextIsMobile);
      if (!nextIsMobile) setMobileOpen(false);
    };

    window.addEventListener("resize", checkViewport);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", checkViewport);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setMobileOpen(false);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pathname]);

  useEffect(() => {
    if (mobileOpen && isMobile) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen, isMobile]);

  const closeMobileDrawer = useCallback(() => setMobileOpen(false), []);

  return (
    <div className={`${styles.container} ${isMobile ? styles.containerMobile : ""}`}>
      <Sidebar
        mobileOpen={mobileOpen}
        isMobile={isMobile}
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
        {isMobile && (
          <div className={styles.mobileTopbar}>
            <button
              type="button"
              className={styles.mobileToggle}
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
            <span className={styles.mobileBrand}>GSB LMS - Relawan</span>
          </div>
        )}

        {children}
      </main>
    </div>
  );
}
