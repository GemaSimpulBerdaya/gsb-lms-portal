"use client";

import { useEffect, useState } from "react";
import styles from "../semesters.module.css";
import { useDialog } from "@/components/ui/DialogProvider";
import Spinner from "@/components/ui/Spinner/Spinner";

type FaseSkeleton = {
  jenjang: string;
  uasKognitif: never[];
  uasAfektif: never[];
  uasBInggris: null;
  kbmMaxPerComponent: number;
};

const DEFAULT_KBM = 1400;

const buildFaseSkeleton = (name: string): FaseSkeleton => ({
  jenjang: name, // sementara pakai nama fase; admin bisa edit di Konfigurasi Raport
  uasKognitif: [],
  uasAfektif: [],
  uasBInggris: null,
  kbmMaxPerComponent: DEFAULT_KBM,
});

/**
 * Panel "Lokasi Belajar & Fase" — sekarang full CRUD untuk fase.
 *
 * Source of truth: faseConfig di Settings. Daftar fase di-derive dari
 * Object.keys(faseConfig) (di-handle oleh GET /api/admin/settings).
 *
 * Ketika tambah fase, kita kirim faseConfig lengkap ke server dengan entry
 * baru berupa skeleton minimum supaya lolos validator. Admin lalu lengkapi
 * komponen UAS/KBM lewat tab Konfigurasi Raport.
 */
export default function RegionsPanel() {
  const { showConfirm } = useDialog();
  const [levels, setLevels] = useState<string[]>([]);
  const [faseConfig, setFaseConfig] = useState<Record<string, unknown>>({});
  const [regions, setRegions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [regionSearch, setRegionSearch] = useState("");
  const [faseSearch, setFaseSearch] = useState("");

  // Region modals
  const [isRegionModalOpen, setIsRegionModalOpen] = useState(false);
  const [newRegionName, setNewRegionName] = useState("");
  const [editRegionModal, setEditRegionModal] = useState<{
    isOpen: boolean;
    oldName: string;
    newName: string;
  }>({ isOpen: false, oldName: "", newName: "" });

  // Fase modals
  const [isFaseModalOpen, setIsFaseModalOpen] = useState(false);
  const [newFaseName, setNewFaseName] = useState("");
  const [editFaseModal, setEditFaseModal] = useState<{
    isOpen: boolean;
    oldName: string;
    newName: string;
  }>({ isOpen: false, oldName: "", newName: "" });

  const [toast, setToast] = useState<{ msg: string; type?: "error" | "success" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string, type: "error" | "success" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        setLevels(data.availableLevels || []);
        setRegions(data.availableRegions || []);
        setFaseConfig(data.faseConfig || {});
      }
    } catch {
      showToast("Gagal memuat data", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    queueMicrotask(() => { fetchData(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Lokasi Belajar Handlers ───────────────────────────────────────────────
  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegionName.trim()) return;
    setSubmitting(true);
    try {
      const newList = [...regions, newRegionName.trim()];
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableRegions: Array.from(new Set(newList)) }),
      });
      if (res.ok) {
        showToast("Lokasi Belajar baru ditambahkan!");
        setIsRegionModalOpen(false);
        setNewRegionName("");
        fetchData();
      }
    } catch {
      showToast("Gagal menambah lokasi belajar", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteRegion = async (name: string) => {
    const isConfirmed = await showConfirm(`Hapus lokasi belajar ${name}?`, "Hapus Lokasi Belajar");
    if (!isConfirmed) return;
    try {
      const newList = regions.filter((r) => r !== name);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableRegions: newList }),
      });
      if (res.ok) {
        showToast("Lokasi Belajar dihapus");
        fetchData();
      }
    } catch {
      showToast("Gagal menghapus lokasi belajar", "error");
    }
  };

  const handleEditRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRegionModal.newName.trim()) return;
    setSubmitting(true);
    try {
      const newList = regions.map((r) =>
        r === editRegionModal.oldName ? editRegionModal.newName.trim() : r
      );
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableRegions: newList }),
      });
      if (res.ok) {
        showToast("Lokasi Belajar berhasil diubah!");
        setEditRegionModal({ isOpen: false, oldName: "", newName: "" });
        fetchData();
      }
    } catch {
      showToast("Gagal mengubah lokasi belajar", "error");
    } finally {
      setSubmitting(false);
    }
  };

  // ── Fase Handlers ─────────────────────────────────────────────────────────
  const saveFaseConfig = async (next: Record<string, unknown>) => {
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ faseConfig: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || "Gagal menyimpan fase");
    }
  };

  const handleAddFase = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newFaseName.trim().toUpperCase();
    if (!name) return;
    if (faseConfig[name]) {
      showToast(`Fase "${name}" sudah ada`, "error");
      return;
    }
    setSubmitting(true);
    try {
      const next = { ...faseConfig, [name]: buildFaseSkeleton(name) };
      await saveFaseConfig(next);
      showToast("Fase baru ditambahkan! Lengkapi komponennya di Konfigurasi Raport.");
      setIsFaseModalOpen(false);
      setNewFaseName("");
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menambah fase", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditFase = async (e: React.FormEvent) => {
    e.preventDefault();
    const oldName = editFaseModal.oldName;
    const newName = editFaseModal.newName.trim().toUpperCase();
    if (!newName || newName === oldName) {
      setEditFaseModal({ ...editFaseModal, isOpen: false });
      return;
    }
    if (faseConfig[newName]) {
      showToast(`Fase "${newName}" sudah ada`, "error");
      return;
    }
    setSubmitting(true);
    try {
      // Rename: copy entry ke key baru, hapus key lama. Urutan key dijaga.
      const next: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(faseConfig)) {
        if (k === oldName) {
          next[newName] = v;
        } else {
          next[k] = v;
        }
      }
      await saveFaseConfig(next);
      showToast("Fase berhasil diubah");
      setEditFaseModal({ isOpen: false, oldName: "", newName: "" });
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal mengubah fase", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteFase = async (name: string) => {
    const isConfirmed = await showConfirm(
      `Hapus fase ${name}? Semua konfigurasi komponen UAS untuk fase ini juga ikut terhapus dan tidak bisa di-undo.`,
      "Hapus Fase"
    );
    if (!isConfirmed) return;
    setSubmitting(true);
    try {
      const next: Record<string, unknown> = { ...faseConfig };
      delete next[name];
      if (Object.keys(next).length === 0) {
        showToast("Tidak boleh menghapus fase terakhir", "error");
        setSubmitting(false);
        return;
      }
      await saveFaseConfig(next);
      showToast("Fase dihapus");
      fetchData();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Gagal menghapus fase", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat Lokasi Belajar & Fase...</p>
      </div>
    );
  }

  const filteredRegions = regions.filter((region) =>
    region.toLowerCase().includes(regionSearch.trim().toLowerCase())
  );
  const filteredLevels = levels.filter((level) =>
    level.toLowerCase().includes(faseSearch.trim().toLowerCase())
  );

  return (
    <div>
      <div className={styles.masterGrid}>
        {/* ── Section Lokasi Belajar ── */}
        <section className={styles.masterCard}>
          <div className={styles.masterCardHeader}>
            <div>
              <p className={styles.masterEyebrow}>Lokasi Belajar</p>
              <h2 className={styles.masterTitle}>Daftar Lokasi Belajar <span className={styles.masterCount}>{regions.length}</span></h2>
            </div>
            <button
              className={styles.addBtn}
              onClick={() => setIsRegionModalOpen(true)}
            >
              + Tambah Lokasi Belajar
            </button>
          </div>
          <input
            type="search"
            className={styles.masterSearch}
            placeholder="Cari lokasi belajar..."
            value={regionSearch}
            onChange={(event) => setRegionSearch(event.target.value)}
          />
          <div className={styles.masterList}>
            {filteredRegions.map((r) => (
              <div key={r} className={styles.masterListRow}>
                <div className={styles.semName}>{r}</div>
                <div className={styles.actions}>
                  <button
                    className={styles.editBtn}
                    onClick={() =>
                      setEditRegionModal({ isOpen: true, oldName: r, newName: r })
                    }
                    title="Edit nama"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteRegion(r)}
                    title="Hapus"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {filteredRegions.length === 0 && (
              <div className={styles.masterEmpty}>{regions.length === 0 ? "Belum ada lokasi belajar." : "Lokasi belajar tidak ditemukan."}</div>
            )}
          </div>
        </section>

        {/* ── Section Fase ── */}
        <section className={styles.masterCard}>
          <div className={styles.masterCardHeader}>
            <div>
              <p className={styles.masterEyebrow}>Fase</p>
              <h2 className={styles.masterTitle}>Daftar Jenjang (Fase) <span className={styles.masterCount}>{levels.length}</span></h2>
            </div>
            <button
              className={styles.addBtn}
              onClick={() => setIsFaseModalOpen(true)}
            >
              + Tambah Fase
            </button>
          </div>

          <input
            type="search"
            className={styles.masterSearch}
            placeholder="Cari fase..."
            value={faseSearch}
            onChange={(event) => setFaseSearch(event.target.value)}
          />

          <div className={styles.masterList}>
            {filteredLevels.map((l) => (
              <div key={l} className={styles.masterListRow}>
                <div className={styles.semName}>{l}</div>
                <div className={styles.actions}>
                  <button
                    className={styles.editBtn}
                    onClick={() =>
                      setEditFaseModal({ isOpen: true, oldName: l, newName: l })
                    }
                    title="Rename fase"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDeleteFase(l)}
                    title="Hapus fase"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
            {filteredLevels.length === 0 && (
              <div className={styles.masterEmpty}>
                {levels.length === 0 ? <>Belum ada fase. Klik <strong>+ Tambah Fase</strong> untuk memulai.</> : "Fase tidak ditemukan."}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* ── Lokasi Belajar Modals ── */}
      {(isRegionModalOpen || editRegionModal.isOpen) && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>
              {isRegionModalOpen ? "Tambah Lokasi Belajar" : "Edit Lokasi Belajar"}
            </h2>
            <form onSubmit={isRegionModalOpen ? handleAddRegion : handleEditRegion}>
              <input
                autoFocus
                className={styles.inputField}
                placeholder="Contoh: Offline Depok"
                value={isRegionModalOpen ? newRegionName : editRegionModal.newName}
                onChange={(e) =>
                  isRegionModalOpen
                    ? setNewRegionName(e.target.value)
                    : setEditRegionModal({ ...editRegionModal, newName: e.target.value })
                }
                required
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancel}
                  onClick={() => {
                    setIsRegionModalOpen(false);
                    setEditRegionModal({ ...editRegionModal, isOpen: false });
                  }}
                >
                  Batal
                </button>
                <button type="submit" className={styles.modalSubmit} disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Fase Modals ── */}
      {(isFaseModalOpen || editFaseModal.isOpen) && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>
              {isFaseModalOpen ? "Tambah Fase" : "Edit Nama Fase"}
            </h2>
            <p className={styles.modalDesc}>
              {isFaseModalOpen
                ? "Setelah disimpan, lengkapi komponen UAS dan KBM-nya di Konfigurasi Raport."
                : "Mengubah nama akan memperbarui referensi di faseConfig. Modul OFFLINE yang sudah terhubung ke fase lama tetap perlu dipindahkan manual."}
            </p>
            <form onSubmit={isFaseModalOpen ? handleAddFase : handleEditFase}>
              <input
                autoFocus
                className={styles.inputField}
                placeholder="Contoh: FASE F"
                value={isFaseModalOpen ? newFaseName : editFaseModal.newName}
                onChange={(e) =>
                  isFaseModalOpen
                    ? setNewFaseName(e.target.value.toUpperCase())
                    : setEditFaseModal({
                        ...editFaseModal,
                        newName: e.target.value.toUpperCase(),
                      })
                }
                required
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancel}
                  onClick={() => {
                    setIsFaseModalOpen(false);
                    setEditFaseModal({ ...editFaseModal, isOpen: false });
                  }}
                >
                  Batal
                </button>
                <button type="submit" className={styles.modalSubmit} disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div
          className={styles.toast}
          style={toast.type === "error" ? { background: "#7f1d1d" } : undefined}
        >
          <span>{toast.type === "error" ? "⚠" : "✨"}</span> {toast.msg}
        </div>
      )}
    </div>
  );
}
