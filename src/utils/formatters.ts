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
