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

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<SubCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "OFFLINE",
    parentLabel: "",
    order: 0
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
    fetchCategories();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editingId ? "PUT" : "POST";
      const body = editingId ? { ...formData, id: editingId } : formData;
      
      const res = await fetch("/api/admin/subcategories", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        setToast({ message: "Berhasil menyimpan kategori", type: "success" });
        setIsModalOpen(false);
        fetchCategories();
      } else {
        const data = await res.json();
        setToast({ message: `Gagal: ${data.error || "Terjadi kesalahan"}`, type: "error" });
      }
    } catch (err) {
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
    } catch (err) {
      setToast({ message: "Gagal menghapus", type: "error" });
    }
  };

  const openAdd = () => {
    setEditingId(null);
    setFormData({ name: "", type: "OFFLINE", parentLabel: "", order: 0 });
    setIsModalOpen(true);
  };

  const openEdit = (cat: SubCategory) => {
    setEditingId(cat._id);
    setFormData({
      name: cat.name,
      type: cat.type,
      parentLabel: cat.parentLabel,
      order: cat.order
    });
    setIsModalOpen(true);
  };

  if (loading) return <div className={styles.loading}>Memuat...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Manajemen Kategori SNBT</h1>
          <p className={styles.subtitle}>
            Atur sub-kategori untuk modul SNBT (Saintek, Soshum, dll.). Untuk modul OFFLINE, sekarang langsung pakai fase dari Konfigurasi Raport — tidak perlu lewat sini.
          </p>
        </div>
        <button className={styles.addBtn} onClick={openAdd}>+ Tambah Kategori</button>
      </div>

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
          Halaman ini sekarang fokus untuk <strong>SNBT</strong> saja. Modul OFFLINE pakai dropdown <strong>Fase</strong> di form Tambah Modul (sumber: <a href="/admin/report-config" style={{ color: "#c0392b", fontWeight: 700, textDecoration: "underline" }}>Konfigurasi Raport</a>).
        </div>
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
                  <span className={`${styles.typeBadge} ${cat.type === 'SNBT' ? styles.typeSnbt : styles.typeOffline}`}>
                    {cat.type}
                  </span>
                </td>
                <td className={styles.parentCell}>{cat.parentLabel || "-"}</td>
                <td className={styles.actions}>
                  <button onClick={() => openEdit(cat)} className={styles.editBtn}>Edit</button>
                  <button onClick={() => handleDelete(cat._id)} className={styles.deleteBtn}>Hapus</button>
                </td>
              </tr>
            ))}
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
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Contoh: Kelas 1 atau Biologi"
                  required 
                />
              </div>
              <div className={styles.field}>
                <label>Tipe Portal</label>
                <select 
                  value={formData.type} 
                  onChange={e => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="OFFLINE">OFFLINE (Kelas GSB)</option>
                  <option value="SNBT">SNBT (Online SMA)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label>Label Grup (Parent)</label>
                <select 
                  value={formData.parentLabel} 
                  onChange={e => setFormData({ ...formData, parentLabel: e.target.value })}
                >
                  <option value="">Pilih Grup...</option>
                  <option value="Sekolah Dasar (SD)">Sekolah Dasar (SD)</option>
                  <option value="Sekolah Menengah (SMP)">Sekolah Menengah (SMP)</option>
                  <option value="SMA / SNBT">SMA / SNBT</option>
                  <option value="Lainnya">Lainnya</option>
                </select>
              </div>
              <div className={styles.modalActions}>
                <button type="button" onClick={() => setIsModalOpen(false)}>Batal</button>
                <button type="submit" className={styles.saveBtn}>Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
