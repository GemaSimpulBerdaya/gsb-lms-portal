export const ADMIN_ROLE = "ADMIN" as const;
export const VOLUNTEER_ROLE = "RELAWAN" as const;
export const LOCATION_TEAM_ROLE = "TIM_PEKAN" as const;
export const ACADEMIC_ROLE = "TIM_AKADEMIK" as const;

export const FIELD_TEAM_ROLES = [
  LOCATION_TEAM_ROLE,
] as const;

export const TEAM_ACCOUNT_ROLES = [
  ADMIN_ROLE,
  VOLUNTEER_ROLE,
  LOCATION_TEAM_ROLE,
  ACADEMIC_ROLE,
] as const;

export type TeamAccountRole = (typeof TEAM_ACCOUNT_ROLES)[number];

export const TEAM_ACCOUNT_ROLE_LABELS: Record<TeamAccountRole, string> = {
  ADMIN: "Admin",
  RELAWAN: "Relawan",
  TIM_PEKAN: "Tim Kelas",
  TIM_AKADEMIK: "Tim Akademik",
};

export function normalizeRole(role: unknown): string {
  return typeof role === "string" ? role.trim().toUpperCase() : "";
}

export function isAdminRole(role: unknown) {
  return normalizeRole(role) === ADMIN_ROLE;
}

export function isAcademicRole(role: unknown) {
  return normalizeRole(role) === ACADEMIC_ROLE;
}

export function isLocationTeamRole(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === LOCATION_TEAM_ROLE;
}

export function isFieldTeamRole(role: unknown) {
  // Tambah izin portal buat admin biar mereka tetep bisa akses menu /team-attendance dan dashboard lapangan.
  return isLocationTeamRole(role) || normalizeRole(role) === VOLUNTEER_ROLE || isAdminRole(role);
}

export function isVolunteerPortalRole(role: unknown) {
  return isFieldTeamRole(role);
}

export function canAccessAdminArea(role: unknown) {
  return isAdminRole(role) || isAcademicRole(role);
}

/**
 * Landing page default untuk akun Tim Akademik setelah login.
 */
export const ACADEMIC_LANDING = "/admin/academic-dashboard" as const;

/**
 * Prefix rute /admin yang boleh diakses akun Tim Akademik.
 * Single source of truth supaya gating di proxy, AdminGuard, dan sidebar
 * tidak drift. Tambah entri di sini kalau akademik dikasih halaman baru.
 */
export const ACADEMIC_ALLOWED_PREFIXES = [
  "/admin/academic-dashboard",
  "/admin/modules",
] as const;

/**
 * Cek apakah pathname /admin/* boleh diakses oleh akun Tim Akademik.
 * Cocokkan exact atau sebagai prefix segmen (`/admin/modules/123`).
 */
export function isAcademicAllowedPath(pathname: string): boolean {
  return ACADEMIC_ALLOWED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );
}

export function canManageModules(role: unknown) {
  return isAdminRole(role) || isAcademicRole(role);
}

export function canAccessVolunteerPortal(role: unknown) {
  return isVolunteerPortalRole(role);
}

export function isTeamAccountRole(role: unknown): role is TeamAccountRole {
  const normalized = normalizeRole(role);
  return TEAM_ACCOUNT_ROLES.includes(normalized as TeamAccountRole);
}

export function getTeamAccountRoleLabel(role: unknown) {
  const normalized = normalizeRole(role);
  return isTeamAccountRole(normalized)
    ? TEAM_ACCOUNT_ROLE_LABELS[normalized]
    : normalized || "-";
}
