export const ADMIN_ROLE = "ADMIN" as const;
export const VOLUNTEER_ROLE = "RELAWAN" as const;
export const LOCATION_TEAM_ROLE = "TIM_PEKAN" as const;
export const LEGACY_LOCATION_TEAM_ROLE = "TIM_LOKASI" as const;
export const ACADEMIC_ROLE = "TIM_AKADEMIK" as const;

export const LEGACY_TIM_PEKAN_ROLES = [
  "TIM_PEKAN_1",
  "TIM_PEKAN_2",
  "TIM_PEKAN_3",
  "TIM_PEKAN_4",
] as const;
export const TIM_PEKAN_ROLES = LEGACY_TIM_PEKAN_ROLES;
export const FIELD_TEAM_ROLES = [
  LOCATION_TEAM_ROLE,
  LEGACY_LOCATION_TEAM_ROLE,
  ...LEGACY_TIM_PEKAN_ROLES,
] as const;

export const TEAM_ACCOUNT_ROLES = [
  VOLUNTEER_ROLE,
  LOCATION_TEAM_ROLE,
  LEGACY_LOCATION_TEAM_ROLE,
  ...LEGACY_TIM_PEKAN_ROLES,
  ACADEMIC_ROLE,
] as const;

export type TeamAccountRole = (typeof TEAM_ACCOUNT_ROLES)[number];

export const TEAM_ACCOUNT_ROLE_LABELS: Record<TeamAccountRole, string> = {
  RELAWAN: "Relawan",
  TIM_PEKAN: "Tim Pekan",
  TIM_LOKASI: "Tim Pekan",
  TIM_PEKAN_1: "Tim Pekan 1",
  TIM_PEKAN_2: "Tim Pekan 2",
  TIM_PEKAN_3: "Tim Pekan 3",
  TIM_PEKAN_4: "Tim Pekan 4",
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

export function isTimPekanRole(role: unknown) {
  const normalized = normalizeRole(role);
  return LEGACY_TIM_PEKAN_ROLES.includes(normalized as (typeof LEGACY_TIM_PEKAN_ROLES)[number]);
}

export function isLocationTeamRole(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === LOCATION_TEAM_ROLE || normalized === LEGACY_LOCATION_TEAM_ROLE;
}

export function isFieldTeamRole(role: unknown) {
  return isLocationTeamRole(role) || isTimPekanRole(role) || normalizeRole(role) === VOLUNTEER_ROLE;
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
