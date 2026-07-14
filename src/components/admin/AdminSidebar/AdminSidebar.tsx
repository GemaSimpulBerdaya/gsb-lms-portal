"use client";

import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { isAcademicRole } from "@/lib/roles";
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
  role?: string | null;
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
  attendance: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
      <circle cx="9" cy="7" r="4"></circle>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
    </svg>
  ),
  volunteers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  students: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
      <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
    </svg>
  ),
  modules: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  ),
  schedules: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
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
  settings: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  logout: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  close: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  accounts: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  chevronLeft: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
};

const navGroups: NavGroup[] = [
  {
    label: "Utama",
    items: [{ label: "Dashboard", path: "/admin/dashboard", icon: ICON.dashboard }],
  },
  {
    label: "Aktivitas",
    items: [
      { label: "Jadwal Relawan", path: "/admin/schedules", icon: ICON.schedules },
      { label: "Laporan KBM", path: "/admin/reports", icon: ICON.reports },
      { label: "Presensi Siswa", path: "/admin/student-attendance", icon: ICON.attendance },
      { label: "Presensi Relawan", path: "/admin/team-attendance", icon: ICON.attendance },
      { label: "Rekap Nilai", path: "/admin/grades", icon: ICON.grades },
    ],
  },
  {
    label: "Data Utama",
    items: [
      { label: "Akun Tim", path: "/admin/volunteers", icon: ICON.accounts },
      { label: "Daftar Relawan", path: "/admin/volunteer-registry", icon: ICON.volunteers },
      { label: "Rapor Siswa", path: "/admin/student-raports", icon: ICON.grades },
      { label: "Direktori Siswa", path: "/admin/student-directory", icon: ICON.students },
      { label: "Modul", path: "/admin/modules", icon: ICON.modules },
      { label: "Mata Pelajaran", path: "/admin/subjects", icon: ICON.modules },
    ],
  },
  {
    label: "Konfigurasi",
    items: [
      { label: "Pembelajaran", path: "/admin/semesters", icon: ICON.semesters },
      { label: "Rapor", path: "/admin/report-config", icon: ICON.reportConfig },
    ],
  },
];

function isNavPathActive(path: string, pathname: string | null) {
  if (!pathname) return false;
  if (pathname === path) return true;
  if (path === "/admin/semesters" && pathname.startsWith("/admin/levels")) return true;
  if (path === "/admin/modules" && pathname.startsWith("/admin/categories")) return true;
  return pathname.startsWith(path + "/");
}

export default function AdminSidebar({
  role,
  collapsed = false,
  mobileOpen = false,
  isMobile = false,
  onToggle,
  onMobileClose,
}: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
  const visibleNavGroups: NavGroup[] = useMemo(
    () =>
      isAcademicRole(role)
        ? [
            {
              label: "Akademik",
              items: [
                { label: "Dashboard", path: "/admin/academic-dashboard", icon: ICON.dashboard },
                { label: "Modul", path: "/admin/modules", icon: ICON.modules },
                { label: "Mata Pelajaran", path: "/admin/subjects", icon: ICON.modules },
              ],
            },
          ]
        : navGroups,
    [role],
  );

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
    }
  };

  // Match menu aktif: cocokkan ke segmen pertama supaya halaman lama
  // (mis. /admin/levels, /admin/categories) tetap nge-highlight grup yg tepat.
  const isActive = (path: string) => isNavPathActive(path, pathname);

  useEffect(() => {
    const activeGroup = visibleNavGroups.find((group) =>
      group.items.some((item) => isNavPathActive(item.path, pathname)),
    );
    if (!activeGroup) return;
    setClosedGroups((prev) => {
      if (!prev[activeGroup.label]) return prev;
      return { ...prev, [activeGroup.label]: false };
    });
  }, [pathname, visibleNavGroups]);

  const toggleGroup = (label: string, currentlyClosed: boolean) => {
    // `closedGroups[label]` masih undefined sebelum grup pernah diklik.
    // Membalik undefined (`!prev[label]`) selalu menghasilkan true, sehingga
    // grup yang default-nya tertutup butuh dua klik untuk terbuka. Balik state
    // efektif yang sudah memperhitungkan `defaultOpen`/route aktif.
    setClosedGroups((prev) => ({
      ...prev,
      [label]: !currentlyClosed,
    }));
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
              <Image
                src="/logo-gsb.png"
                alt="Logo GSB"
                width={34}
                height={42}
                className={styles.logoImage}
                priority
              />
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
          {visibleNavGroups.map((group) => {
            const groupActive = group.items.some((item) => isActive(item.path));
            const defaultOpen = group.label === "Utama" || groupActive;
            const groupClosed =
              !collapsed && (closedGroups[group.label] ?? !defaultOpen);

            return (
              <div key={group.label} className={styles.menuGroup}>
                {!collapsed && (
                  <button
                    type="button"
                    className={styles.groupHeader}
                    onClick={() => toggleGroup(group.label, groupClosed)}
                    aria-expanded={!groupClosed}
                  >
                    <span className={styles.groupLabel}>{group.label}</span>
                    <span
                      className={`${styles.groupChevron} ${
                        groupClosed ? "" : styles.groupChevronOpen
                      }`}
                      aria-hidden
                    >
                      {ICON.chevronLeft}
                    </span>
                  </button>
                )}
                {collapsed && <div className={styles.groupDivider} aria-hidden />}
                {!groupClosed &&
                  group.items.map((item) => (
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
            );
          })}
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
