import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./StudentModal.module.css";

import { Student } from "../AdminStudentTable/AdminStudentTable";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  existingRegions?: string[];
  studentToEdit?: Student | null;
}

export default function StudentModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  existingRegions = [], 
  studentToEdit = null 
}: StudentModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    region: "",
    category: "SD" as any,
    parentName: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Pre-fill form when editing
  useEffect(() => {
    if (studentToEdit) {
      setFormData({
        name: studentToEdit.name,
        region: studentToEdit.region || "",
        category: studentToEdit.category,
        parentName: studentToEdit.parentName || ""
      });
    } else {
      setFormData({ name: "", region: "", category: "SD", parentName: "" });
    }
  }, [studentToEdit, isOpen]);

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = studentToEdit 
        ? `/api/admin/students/${studentToEdit._id}` 
        : "/api/admin/students";
      
      const res = await fetch(url, {
        method: studentToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData({ name: "", region: "", category: "SD", parentName: "" });
      } else {
        setError(data.error || "Gagal menyimpan data");
      }
    } catch (err) {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>{studentToEdit ? "Edit Data Anak Didik" : "Tambah Anak Didik Baru"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.field}>
            <label>Nama Lengkap</label>
            <input 
              type="text" 
              placeholder="Contoh: Budi Santoso"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className={styles.field}>
            <label>Kategori / Jenjang</label>
            <select 
              value={formData.category}
              onChange={e => setFormData({...formData, category: e.target.value})}
              required
              className={styles.select}
            >
              <option value="TK">TK</option>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="DISABILITAS">Disabilitas</option>
            </select>
          </div>

          <div className={styles.field}>
            <label>Nama Orang Tua / Wali</label>
            <input 
              type="text" 
              placeholder="Contoh: Bpk. Joko"
              value={formData.parentName}
              onChange={e => setFormData({...formData, parentName: e.target.value})}
            />
          </div>

          <div className={styles.field}>
            <label>Wilayah</label>
            <input 
              type="text" 
              list="region-list"
              placeholder="Pilih atau ketik wilayah baru..."
              value={formData.region}
              onChange={e => setFormData({...formData, region: e.target.value})}
            />
            <datalist id="region-list">
              {existingRegions.map(reg => (
                <option key={reg} value={reg} />
              ))}
            </datalist>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Batal</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Data Siswa"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
