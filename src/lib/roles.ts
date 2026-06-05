export const ADMIN_ROLE = "ADMIN" as const;
export const VOLUNTEER_ROLE = "RELAWAN" as const;
export const ACADEMIC_ROLE = "TIM_AKADEMIK" as const;

export const TIM_PEKAN_ROLES = [
  "TIM_PEKAN_1",
  "TIM_PEKAN_2",
  "TIM_PEKAN_3",
  "TIM_PEKAN_4",
] as const;

export const TEAM_ACCOUNT_ROLES = [
  VOLUNTEER_ROLE,
  ...TIM_PEKAN_ROLES,
  ACADEMIC_ROLE,
] as const;

export type TeamAccountRole = (typeof TEAM_ACCOUNT_ROLES)[number];

export const TEAM_ACCOUNT_ROLE_LABELS: Record<TeamAccountRole, string> = {
  RELAWAN: "Relawan",
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
  return TIM_PEKAN_ROLES.includes(normalized as (typeof TIM_PEKAN_ROLES)[number]);
}

export function isVolunteerPortalRole(role: unknown) {
  const normalized = normalizeRole(role);
  return normalized === VOLUNTEER_ROLE || isTimPekanRole(normalized);
}

export function canAccessAdminArea(role: unknown) {
  return isAdminRole(role) || isAcademicRole(role);
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
