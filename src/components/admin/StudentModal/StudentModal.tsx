import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import styles from "./StudentModal.module.css";

import { Student } from "../AdminStudentTable/AdminStudentTable";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableRegions?: string[];
  availableLevels?: string[];
  studentToEdit?: Student | null;
}

type FormState = {
  name: string;
  region: string;
  category: string;
  parentName: string;
  // Excel
  studentCode: string;
  kodeKelas: string;
  pic: string;
  // Raport
  gender: "" | "Laki-laki" | "Perempuan";
  birthPlace: string;
  birthDate: string; // yyyy-mm-dd for input[type=date]
  schoolOrigin: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  region: "",
  category: "FASE A",
  parentName: "",
  studentCode: "",
  kodeKelas: "",
  pic: "",
  gender: "",
  birthPlace: "",
  birthDate: "",
  schoolOrigin: "",
  phone: "",
  address: "",
};

const KODE_KELAS_OPTIONS = [
  { value: "", label: "— Pilih Kode —" },
  { value: "S-0FD", label: "S-0FD (Offline Depok)" },
  { value: "S-OFB", label: "S-OFB (Offline Bogor)" },
  { value: "S-ONR", label: "S-ONR (Online Reguler)" },
  { value: "S-ONS", label: "S-ONS (Online SNBT)" },
];

export default function StudentModal({
  isOpen,
  onClose,
  onSuccess,
  availableRegions = [],
  availableLevels = [],
  studentToEdit = null,
}: StudentModalProps) {
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
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
        name: studentToEdit.name || "",
        region: studentToEdit.region || "",
        category: studentToEdit.category || "FASE A",
        parentName: studentToEdit.parentName || "",
        studentCode: studentToEdit.studentCode || "",
        kodeKelas: studentToEdit.kodeKelas || "",
        pic: studentToEdit.pic || "",
        gender: (studentToEdit.gender as FormState["gender"]) || "",
        birthPlace: studentToEdit.birthPlace || "",
        birthDate: studentToEdit.birthDate
          ? new Date(studentToEdit.birthDate).toISOString().slice(0, 10)
          : "",
        schoolOrigin: studentToEdit.schoolOrigin || "",
        phone: studentToEdit.phone || "",
        address: studentToEdit.address || "",
      });
    } else {
      setFormData(EMPTY_FORM);
    }
  }, [studentToEdit, isOpen]);

  if (!isOpen || !mounted) return null;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = studentToEdit
        ? `/api/admin/students/${studentToEdit._id}`
        : "/api/admin/students";

      // Buang field kosong agar tidak override dengan string kosong saat edit optional
      const payload: Record<string, unknown> = { ...formData };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] === null) delete payload[k];
      });
      // Field wajib selalu dikirim walaupun "" (biar validasi server yang komplain)
      payload.name = formData.name;
      payload.category = formData.category;

      const res = await fetch(url, {
        method: studentToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData(EMPTY_FORM);
      } else {
        setError(data.error || "Gagal menyimpan data");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div className={styles.overlay}>
      <div className={`${styles.modal} ${styles.modalLarge}`}>
        <div className={styles.header}>
          <h2>{studentToEdit ? "Edit Data Anak Didik" : "Tambah Anak Didik Baru"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}

          {/* ── Data Utama ───────────────────────────────── */}
          <div className={styles.sectionTitle}>Data Utama</div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Nama Lengkap *</label>
              <input
                type="text"
                placeholder="Contoh: Budi Santoso"
                value={formData.name}
                onChange={(e) => set("name", e.target.value)}
                required
              />
            </div>
            <div className={styles.field}>
              <label>Nama Orang Tua / Wali *</label>
              <input
                type="text"
                placeholder="Contoh: Bpk. Joko"
                value={formData.parentName}
                onChange={(e) => set("parentName", e.target.value)}
                required
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Kategori / Fase *</label>
              <select
                value={formData.category}
                onChange={(e) => set("category", e.target.value)}
                required
                className={styles.select}
              >
                {availableLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
                <option value="TK">TK (Old)</option>
                <option value="SD">SD (Old)</option>
                <option value="SMP">SMP (Old)</option>
              </select>
            </div>

            <div className={styles.field}>
              <label>Wilayah / Kelas Belajar *</label>
              <select
                value={formData.region}
                onChange={(e) => set("region", e.target.value)}
                required
                className={styles.select}
              >
                <option value="" disabled>
                  Pilih Wilayah...
                </option>
                {availableRegions.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ── Data dari Excel ───────────────────────────── */}
          <div className={styles.sectionTitle}>Data Administratif (Excel)</div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>No. Induk</label>
              <input
                type="text"
                placeholder="Contoh: 2526001"
                value={formData.studentCode}
                onChange={(e) => set("studentCode", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Kode Kelas</label>
              <select
                value={formData.kodeKelas}
                onChange={(e) => set("kodeKelas", e.target.value)}
                className={styles.select}
              >
                {KODE_KELAS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label>PIC Relawan</label>
              <input
                type="text"
                placeholder="Nama PIC"
                value={formData.pic}
                onChange={(e) => set("pic", e.target.value)}
              />
            </div>
          </div>

          {/* ── Data Raport ───────────────────────────────── */}
          <div className={styles.sectionTitle}>Data Profil Raport (Opsional)</div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Jenis Kelamin</label>
              <select
                value={formData.gender}
                onChange={(e) => set("gender", e.target.value as FormState["gender"])}
                className={styles.select}
              >
                <option value="">— Pilih —</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div className={styles.field}>
              <label>Tempat Lahir</label>
              <input
                type="text"
                placeholder="Contoh: Depok"
                value={formData.birthPlace}
                onChange={(e) => set("birthPlace", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>Tanggal Lahir</label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => set("birthDate", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Asal Sekolah</label>
              <input
                type="text"
                placeholder="Contoh: SD Master"
                value={formData.schoolOrigin}
                onChange={(e) => set("schoolOrigin", e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label>No. WhatsApp</label>
              <input
                type="text"
                placeholder="Contoh: 0895 xxxx xxxx"
                value={formData.phone}
                onChange={(e) => set("phone", e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label>Alamat Domisili</label>
            <textarea
              placeholder="Alamat lengkap..."
              value={formData.address}
              onChange={(e) => set("address", e.target.value)}
            />
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Batal
            </button>
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
