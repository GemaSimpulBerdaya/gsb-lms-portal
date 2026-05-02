/**
 * Centralized formatting utilities for GSB LMS
 */

export const getCurrentSemester = (): string => {
  const d = new Date();
  // Standard logic: Jan-Jun = Sem 1, Jul-Dec = Sem 2 (adjust as needed)
  return `${d.getFullYear()}-1`;
};

export const formatSemester = (sem: string): string => {
  if (!sem) return "-";
  const [year, term] = sem.split("-");
  return `Semester ${term} Tahun Ajaran ${year}/${parseInt(year) + 1}`;
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
