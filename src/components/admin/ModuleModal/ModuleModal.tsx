"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./ModuleModal.module.css";
import { ModuleItem } from "@/components/admin/ModuleTable/ModuleTable";

interface ModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  moduleToEdit?: ModuleItem | null;
}

export default function ModuleModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  moduleToEdit = null 
}: ModuleModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    category: "SNBT",
    subCategory: "Matematika",
    week: 1,
    order: 0,
    fileUrl: "",
    semester: "2025-1"
  });
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    fetch("/api/admin/settings")
      .then(res => res.json())
      .then(data => {
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
      })
      .catch(err => console.error("Gagal load semesters", err));
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    if (moduleToEdit) {
      setFormData({
        title: moduleToEdit.title,
        slug: moduleToEdit.slug,
        description: (moduleToEdit as any).description || "",
        category: moduleToEdit.category,
        subCategory: moduleToEdit.subCategory || "Matematika",
        week: moduleToEdit.week || 1,
        order: moduleToEdit.order || 0,
        fileUrl: (moduleToEdit as any).fileUrl || "",
        semester: (moduleToEdit as any).semester || localStorage.getItem("activeSemester") || "2025-1"
      });
    } else {
      setFormData({
        title: "",
        slug: "",
        description: "",
        category: "SNBT",
        subCategory: "Matematika",
        week: 1,
        order: 0,
        fileUrl: "",
        semester: localStorage.getItem("activeSemester") || "2025-1"
      });
    }
  }, [moduleToEdit, isOpen]);

  if (!isOpen || !mounted) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    const uploadData = new FormData();
    uploadData.append("file", file);

    try {
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: uploadData
      });

      const data = await res.json();

      if (res.ok) {
        setFormData({ ...formData, fileUrl: data.url });
      } else {
        setError(data.error || "Gagal mengunggah file");
      }
    } catch (err) {
      setError("Kesalahan koneksi saat unggah");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = moduleToEdit 
        ? `/api/admin/modules/${moduleToEdit._id}` 
        : "/api/admin/modules";
      
      const res = await fetch(url, {
        method: moduleToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Gagal menyimpan data");
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    const slug = title.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
    setFormData({ ...formData, title, slug });
  };

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{moduleToEdit ? "Edit Modul" : "Tambah Modul Baru"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.field}>
            <label>Judul Modul</label>
            <input 
              type="text" 
              placeholder="Contoh: Logika Matematika"
              value={formData.title}
              onChange={e => generateSlug(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label>Slug (URL Safe)</label>
            <input 
              type="text" 
              placeholder="logika-matematika"
              value={formData.slug}
              onChange={e => setFormData({ ...formData, slug: e.target.value })}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Kategori Utama</label>
              <select 
                value={formData.category}
                onChange={e => setFormData({ ...formData, category: e.target.value as any })}
                className={styles.select}
              >
                <option value="SNBT">SNBT (Online)</option>
                <option value="OFFLINE">OFFLINE (Kelas)</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Sub-Kategori / Mapel</label>
              <select 
                value={formData.subCategory}
                onChange={e => setFormData({ ...formData, subCategory: e.target.value })}
                className={styles.select}
              >
                <option value="Matematika">Matematika</option>
                <option value="IPA">IPA</option>
                <option value="IPS">IPS</option>
                <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                <option value="Bahasa Inggris">Bahasa Inggris</option>
                <option value="SD">SD</option>
                <option value="SMP">SMP</option>
                <option value="TK">TK</option>
                <option value="DISABILITAS">Disabilitas</option>
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label>Semester Target</label>
            <select 
              value={formData.semester}
              onChange={e => setFormData({ ...formData, semester: e.target.value })}
              className={styles.select}
            >
              {availableSemesters.map(sem => (
                <option key={sem} value={sem}>{sem}</option>
              ))}
            </select>
            <p className={styles.fieldHint}>Modul hanya akan muncul di jadwal relawan pada semester ini.</p>
          </div>

          <div className={styles.row}>
            {formData.category === 'OFFLINE' ? (
              <div className={styles.field}>
                <label>Minggu Ke-</label>
                <input 
                  type="number" 
                  value={formData.week}
                  onChange={e => setFormData({ ...formData, week: parseInt(e.target.value) })}
                />
              </div>
            ) : (
              <div className={styles.field}>
                <label>Urutan (Order)</label>
                <input 
                  type="number" 
                  value={formData.order}
                  onChange={e => setFormData({ ...formData, order: parseInt(e.target.value) })}
                />
              </div>
            )}
            <div className={styles.field}>
              <label>File Modul (PDF)</label>
              <div className={styles.fileUploadWrapper}>
                <input 
                  type="file" 
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileUpload}
                  className={styles.fileInput}
                />
                <div className={styles.fileStatus}>
                  {uploading ? "Sedang mengunggah..." : formData.fileUrl ? "✅ File terpilih" : "Belum ada file"}
                </div>
              </div>
              <input 
                type="text" 
                placeholder="Atau tempel link file di sini..."
                value={formData.fileUrl}
                onChange={e => setFormData({ ...formData, fileUrl: e.target.value })}
                className={styles.urlInput}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Deskripsi Singkat</label>
            <textarea 
              placeholder="Apa yang dipelajari di modul ini?"
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              rows={3}
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Batal</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Modul"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
