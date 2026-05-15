import { redirect } from "next/navigation";

/**
 * Redirect halaman lama → lokasi baru di tab "Wilayah & Fase".
 * Path /admin/levels sebelumnya berisi CRUD wilayah + readonly fase. Sekarang
 * digabung ke /admin/semesters?tab=wilayah supaya admin punya satu pintu masuk
 * untuk semua hal data master kalender + wilayah.
 */
export default function LevelsRedirectPage() {
  redirect("/admin/semesters?tab=wilayah");
}
