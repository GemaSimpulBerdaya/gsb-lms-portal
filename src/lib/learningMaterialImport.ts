export type LearningMaterialImportRow = Record<string, unknown> & { __rowNum__?: number };

export const MODULE_IMPORT_HEADERS = [
  "Judul Modul",
  "Slug",
  "Deskripsi",
  "Fase",
  "Mata Pelajaran",
  "Bulan",
  "Semester",
  "Link Google Drive",
  "Urutan",
];

export const MATERI_AJAR_IMPORT_HEADERS = [
  "Judul Materi",
  "Deskripsi",
  "Fase",
  "Mata Pelajaran",
  "Bulan",
  "Semester",
  "Link Google Drive",
];

const MONTHS: Record<string, number> = {
  januari: 1,
  january: 1,
  jan: 1,
  februari: 2,
  february: 2,
  feb: 2,
  maret: 3,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  mei: 5,
  may: 5,
  juni: 6,
  june: 6,
  jun: 6,
  juli: 7,
  july: 7,
  jul: 7,
  agustus: 8,
  august: 8,
  agu: 8,
  aug: 8,
  september: 9,
  sep: 9,
  oktober: 10,
  october: 10,
  okt: 10,
  oct: 10,
  november: 11,
  nov: 11,
  desember: 12,
  december: 12,
  des: 12,
  dec: 12,
};

function normalizeHeader(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("id-ID");
}

function pick(row: LearningMaterialImportRow, aliases: string[]): unknown {
  const normalized = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]),
  );
  for (const alias of aliases) {
    const value = normalized.get(normalizeHeader(alias));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

function text(value: unknown): string {
  return value === undefined || value === null ? "" : String(value).trim();
}

export function canonicalConfiguredValue(
  value: unknown,
  configuredValues: readonly string[],
): string | null {
  const normalized = text(value).toLocaleLowerCase("id-ID");
  return configuredValues.find(
    (item) => item.trim().toLocaleLowerCase("id-ID") === normalized,
  ) ?? null;
}

function numberOrOriginal(value: unknown, fallback: number): number | string {
  if (value === undefined || value === null || text(value) === "") return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : text(value);
}

export function parseImportMonth(value: unknown): number | string {
  const raw = text(value);
  if (!raw) return "";
  const number = Number(raw);
  if (Number.isFinite(number)) return number;
  return MONTHS[raw.toLocaleLowerCase("id-ID")] ?? raw;
}

export function slugifyImportTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/ı/g, "i")
    .toLocaleLowerCase("id-ID")
    .trim()
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "");
}

export function mapModuleImportRow(row: LearningMaterialImportRow) {
  const title = text(pick(row, ["Judul Modul", "Judul", "Title"]));
  return {
    title,
    slug: text(pick(row, ["Slug"])) || slugifyImportTitle(title),
    description: text(pick(row, ["Deskripsi", "Description"])),
    fase: text(pick(row, ["Fase", "Phase"])),
    subject: text(pick(row, ["Mata Pelajaran", "Mapel", "Subject"])),
    month: parseImportMonth(pick(row, ["Bulan", "Month"])),
    semester: text(pick(row, ["Semester"])),
    fileUrl: text(
      pick(row, ["Link Google Drive", "Link Modul", "File URL", "fileUrl", "Link"]),
    ),
    order: numberOrOriginal(pick(row, ["Urutan", "Order"]), 0),
  };
}

export function mapMateriAjarImportRow(row: LearningMaterialImportRow) {
  return {
    title: text(pick(row, ["Judul Materi", "Judul", "Title"])),
    description: text(pick(row, ["Deskripsi", "Description"])),
    fase: text(pick(row, ["Fase", "Phase"])),
    subject: text(pick(row, ["Mata Pelajaran", "Mapel", "Subject"])),
    month: parseImportMonth(pick(row, ["Bulan", "Month"])),
    semester: text(pick(row, ["Semester"])),
    fileUrl: text(
      pick(row, ["Link Google Drive", "Link Materi", "File URL", "fileUrl", "Link"]),
    ),
  };
}
