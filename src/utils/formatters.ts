/**
 * Centralized formatting utilities for GSB LMS
 */

const MONTHS_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];

/**
 * Kode semester kanonis: `YYYY-1` (Jan-Jun) atau `YYYY-2` (Jul-Des).
 * Konvensi internal GSB (Edukasi) — Jan-Jun = paruh pertama tahun = -1.
 */
export const getCurrentSemester = (): string => {
  const d = new Date();
  const half = d.getMonth() < 6 ? 1 : 2;
  return `${d.getFullYear()}-${half}`;
};

/**
 * Derive label default dari kode semester.
 * `2026-1` → "Januari - Juni 2026"
 * `2026-2` → "Juli - Desember 2026"
 */
export const deriveSemesterLabel = (sem: string): string => {
  if (!sem) return "-";
  const [yearStr, termStr] = sem.split("-");
  const year = parseInt(yearStr);
  const term = parseInt(termStr);
  if (!year || (term !== 1 && term !== 2)) return sem;

  if (term === 1) return `${MONTHS_ID[0]} - ${MONTHS_ID[5]} ${year}`;
  return `${MONTHS_ID[6]} - ${MONTHS_ID[11]} ${year}`;
};

/**
 * Format semester untuk display.
 * Priority:
 *  1. customLabels[sem] (admin override via Settings key `semesterLabels`)
 *  2. derived label (Januari - Juni YYYY / Juli - Desember YYYY)
 *  3. raw kode kalau format invalid
 *
 * Pakai dengan customLabels supaya admin bisa rename tanpa code change.
 */
export const formatSemester = (
  sem: string,
  customLabels?: Record<string, string>
): string => {
  if (!sem) return "-";
  const override = customLabels?.[sem];
  if (override && override.trim()) return override.trim();
  return deriveSemesterLabel(sem);
};

export const formatDateID = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const getDayNameID = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", { weekday: "long" });
};

/**
 * Konversi Date jadi `YYYY-MM-DD` string TZ-safe (WIB / Asia/Jakarta).
 *
 * Project ini dipake di Indonesia — semua display kalender harus pake WIB.
 * `toISOString().slice(0, 10)` salah karena ngasi UTC date, dan trick
 * heuristik UTC-vs-local juga bermasalah kalau kbmDate disimpan sebagai
 * local-midnight WIB (`T17:00:00Z` prev day). Pakai `Intl` dengan
 * `timeZone: "Asia/Jakarta"` supaya output stabil di browser TZ apapun.
 *
 * `en-CA` locale return `YYYY-MM-DD` format yang sama dengan ISO date.
 */
export const dateToIso = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};

/**
 * Format tanggal pertemuan untuk dropdown UI: "Minggu, 24 Mei 2026".
 * WIB-canonical supaya konsisten dengan input volunteer.
 */
export const formatKbmDate = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

/**
 * Format tanggal pertemuan ringkas: "24 Mei". WIB-canonical.
 */
export const formatKbmDateShort = (date: Date | string): string => {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "numeric",
    month: "short",
  });
};

/**
 * Cek apakah tanggal pertemuan berada di masa depan (> hari ini WIB).
 * Dipake buat block input presensi/nilai/dokumentasi untuk pekan yang belum dimulai.
 */
export const isFutureDate = (date: Date | string): boolean => {
  const target = dateToIso(date);
  const today = dateToIso(new Date());
  return target > today;
};
