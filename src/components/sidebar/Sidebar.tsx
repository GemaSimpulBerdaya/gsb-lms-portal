"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./Sidebar.module.css";
import { useEffect, useState } from "react";
import { useMounted } from "@/hooks/useMounted";

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
    label: "Jadwal & Modul",
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
  {
    label: "Data Siswa",
    path: "/students-data",
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
    label: "Presensi Siswa",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M9 15L11 17L15 13" />
      </svg>
    ),
    subItems: [
      { label: "Input Presensi", path: "/attendance" },
      { label: "Riwayat Presensi", path: "/attendance/recap" }
    ]
  },
  {
    label: "Presensi Tim",
    path: "/team-attendance",
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
    label: "Input Nilai",
    path: "/evaluation",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
  {
    label: "Dokumentasi KBM",
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
    label: "Karya Siswa",
    path: "/portfolio",
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
];

type SidebarProps = {
  mobileOpen?: boolean;
  isMobile?: boolean;
  onMobileClose?: () => void;
};

export default function Sidebar({
  mobileOpen = false,
  isMobile = false,
  onMobileClose,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const mounted = useMounted();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const stored = window.localStorage.getItem("gsb_volunteer_sidebar_collapsed");
      if (stored === "1") setIsCollapsed(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    // Auto-open menu if child is active
    navItems.forEach(item => {
      if (item.subItems) {
        if (item.subItems.some(sub => pathname?.startsWith(sub.path))) {
          setOpenMenus(prev => ({ ...prev, [item.label]: true }));
        }
      }
    });
  }, [pathname]);

  const toggleMenu = (label: string) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      window.localStorage.setItem("gsb_volunteer_sidebar_collapsed", "0");
    }
    setOpenMenus(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleCollapsed = () => {
    if (isMobile) return;
    setIsCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem("gsb_volunteer_sidebar_collapsed", next ? "1" : "0");
      return next;
    });
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
    } catch (e) {
      console.error(e);
    }
  };

  const handleNav = (path: string) => {
    router.push(path);
    onMobileClose?.();
  };

  const sidebarClass = [
    styles.sidebar,
    isCollapsed && !isMobile ? styles.sidebarCollapsed : "",
    isMobile ? styles.sidebarMobile : "",
    isMobile && mobileOpen ? styles.sidebarMobileOpen : "",
    mounted ? styles.sidebarEnter : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClass}>
      <div>
        <div className={styles.brand}>
          <div className={styles.brandTop}>
            <div className={styles.logoCircle}>
              <Image
                src="/logo-gsb.png"
                alt="Logo GSB"
                width={36}
                height={44}
                className={styles.logoImage}
                priority
              />
            </div>
            <button
              type="button"
              className={styles.collapseButton}
              onClick={toggleCollapsed}
              aria-label={isCollapsed ? "Buka sidebar" : "Tutup sidebar"}
              title={isCollapsed ? "Buka sidebar" : "Tutup sidebar"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isCollapsed ? (
                  <polyline points="9 18 15 12 9 6" />
                ) : (
                  <polyline points="15 18 9 12 15 6" />
                )}
              </svg>
            </button>
            {isMobile && (
              <button
                type="button"
                className={styles.closeButton}
                onClick={onMobileClose}
                aria-label="Tutup menu"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="6" y1="18" x2="18" y2="6" />
                </svg>
              </button>
            )}
          </div>
          <div className={styles.brandText}>
            <h2 className={styles.logo}>GSB LMS</h2>
            <p className={styles.subLogo}>Volunteer Portal</p>
          </div>
        </div>

        <nav className={styles.menu}>
          {navItems.map((item) => {
            const isActive = !item.subItems && pathname?.startsWith(item.path as string);
            const isOpen = openMenus[item.label];

            return (
              <div key={item.label} className={styles.menuContainer}>
                <button
                  className={`${styles.menuItem} ${isActive ? styles.menuItemActive : ""}`}
                  onClick={() => {
                    if (item.subItems) {
                      toggleMenu(item.label);
                    } else if (item.path) {
                      handleNav(item.path);
                    }
                  }}
                  title={item.label}
                >
                  <span className={styles.menuIcon}>{item.icon}</span>
                  <span className={styles.menuLabel}>{item.label}</span>
                  {item.subItems && (
                    <span className={`${styles.menuChevron} ${isOpen ? styles.chevronOpen : ""}`}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </span>
                  )}
                </button>
                
                {item.subItems && isOpen && !isCollapsed && (
                  <div className={styles.subMenu}>
                    {item.subItems.map(sub => {
                      // Exact match for input absensi to avoid highlighting both
                      const isSubActive = sub.path === "/attendance" 
                        ? pathname === "/attendance" 
                        : pathname?.startsWith(sub.path);
                      
                      return (
                        <button
                          key={sub.path}
                          className={`${styles.subMenuItem} ${isSubActive ? styles.subMenuItemActive : ""}`}
                          onClick={() => handleNav(sub.path)}
                        >
                          {sub.label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className={styles.bottomMenu}>
        <button className={styles.menuItem} title="Settings">
          <span className={styles.menuIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </span>
          <span className={styles.menuLabel}>Settings</span>
        </button>
        <button className={styles.menuItem} onClick={handleLogout} title="Logout">
          <span className={styles.menuIcon}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </span>
          <span className={styles.menuLabel}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
