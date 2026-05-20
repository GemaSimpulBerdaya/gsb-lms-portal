import { useState } from "react";
import { createPortal } from "react-dom";
import styles from "./VolunteerModal.module.css";
import { useMounted } from "@/hooks/useMounted";

interface VolunteerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function VolunteerModal({ isOpen, onClose, onSuccess }: VolunteerModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    teamName: "",
    region: ""
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const mounted = useMounted();

  if (!isOpen || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/volunteers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData({ name: "", email: "", password: "", teamName: "", region: "" });
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
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Tambah Relawan Baru</h2>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {error && <div className={styles.error}>{error}</div>}
          
          <div className={styles.field}>
            <label>Nama Lengkap</label>
            <input 
              type="text" 
              placeholder="Contoh: Ahmad Fauzi"
              value={formData.name}
              onChange={e => setFormData({...formData, name: e.target.value})}
              required
            />
          </div>

          <div className={styles.field}>
            <label>Email</label>
            <input 
              type="email" 
              placeholder="email@gsb.com"
              value={formData.email}
              onChange={e => setFormData({...formData, email: e.target.value})}
              required
            />
          </div>

          <div className={styles.field}>
            <label>Password</label>
            <input 
              type="password" 
              placeholder="Minimal 6 karakter"
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              required
            />
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Nama Tim</label>
              <input 
                type="text" 
                placeholder="Misal: Tim Jakarta"
                value={formData.teamName}
                onChange={e => setFormData({...formData, teamName: e.target.value})}
              />
            </div>
            <div className={styles.field}>
              <label>Wilayah</label>
              <input 
                type="text" 
                placeholder="Misal: Depok"
                value={formData.region}
                onChange={e => setFormData({...formData, region: e.target.value})}
              />
            </div>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>Batal</button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan Relawan"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
