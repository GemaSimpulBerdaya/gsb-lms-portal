"use client";

import { usePathname, useRouter } from "next/navigation";
import styles from "./adminSidebar.module.css";

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

type AdminSidebarProps = {
  collapsed?: boolean;
  mobileOpen?: boolean;
  isMobile?: boolean;
  onToggle?: () => void;
  onMobileClose?: () => void;
};

const ICON = {
  dashboard: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  ),
  reports: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  grades: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  volunteers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  students: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10L12 5 2 10l10 5 10-5z" />
      <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
    </svg>
  ),
  modules: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  semesters: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  reportConfig: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z" />
      <line x1="7" y1="5" x2="7.01" y2="5" />
      <line x1="7" y1="12" x2="7.01" y2="12" />
      <line x1="7" y1="19" x2="7.01" y2="19" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  chevronLeft: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  close: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <line x1="6" y1="6" x2="18" y2="18" />
      <line x1="6" y1="18" x2="18" y2="6" />
    </svg>
  ),
};

const navGroups: NavGroup[] = [
  {
    label: "Operasional",
    items: [
      { label: "Dashboard", path: "/admin/dashboard", icon: ICON.dashboard },
      { label: "Laporan Kegiatan", path: "/admin/reports", icon: ICON.reports },
      { label: "Rekap Nilai & Raport", path: "/admin/grades", icon: ICON.grades },
    ],
  },
  {
    label: "Data Master",
    items: [
      { label: "Relawan", path: "/admin/volunteers", icon: ICON.volunteers },
      { label: "Anak Didik", path: "/admin/students", icon: ICON.students },
      { label: "Modul", path: "/admin/modules", icon: ICON.modules },
    ],
  },
  {
    label: "Konfigurasi",
    items: [
      { label: "Semester & Wilayah", path: "/admin/semesters", icon: ICON.semesters },
      { label: "Konfigurasi Raport", path: "/admin/report-config", icon: ICON.reportConfig },
    ],
  },
];

export default function AdminSidebar({
  collapsed = false,
  mobileOpen = false,
  isMobile = false,
  onToggle,
  onMobileClose,
}: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = () => {
    localStorage.removeItem("user");
    router.replace("/");
  };

  // Match menu aktif: cocokkan ke segmen pertama supaya halaman lama
  // (mis. /admin/levels, /admin/categories) tetap nge-highlight grup yg tepat.
  const isActive = (path: string) => {
    if (!pathname) return false;
    if (pathname === path) return true;
    if (path === "/admin/semesters" && pathname.startsWith("/admin/levels")) return true;
    if (path === "/admin/modules" && pathname.startsWith("/admin/categories")) return true;
    return pathname.startsWith(path + "/");
  };

  const handleNav = (path: string) => {
    router.push(path);
    onMobileClose?.();
  };

  const sidebarClass = [
    styles.sidebar,
    styles.sidebarEnter,
    collapsed ? styles.sidebarCollapsed : "",
    isMobile ? styles.sidebarMobile : "",
    isMobile && mobileOpen ? styles.sidebarMobileOpen : "",
  ]
    .filter(Boolean)
    .join(" ");

  // Saat collapsed di desktop, label grup disembunyikan tapi grup tetap dipisah pakai gap.
  return (
    <aside className={sidebarClass} aria-label="Navigasi admin">
      <div>
        <div className={styles.brand}>
          <div className={styles.brandRow}>
            <div className={styles.logoCircle}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>

            {!collapsed && (
              <div className={styles.brandText}>
                <h2 className={styles.logo}>GSB LMS</h2>
                <p className={styles.subLogo}>Admin Portal</p>
              </div>
            )}

            {/* Tombol close khusus mobile drawer */}
            {isMobile && (
              <button
                type="button"
                className={styles.closeBtn}
                onClick={onMobileClose}
                aria-label="Tutup menu"
              >
                {ICON.close}
              </button>
            )}
          </div>

          {/* Tombol toggle collapse (desktop only) */}
          {!isMobile && onToggle && (
            <button
              type="button"
              className={`${styles.collapseBtn} ${collapsed ? styles.collapseBtnRotate : ""}`}
              onClick={onToggle}
              aria-label={collapsed ? "Buka sidebar" : "Tutup sidebar"}
              title={collapsed ? "Buka sidebar" : "Tutup sidebar"}
            >
              {ICON.chevronLeft}
            </button>
          )}
        </div>

        <nav className={styles.menu}>
          {navGroups.map((group) => (
            <div key={group.label} className={styles.menuGroup}>
              {!collapsed && <div className={styles.groupLabel}>{group.label}</div>}
              {collapsed && <div className={styles.groupDivider} aria-hidden />}
              {group.items.map((item) => (
                <button
                  key={item.path}
                  className={`${styles.menuItem} ${
                    isActive(item.path) ? styles.menuItemActive : ""
                  }`}
                  onClick={() => handleNav(item.path)}
                  title={collapsed ? item.label : undefined}
                  data-tooltip={collapsed ? item.label : undefined}
                >
                  <span className={styles.menuIcon}>{item.icon}</span>
                  <span className={styles.menuLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
      </div>

      <div className={styles.bottomMenu}>
        <button
          className={styles.menuItem}
          onClick={handleLogout}
          title={collapsed ? "Logout" : undefined}
          data-tooltip={collapsed ? "Logout" : undefined}
        >
          <span className={styles.menuIcon}>{ICON.logout}</span>
          <span className={styles.menuLabel}>Logout</span>
        </button>
      </div>
    </aside>
  );
}
