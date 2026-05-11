"use client";

import { useEffect, useState } from "react";
import styles from "../semesters/semesters.module.css"; // Reuse semester styles

export default function LevelsPage() {
  const [levels, setLevels] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modals for Levels
  const [isLevelModalOpen, setIsLevelModalOpen] = useState(false);
  const [newLevelName, setNewLevelName] = useState("");
  const [editLevelModal, setEditLevelModal] = useState<{ isOpen: boolean; oldName: string; newName: string }>({
    isOpen: false, oldName: "", newName: ""
  });

  // Modals for Regions
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");
  const [editRegionModal, setEditRegionModal] = useState<{ isOpen: boolean; oldName: string; newName: string }>({
    isOpen: false, oldName: "", newName: ""
  });

  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setLevels(data.availableLevels || []);
        setRegions(data.availableRegions || []);
      }
    } catch (err) {
      showToast("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // --- Level Handlers ---
  const handleAddLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLevelName.trim()) return;
    setSubmitting(true);
    try {
      const newList = [...levels, newLevelName.toUpperCase()];
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableLevels: Array.from(new Set(newList)) })
      });
      if (res.ok) {
        showToast("Jenjang baru ditambahkan!");
        setIsLevelModalOpen(false);
        setNewLevelName("");
        fetchData();
      }
    } catch (err) { showToast("Gagal menambah jenjang"); }
    finally { setSubmitting(false); }
  };

  const handleDeleteLevel = async (name: string) => {
    if (!confirm(`Hapus jenjang ${name}?`)) return;
    try {
      const newList = levels.filter(l => l !== name);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableLevels: newList })
      });
      if (res.ok) { showToast("Jenjang dihapus"); fetchData(); }
    } catch (err) { showToast("Gagal menghapus jenjang"); }
  };

  const handleEditLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLevelModal.newName.trim()) return;
    setSubmitting(true);
    try {
      const newList = levels.map(l => l === editLevelModal.oldName ? editLevelModal.newName.toUpperCase() : l);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableLevels: newList })
      });
      if (res.ok) {
        showToast("Jenjang berhasil diubah!");
        setEditLevelModal({ isOpen: false, oldName: "", newName: "" });
        fetchData();
      }
    } catch (err) { showToast("Gagal mengubah jenjang"); }
    finally { setSubmitting(false); }
  };

  // --- Region Handlers ---
  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionName.trim()) return;
    setSubmitting(true);
    try {
      const newList = [...regions, newRegionName.toUpperCase()];
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableRegions: Array.from(new Set(newList)) })
      });
      if (res.ok) {
        showToast("Wilayah baru ditambahkan!");
        setIsRegionModalOpen(false);
        setNewRegionName("");
        fetchData();
      }
    } catch (err) { showToast("Gagal menambah wilayah"); }
    finally { setSubmitting(false); }
  };

  const handleDeleteRegion = async (name: string) => {
    if (!confirm(`Hapus wilayah ${name}?`)) return;
    try {
      const newList = regions.filter(r => r !== name);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableRegions: newList })
      });
      if (res.ok) { showToast("Wilayah dihapus"); fetchData(); }
    } catch (err) { showToast("Gagal menghapus wilayah"); }
  };

  const handleEditRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRegionModal.newName.trim()) return;
    setSubmitting(true);
    try {
      const newList = regions.map(r => r === editRegionModal.oldName ? editRegionModal.newName.toUpperCase() : r);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableRegions: newList })
      });
      if (res.ok) {
        showToast("Wilayah berhasil diubah!");
        setEditRegionModal({ isOpen: false, oldName: "", newName: "" });
        fetchData();
      }
    } catch (err) { showToast("Gagal mengubah wilayah"); }
    finally { setSubmitting(false); }
  };

  if (loading) {
    return <div className={styles.loading}>Memuat Manajemen...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Wilayah & Fase</h1>
          <p className={styles.subtitle}>Kelola daftar wilayah operasional dan jenjang pendidikan (fase).</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
        
        {/* Section Wilayah */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#2d3436' }}>Daftar Wilayah</h2>
            <button className={styles.addBtn} onClick={() => setIsRegionModalOpen(true)} style={{ padding: '6px 12px', fontSize: '13px' }}>
              + Tambah Wilayah
            </button>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama Wilayah</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {regions.map((r) => (
                  <tr key={r}>
                    <td><div className={styles.semName}>{r}</div></td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => setEditRegionModal({ isOpen: true, oldName: r, newName: r })}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteRegion(r)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section Jenjang/Fase */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#2d3436' }}>Daftar Jenjang (Fase)</h2>
            <button className={styles.addBtn} onClick={() => setIsLevelModalOpen(true)} style={{ padding: '6px 12px', fontSize: '13px' }}>
              + Tambah Jenjang
            </button>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Nama Fase</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {levels.map((l) => (
                  <tr key={l}>
                    <td><div className={styles.semName}>{l}</div></td>
                    <td>
                      <div className={styles.actions}>
                        <button className={styles.editBtn} onClick={() => setEditLevelModal({ isOpen: true, oldName: l, newName: l })}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg></button>
                        <button className={styles.deleteBtn} onClick={() => handleDeleteLevel(l)}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* --- Modals --- */}
      
      {/* Level Modals */}
      {(isLevelModalOpen || editLevelModal.isOpen) && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{isLevelModalOpen ? "Tambah Jenjang" : "Edit Jenjang"}</h2>
            <form onSubmit={isLevelModalOpen ? handleAddLevel : handleEditLevel}>
              <input autoFocus className={styles.inputField} value={isLevelModalOpen ? newLevelName : editLevelModal.newName} onChange={e => isLevelModalOpen ? setNewLevelName(e.target.value) : setEditLevelModal({...editLevelModal, newName: e.target.value})} required />
              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancel} onClick={() => { setIsLevelModalOpen(false); setEditLevelModal({...editLevelModal, isOpen: false}); }}>Batal</button>
                <button type="submit" className={styles.modalSubmit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Region Modals */}
      {(isRegionModalOpen || editRegionModal.isOpen) && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>{isRegionModalOpen ? "Tambah Wilayah" : "Edit Wilayah"}</h2>
            <form onSubmit={isRegionModalOpen ? handleAddRegion : handleEditRegion}>
              <input autoFocus className={styles.inputField} value={isRegionModalOpen ? newRegionName : editRegionModal.newName} onChange={e => isRegionModalOpen ? setNewRegionName(e.target.value) : setEditRegionModal({...editRegionModal, newName: e.target.value})} required />
              <div className={styles.modalActions}>
                <button type="button" className={styles.modalCancel} onClick={() => { setIsRegionModalOpen(false); setEditRegionModal({...editRegionModal, isOpen: false}); }}>Batal</button>
                <button type="submit" className={styles.modalSubmit} disabled={submitting}>{submitting ? "Menyimpan..." : "Simpan"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className={styles.toast}><span>✨</span> {toast}</div>}
    </div>
  );
}
