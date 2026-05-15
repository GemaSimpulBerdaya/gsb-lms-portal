"use client";

import { useState, useEffect } from "react";
import Toast from "@/components/Toast/Toast";
import styles from "./categories.module.css";

interface SubCategory {
  _id: string;
  name: string;
  type: "SNBT" | "OFFLINE";
  parentLabel: string;
  order: number;
}

/**
 * Tab "Sub-Kategori SNBT" — versi sebelumnya isi /admin/categories/page.tsx.
 * Setelah refactor faseConfig, halaman ini fokus untuk sub-kategori SNBT
 * (mis. Saintek, Soshum). Modul OFFLINE pakai fase dari Konfigurasi Raport.
 */
export default function SubCategoriesPanel() {
  const [categories, setCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    type: "SNBT" | "OFFLINE";
    parentLabel: string;
    order: number;
  }>({
    name: "",
    type: "SNBT",
    parentLabel: "SMA / SNBT",
    order: 0,
  });

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/admin/subcategories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.subCategories || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => { fetchCategories(); });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...formData, id: editingId } : formData;

      const res = await fetch("/api/admin/subcategories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setToast({ message: "Berhasil menyimpan kategori", type: "success" });
        setIsModalOpen(false);
        fetchCategories();
      } else {
        const data = await res.json();
        setToast({ message: `Gagal: ${data.error || "Terjadi kesalahan"}`, type: "error" });
      }
    } catch {
      setToast({ message: "Terjadi kesalahan", type: "error" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus kategori ini?")) return;
    try {
      const res = await fetch(`/api/admin/subcategories?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ message: "Kategori dihapus", type: "success" });
        fetchCategories();
      }
    } catch {
      setToast({ message: "Gagal menghapus", type: "error" });
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ name: "", type: "SNBT", parentLabel: "SMA / SNBT", order: 0 });
    setIsModalOpen(true);
  };

  const openEdit = (cat: SubCategory) => {
    setEditingId(cat._id);
    setFormData({
      name: cat.name,
      type: cat.type,
      parentLabel: cat.parentLabel,
      order: cat.order,
    });
    setIsModalOpen(true);
  };

  if (loading) return <div className={styles.loading}>Memuat...</div>;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          background: "#fffbeb",
          border: "1px solid #fde68a",
          borderRadius: 12,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: "#92400e",
          lineHeight: 1.5,
        }}
      >
        <span style={{ fontSize: 18 }}>💡</span>
        <div>
          Sub-kategori di bawah dipakai untuk modul <strong>SNBT</strong> (Saintek, Soshum, dll.).
          Modul OFFLINE pakai fase langsung dari{" "}
          <a
            href="/admin/report-config"
            style={{ color: "#c0392b", fontWeight: 700, textDecoration: "underline" }}
          >
            Konfigurasi Raport
          </a>
          .
        </div>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#2d3436", margin: 0 }}>
          Daftar Sub-Kategori
        </h2>
        <button className={styles.addBtn} onClick={openAdd}>
          + Tambah Kategori
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>No.</th>
              <th>Nama Kategori/Kelas</th>
              <th>Tipe Portal</th>
              <th>Grup (Parent Label)</th>
              <th>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {categories.map((cat, index) => (
              <tr key={cat._id}>
                <td>{index + 1}</td>
                <td className={styles.nameCell}>{cat.name}</td>
                <td>
                  <span
                    className={`${styles.typeBadge} ${
                      cat.type === "SNBT" ? styles.typeSnbt : styles.typeOffline
                    }`}
                  >
                    {cat.type}
                  </span>
                </td>
                <td className={styles.parentCell}>{cat.parentLabel || "-"}</td>
                <td className={styles.actions}>
                  <button onClick={() => openEdit(cat)} className={styles.editBtn}>
                    Edit
                  </button>
                  <button onClick={() => handleDelete(cat._id)} className={styles.deleteBtn}>
                    Hapus
                  </button>
                </td>
              </tr>
            ))}
            {categories.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "#888" }}>
                  Belum ada sub-kategori. Klik <strong>+ Tambah Kategori</strong> untuk memulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2>{editingId ? "Edit Kategori" : "Tambah Kategori"}</h2>
            <form onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label>Nama Kategori / Kelas</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Saintek, Soshum, Bahasa Inggris"
                  required
                />
              </div>
              <div className={styles.field}>
                <label>Tipe Portal</label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as "SNBT" | "OFFLINE" })
                  }
                >
                  <option value="SNBT">SNBT (Online SMA)</option>
                  <option value="OFFLINE">OFFLINE (Kelas GSB)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Label Grup (Parent)</label>
                <select
                  value={formData.parentLabel}
                  onChange={(e) => setFormData({ ...formData, parentLabel: e.target.value })}
                >
                  <option value="">Pilih Grup...</option>
                  <option value="Sekolah Dasar (SD)">Sekolah Dasar (SD)</option>
                  <option value="Sekolah Menengah (SMP)">Sekolah Menengah (SMP)</option>
                  <option value="SMA / SNBT">SMA / SNBT</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setIsModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.saveBtn}>
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
