export type VolunteerRegistryImportRow = Record<string, unknown>;

export type MappedVolunteerRegistry = {
  name: string;
  region: string;
  role: string;
  fase: string;
  week: string;
};

export const VOLUNTEER_REGISTRY_HEADERS = [
  "No.",
  "Nama Relawan",
  "Peran",
  "Fase",
  "Pekan",
] as const;

export const VOLUNTEER_LOCATION_SHEETS = [
  { sheetName: "Untuk LMS - Offline Depok", region: "Offline Depok" },
  { sheetName: "Untuk LMS - Offline Sasakpanjan", region: "Offline Sasak Panjang" },
  { sheetName: "Untuk LMS - Online Reguler", region: "Online Reguler" },
] as const;

const normalizeHeader = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

const pick = (row: VolunteerRegistryImportRow, header: string) => {
  const target = normalizeHeader(header);
  const entry = Object.entries(row).find(([key]) => normalizeHeader(key) === target);
  return entry && entry[1] !== null && entry[1] !== undefined
    ? String(entry[1]).trim()
    : "";
};

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
    region: regionFromVolunteerSheet(sheetName),
    role: pick(row, "Peran"),
    fase: pick(row, "Fase"),
    week: pick(row, "Pekan"),
  };
}

export function volunteerToLocationRow(
  volunteer: Partial<MappedVolunteerRegistry>,
  index: number,
): Record<(typeof VOLUNTEER_REGISTRY_HEADERS)[number], string> {
  return {
    "No.": String(index + 1),
    "Nama Relawan": volunteer.name ?? "",
    Peran: volunteer.role ?? "",
    Fase: volunteer.fase ?? "",
    Pekan: volunteer.week ?? "",
  };
}

export const VOLUNTEER_REGISTRY_SAMPLE_ROW = volunteerToLocationRow(
  {
    name: "Contoh Relawan",
    role: "Pengajar",
    fase: "A",
    week: "1",
  },
  0,
);
