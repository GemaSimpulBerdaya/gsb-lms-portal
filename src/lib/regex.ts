/**
 * Escape string supaya aman dipakai sebagai literal di dalam RegExp dinamis.
 *
 * WAJIB dipakai setiap kali membangun `new RegExp()` dari data (region, fase,
 * nama, dst). Escape input sebelum membentuk regex agar karakter khusus
 * tidak mengubah makna pattern.
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
