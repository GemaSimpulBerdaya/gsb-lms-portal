/**
 * Escape string supaya aman dipakai sebagai literal di dalam RegExp dinamis.
 *
 * WAJIB dipakai setiap kali membangun `new RegExp()` dari data (region, fase,
 * nama, dst). Tanpa ini, nilai seperti "FASE E (SNBT)" pecah diam-diam:
 * `(SNBT)` dibaca sebagai capture group sehingga pattern `^FASE E (SNBT)$`
 * cocoknya dengan "FASE E SNBT" (tanpa kurung) — query siswa SNBT jadi
 * selalu kosong. (Bug nyata di halaman presensi, Juli 2026.)
 */
export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
