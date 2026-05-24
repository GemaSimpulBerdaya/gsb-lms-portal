"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./ModuleModal.module.css";
import { ModuleItem } from "@/components/admin/ModuleTable/ModuleTable";
import { useMounted } from "@/hooks/useMounted";
import { uploadFiles } from "@/lib/uploadthing";

interface SubProgramTypeItem {
  _id: string;
  name: string;
  type: string;
  parentLabel?: string;
}

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
    programType: "SNBT",
    fase: "",          // OFFLINE saja: nama fase
    subCategoryId: "",    // SNBT saja: nama sub-kategori
    week: 1,
    order: 0,
    fileUrl: "",
    semester: "2025-1"
  });
  
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useMounted();

  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<SubProgramTypeItem[]>([]);

  useEffect(() => {
    // Fetch semesters
    fetch("/api/admin/settings")
      .then(res => res.json())
      .then(data => {
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
      })
      .catch(err => console.error("Gagal load semesters", err));

    // Fetch subcategories
    fetch("/api/admin/subcategories")
      .then(res => res.json())
      .then(data => {
        if (data.subCategories) setSubCategories(data.subCategories);
      })
      .catch(err => console.error("Gagal load subcategories", err));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (moduleToEdit) {
        setFormData({
          title: moduleToEdit.title,
          slug: moduleToEdit.slug,
          description: moduleToEdit.description || "",
          programType: moduleToEdit.programType,
          fase: (moduleToEdit.fase || "").toString(),
          subCategoryId: moduleToEdit.subCategoryId || "",
          week: moduleToEdit.week || 1,
          order: moduleToEdit.order || 0,
          fileUrl: moduleToEdit.fileUrl || "",
          semester: moduleToEdit.semester || localStorage.getItem("activeSemester") || "2025-1"
        });
      } else {
        setFormData({
          title: "",
          slug: "",
          description: "",
          programType: "SNBT",
          fase: "",
          subCategoryId: "",
          week: 1,
          order: 0,
          fileUrl: "",
          semester: localStorage.getItem("activeSemester") || "2025-1"
        });
      }
    });
  }, [moduleToEdit, isOpen]);

  // Auto-pilih default ketika user ganti programType
  useEffect(() => {
    queueMicrotask(() => {
      if (formData.programType === "OFFLINE") {
        // pilih fase pertama kalau belum ada fase valid
        if (availableLevels.length > 0) {
          const isValid = availableLevels.some((l) => l === formData.fase);
          if (!isValid) {
            setFormData((prev) => ({ ...prev, fase: availableLevels[0], subCategoryId: "" }));
          }
        }
      } else {
        // SNBT — pilih subCategoryId pertama yang type-nya SNBT
        if (subCategories.length > 0) {
          const filtered = subCategories.filter((s) => s.type === "SNBT");
          if (filtered.length > 0) {
            const isValid = filtered.some((s) => s.name === formData.subCategoryId);
            if (!isValid) {
              setFormData((prev) => ({ ...prev, subCategoryId: filtered[0].name, fase: "" }));
            }
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.programType, availableLevels, subCategories]);

  if (!isOpen || !mounted) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const result = await uploadFiles("moduleFile", { files: [file] });
      const first = result?.[0];
      if (first?.ufsUrl) {
        setFormData({ ...formData, fileUrl: first.ufsUrl });
      } else {
        setError("Gagal mengunggah file");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kesalahan koneksi saat unggah");
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
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    // Combine title + (fase/subCategoryId) untuk uniqueness antar fase/sub
    const suffix = formData.programType === "OFFLINE" ? formData.fase : formData.subCategoryId;
    const combined = `${title} ${suffix}`;
    const slug = combined
      .toLowerCase()
      .trim()
      .replace(/ /g, '-')
      .replace(/[^\w-]+/g, '');
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
          {error && (
            <div className={styles.error}>
              <strong>Gagal:</strong> {error}
            </div>
          )}
          
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
                value={formData.programType}
                onChange={e => setFormData({ ...formData, programType: e.target.value as "SNBT" | "OFFLINE" })}
                className={styles.select}
              >
                <option value="SNBT">SNBT (Online)</option>
                <option value="OFFLINE">OFFLINE (Kelas)</option>
              </select>
            </div>
            <div className={styles.field}>
              {formData.programType === "OFFLINE" ? (
                <>
                  <label>Pilih Fase</label>
                  <select
                    value={formData.fase}
                    onChange={(e) => setFormData({ ...formData, fase: e.target.value })}
                    className={styles.select}
                    required
                  >
                    {availableLevels.length === 0 && <option value="">— Belum ada fase —</option>}
                    {availableLevels.map((lvl) => (
                      <option key={lvl} value={lvl}>{lvl}</option>
                    ))}
                  </select>
                  <p className={styles.fieldHint}>
                    Daftar fase di-derive dari Konfigurasi Raport. Tambah fase baru lewat /admin/report-config.
                  </p>
                </>
              ) : (
                <>
                  <label>Pilih Sub-Kategori SNBT</label>
                  <select
                    value={formData.subCategoryId}
                    onChange={(e) => setFormData({ ...formData, subCategoryId: e.target.value })}
                    className={styles.select}
                    required
                  >
                    {(() => {
                      const filtered = subCategories.filter((s) => s.type === "SNBT");
                      const groups = filtered.reduce<Record<string, SubProgramTypeItem[]>>((acc, s) => {
                        const label = s.parentLabel || "Lainnya";
                        if (!acc[label]) acc[label] = [];
                        acc[label].push(s);
                        return acc;
                      }, {});

                      if (Object.keys(groups).length === 0) {
                        return <option value="">— Belum ada sub-kategori SNBT —</option>;
                      }
                      return Object.entries(groups).map(([label, items]) => (
                        <optgroup key={label} label={label}>
                          {items.map((item) => (
                            <option key={item._id} value={item.name}>{item.name}</option>
                          ))}
                        </optgroup>
                      ));
                    })()}
                  </select>
                  <p className={styles.fieldHint}>
                    Sub-kategori SNBT (mis. Saintek, Soshum) dikelola di tab Sub-Kategori SNBT pada halaman Modul.
                  </p>
                </>
              )}
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
            {formData.programType === 'OFFLINE' && (
              <div className={styles.field}>
                <label>Minggu Ke-</label>
                <input 
                  type="number" 
                  value={formData.week}
                  onChange={e => setFormData({ ...formData, week: parseInt(e.target.value) })}
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
