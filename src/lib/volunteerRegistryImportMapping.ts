import { deriveFase } from "@/lib/studentImportMapping";

export type VolunteerRegistryImportRow = Record<string, unknown>;

export type MappedVolunteerRegistry = {
  name: string;
  assignmentRegion: string;
  assignmentRoles: string[];
  assignmentFase: string;
  assignmentWeek: string;
};

export const VOLUNTEER_REGISTRY_HEADERS = [
  "No.",
  "Nama Relawan",
  "Lokasi",
  "Peran",
  "Fase",
  "Pekan",
] as const;

export const VOLUNTEER_LOCATION_SHEETS = [
  { sheetName: "Untuk LMS - Offline Depok", region: "Offline Depok" },
  { sheetName: "Untuk LMS - Offline Sasakpanjan", region: "Offline Sasak Panjang" },
  { sheetName: "Untuk LMS - Online Reguler", region: "Online Reguler" },
] as const;

export const VOLUNTEER_ASSIGNMENT_ROLES = [
  "Koordinator",
  "Pengajar",
  "Fasilitator",
  "Dokumentasi",
] as const;

/** Role operasional di TeamAccount.members[].role (single). */
export type MappedTeamMemberRole =
  | "FASILITATOR"
  | "PENGAJAR"
  | "DOKUMENTASI"
  | "AKADEMIK";

/**
 * Map label Peran di Daftar Relawan (Excel/UI) → role anggota tim.
 * Multi-peran: pilih 1 dengan prioritas Fasilitator/Koordinator > Pengajar > Dokumentasi.
 * "Koordinator" dipetakan ke FASILITATOR (slot tim tidak punya KOORDINATOR).
 */
export function mapAssignmentRolesToTeamMemberRole(
  roles: unknown,
  opts?: { academicTeam?: boolean },
): MappedTeamMemberRole {
  if (opts?.academicTeam) return "AKADEMIK";

  const list = Array.isArray(roles)
    ? roles.map((r) => String(r ?? "").trim())
    : parseVolunteerRoles(roles);

  const normalized = list.map((r) => r.toLowerCase());
  if (
    normalized.some(
      (r) =>
        r.includes("fasilitator") ||
        r.includes("facilitator") ||
        r.includes("koordinator") ||
        r.includes("coordinator"),
    )
  ) {
    return "FASILITATOR";
  }
  if (normalized.some((r) => r.includes("pengajar") || r.includes("guru"))) {
    return "PENGAJAR";
  }
  if (normalized.some((r) => r.includes("dokumentasi") || r.includes("dokumenter"))) {
    return "DOKUMENTASI";
  }
  if (normalized.some((r) => r.includes("akademik"))) {
    return "AKADEMIK";
  }
  return "PENGAJAR";
}

const normalizeHeader = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

const pick = (row: VolunteerRegistryImportRow, header: string) => {
  const target = normalizeHeader(header);
  const entry = Object.entries(row).find(([key]) => normalizeHeader(key) === target);
  return entry && entry[1] !== null && entry[1] !== undefined
    ? String(entry[1]).trim()
    : "";
};

export function parseVolunteerRoles(value: unknown): string[] {
  return [...new Set(
    String(value ?? "")
      .split(/\s*(?:,|;|\n|&|\/)\s*/)
      .map((role) => role.trim())
      .filter(Boolean),
  )];
}

export function normalizeVolunteerFase(value: unknown): string {
  const fase = String(value ?? "").trim();
  return /^all$/i.test(fase) ? "ALL" : deriveFase(fase);
}

export function regionFromVolunteerSheet(sheetName: string): string {
  return VOLUNTEER_LOCATION_SHEETS.find(
    (item) => normalizeHeader(item.sheetName) === normalizeHeader(sheetName),
  )?.region ?? sheetName.replace(/^Untuk LMS\s*-\s*/i, "").trim();
}

export function sheetFromVolunteerRegion(region: string): string {
  return VOLUNTEER_LOCATION_SHEETS.find(
    (item) => normalizeHeader(item.region) === normalizeHeader(region),
  )?.sheetName ?? `Untuk LMS - ${region || "Belum Ditentukan"}`.slice(0, 31);
}

export function mapVolunteerRegistryRow(
  row: VolunteerRegistryImportRow,
  sheetName: string,
): MappedVolunteerRegistry {
  return {
    name: pick(row, "Nama Relawan"),
    assignmentRegion: pick(row, "Lokasi") || regionFromVolunteerSheet(sheetName),
    assignmentRoles: parseVolunteerRoles(pick(row, "Peran")),
    assignmentFase: normalizeVolunteerFase(pick(row, "Fase")),
    assignmentWeek: pick(row, "Pekan"),
  };
}

export function volunteerToLocationRow(
  volunteer: Partial<MappedVolunteerRegistry>,
  index: number,
): Record<(typeof VOLUNTEER_REGISTRY_HEADERS)[number], string> {
  return {
    "No.": String(index + 1),
    "Nama Relawan": volunteer.name ?? "",
    Lokasi: volunteer.assignmentRegion ?? "",
    Peran: volunteer.assignmentRoles?.join(" & ") ?? "",
    Fase: volunteer.assignmentFase ?? "",
    Pekan: volunteer.assignmentWeek ?? "",
  };
}

export const VOLUNTEER_REGISTRY_SAMPLE_ROW = volunteerToLocationRow(
  {
    name: "Contoh Relawan",
    assignmentRegion: "Offline Depok",
    assignmentRoles: ["Pengajar", "Dokumentasi"],
    assignmentFase: "FASE A",
    assignmentWeek: "1",
  },
  0,
);
