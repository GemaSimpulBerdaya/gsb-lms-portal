import { redirect } from "next/navigation";

/**
 * Redirect halaman lama → tab Sub-Kategori SNBT di halaman Modul.
 * /admin/categories sebelumnya halaman tersendiri; sekarang dilebur jadi tab
 * di /admin/modules supaya admin tidak perlu loncat menu untuk konfigurasi
 * sub-kategori yang dipakai modul.
 */
export default function CategoriesRedirectPage() {
  redirect("/admin/modules?tab=categories");
}
