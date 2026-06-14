"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { isAcademicRole } from "@/lib/roles";
import styles from "./adminSidebar.module.css";

type NavItem = {
  label: string;
  path: string;
  icon: React.ReactNode;
  /**
   * Optional nested submenu. Kalau ada, item jadi parent expandable —
   * klik parent toggle expand (tidak navigate). Klik child navigate ke
   * `path`-nya. Contoh: "Nilai & Rapor" → ["Reguler", "SNBT"].
   */
  children?: NavItem[];
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
  // Chevron untuk indikator expand parent submenu. Pakai chevronDown sbg
  // default (collapsed); rotate via .submenuChevronOpen saat expanded.
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  // Bullet kecil untuk child submenu — tampilannya minimal supaya gak
  // berebut perhatian sama icon parent.
  dot: (
    <svg width="6" height="6" viewBox="0 0 8 8" fill="currentColor">
      <circle cx="4" cy="4" r="3" />
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
      { label: "Laporan Kegiatan", path: "/admin/reports", icon: ICON.reports },
      { label: "Kehadiran Relawan", path: "/admin/team-attendance", icon: ICON.attendance },
      // "Nilai & Rapor" jadi parent nested — child Reguler & SNBT pisah
      // pakai query param ?mode=snbt (bukan route baru, sesuai T4 spec).
      // `path` parent diisi root /admin/grades supaya kalau sidebar lagi
      // collapsed (icon-only), klik parent navigate langsung ke first child
      // — fallback minimal tanpa popover.
      {
        label: "Nilai & Rapor",
        path: "/admin/grades",
        icon: ICON.grades,
        children: [
          {
            label: "Reguler",
            path: "/admin/grades",
            icon: ICON.dot,
          },
          {
            label: "SNBT",
            path: "/admin/grades?mode=snbt",
            icon: ICON.dot,
          },
        ],
      },
    ],
  },
  {
    label: "Data Utama",
    items: [
      { label: "Akun Tim", path: "/admin/volunteers", icon: ICON.accounts },
      { label: "Daftar Relawan", path: "/admin/volunteer-registry", icon: ICON.volunteers },
      { label: "Siswa", path: "/admin/students", icon: ICON.students },
      { label: "Direktori Siswa", path: "/admin/student-directory", icon: ICON.students },
      { label: "Materi Ajar", path: "/admin/modules", icon: ICON.modules },
    ],
  },
  {
    label: "Konfigurasi",
    items: [
      { label: "Pembelajaran", path: "/admin/semesters", icon: ICON.semesters },
      { label: "Nilai & Rapor", path: "/admin/report-config", icon: ICON.reportConfig },
    ],
  },
];

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
  const searchParams = useSearchParams();
  const visibleNavGroups: NavGroup[] = isAcademicRole(role)
    ? [
        {
          label: "Akademik",
          items: [
            { label: "Dashboard", path: "/admin/academic-dashboard", icon: ICON.dashboard },
            { label: "Modul", path: "/admin/modules", icon: ICON.modules },
          ],
        },
      ]
    : navGroups;

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/");
    }
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

  // Match child item: cek pathname + querystring (mis. SNBT vs Reguler
  // pakai path yang sama tapi beda `?mode=snbt`). pathname-only matching
  // gak cukup karena kedua child punya pathname identik.
  const isChildActive = (childPath: string) => {
    if (!pathname) return false;
    const [rawPath, rawQuery] = childPath.split("?");
    if (pathname !== rawPath) return false;
    if (!rawQuery) {
      // Child reguler aktif kalau SEMUA query SNBT-marker absen.
      // (Kalau ada `?mode=snbt`, child SNBT yg menang.)
      return (searchParams?.get("mode") ?? null) === null;
    }
    // Child dgn query: cocokkan tiap key=value di pathname querystring.
    const expected = new URLSearchParams(rawQuery);
    for (const [k, v] of expected.entries()) {
      if (searchParams?.get(k) !== v) return false;
    }
    return true;
  };

  const handleNav = (path: string) => {
    router.push(path);
    onMobileClose?.();
  };

  // State untuk parent expand/collapse. Key by parent label (cukup unik
  // dalam scope sidebar). Default: kosong = semua tertutup, kecuali
  // parent yg salah satu childnya match path saat ini → auto-expand
  // pertama kali render.
  const initialExpanded = useMemo<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const g of visibleNavGroups) {
      for (const item of g.items) {
        if (item.children?.some((c) => isChildActive(c.path))) {
          map[item.label] = true;
        }
      }
    }
    return map;
    // Sengaja gak pakai isChildActive di deps — itu inline closure baru
    // tiap render. Pathname + searchParams sudah cukup sebagai trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams, visibleNavGroups]);

  const [expanded, setExpanded] =
    useState<Record<string, boolean>>(initialExpanded);

  // Auto-expand kalau navigasi (pathname atau query) berubah ke child
  // yang sebelumnya tertutup. Jangan auto-collapse manual user — hanya
  // merge true, biar UX-nya forgiving.
  useEffect(() => {
    setExpanded((prev) => ({ ...prev, ...initialExpanded }));
  }, [initialExpanded]);

  const toggleExpanded = (label: string) => {
    setExpanded((prev) => ({ ...prev, [label]: !prev[label] }));
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
          {visibleNavGroups.map((group) => (
            <div key={group.label} className={styles.menuGroup}>
              {!collapsed && <div className={styles.groupLabel}>{group.label}</div>}
              {collapsed && <div className={styles.groupDivider} aria-hidden />}
              {group.items.map((item) => {
                // Item tanpa children = leaf biasa (render persis seperti
                // sebelumnya, jangan diubah supaya konvensi sidebar lama
                // gak ke-disturb).
                if (!item.children || item.children.length === 0) {
                  return (
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
                  );
                }

                // Item dengan children = parent expandable.
                const isOpen = !!expanded[item.label];
                const hasActiveChild = item.children.some((c) =>
                  isChildActive(c.path)
                );

                // Saat collapsed (icon-only), parent klik langsung navigate
                // ke first child — popover butuh layout work yg out-of-scope
                // T4 dan dokumentasi skill bilang hindari nambah artefak UI
                // sidebar yang gak diminta.
                const handleParentClick = () => {
                  if (collapsed) {
                    handleNav(item.children![0].path);
                  } else {
                    toggleExpanded(item.label);
                  }
                };

                return (
                  <div key={`parent-${item.label}`}>
                    <button
                      type="button"
                      className={`${styles.menuItem} ${
                        hasActiveChild ? styles.parentExpanded : ""
                      }`}
                      onClick={handleParentClick}
                      aria-expanded={isOpen}
                      aria-controls={`submenu-${item.label}`}
                      title={collapsed ? item.label : undefined}
                      data-tooltip={collapsed ? item.label : undefined}
                    >
                      <span className={styles.menuIcon}>{item.icon}</span>
                      <span className={styles.menuLabel}>{item.label}</span>
                      {!collapsed && (
                        <span
                          className={`${styles.submenuChevron} ${
                            isOpen ? styles.submenuChevronOpen : ""
                          }`}
                          aria-hidden
                        >
                          {ICON.chevronDown}
                        </span>
                      )}
                    </button>
                    {/* Saat collapsed, sembunyikan submenu (icon-only mode);
                        parent klik sudah navigate ke first child di atas. */}
                    {!collapsed && isOpen && (
                      <div
                        id={`submenu-${item.label}`}
                        className={styles.submenu}
                        role="group"
                      >
                        {item.children.map((child) => (
                          <button
                            key={`${item.label}-${child.label}`}
                            type="button"
                            className={`${styles.submenuItem} ${
                              isChildActive(child.path)
                                ? styles.submenuItemActive
                                : ""
                            }`}
                            onClick={() => handleNav(child.path)}
                          >
                            <span className={styles.submenuDot}>
                              {child.icon}
                            </span>
                            <span className={styles.menuLabel}>
                              {child.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
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
