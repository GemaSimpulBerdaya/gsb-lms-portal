import { redirect } from "next/navigation";

/**
 * Redirect halaman lama ke tab "Lokasi Belajar & Fase".
 * Path /admin/levels sebelumnya berisi CRUD lokasi + readonly fase. Sekarang
 * digabung ke /admin/semesters?tab=lokasi-belajar supaya admin punya satu pintu
 * masuk untuk semua data master kalender dan lokasi belajar.
 */
export default function LevelsRedirectPage() {
  redirect("/admin/semesters?tab=lokasi-belajar");
}
