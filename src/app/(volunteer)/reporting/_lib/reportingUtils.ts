export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

export const formatShortDate = (iso: string) =>
  new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

export const excerpt = (text: string, words = 18) =>
  text.split(" ").slice(0, words).join(" ") +
  (text.split(" ").length > words ? "..." : "");

export const MONTH_FILTERS = [
  { value: "", label: "Semua Bulan" },
  { value: "01", label: "Januari" },
  { value: "02", label: "Februari" },
  { value: "03", label: "Maret" },
  { value: "04", label: "April" },
  { value: "05", label: "Mei" },
  { value: "06", label: "Juni" },
  { value: "07", label: "Juli" },
  { value: "08", label: "Agustus" },
  { value: "09", label: "September" },
  { value: "10", label: "Oktober" },
  { value: "11", label: "November" },
  { value: "12", label: "Desember" },
];

/**
 * Normalisasi foto dari report lama (`photoUrl`) dan report baru (`photoUrls`).
 * Return de-duped list; `photoUrl` legacy diprioritaskan sebagai foto utama.
 */
export const getReportPhotos = (report: { photoUrl?: string; photoUrls?: string[] }): string[] => {
  const list = Array.isArray(report.photoUrls) ? report.photoUrls.filter(Boolean) : [];
  if (report.photoUrl && !list.includes(report.photoUrl)) {
    list.unshift(report.photoUrl);
  }
  return list;
};
