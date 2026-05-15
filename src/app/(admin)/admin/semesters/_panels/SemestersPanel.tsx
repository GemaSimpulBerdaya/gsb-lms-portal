"use client";

import { useEffect, useState } from "react";
import styles from "../semesters.module.css";

interface SemesterData {
  id: string;
  name: string;
  schedules: number;
  reports: number;
  modules: number;
  isActive: boolean;
  isClosed?: boolean;
  successRate: number;
}

/**
 * Panel CRUD daftar semester. Sebelumnya isi /admin/semesters/page.tsx —
 * sekarang dibungkus tab "Semester" di halaman yang sama.
 */
export default function SemestersPanel() {
  const [semesters, setSemesters] = useState<SemesterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newSemesterName, setNewSemesterName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [editModal, setEditModal] = useState<{
    isOpen: boolean;
    oldName: string;
    newName: string;
  }>({ isOpen: false, oldName: "", newName: "" });

  const [recapModal, setRecapModal] = useState<{
    isOpen: boolean;
    data: SemesterData | null;
  }>({ isOpen: false, data: null });

  const fetchSemesters = async () => {
    try {
      const res = await fetch("/api/admin/semesters");
      if (res.ok) {
        const data = await res.json();
        setSemesters(data.semesters);
      }
    } catch {
      showToast("Gagal memuat data semester");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSetActive = async (id: string) => {
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeSemester: id }),
      });
      if (res.ok) {
        showToast(`Semester ${id} sekarang aktif!`);
        fetchSemesters();
      }
    } catch {
      showToast("Gagal memperbarui semester aktif");
    }
  };

  const handleAddSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemesterName.trim()) return;

    setSubmitting(true);
    try {
      const currentList = semesters.map((s) => s.name);
      if (currentList.includes(newSemesterName)) {
        showToast("Semester sudah ada");
        setSubmitting(false);
        return;
      }

      const newList = [...currentList, newSemesterName];
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableSemesters: newList }),
      });

      if (res.ok) {
        showToast("Semester baru ditambahkan!");
        setIsModalOpen(false);
        setNewSemesterName("");
        fetchSemesters();
      }
    } catch {
      showToast("Gagal menambah semester");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSemester = async (id: string) => {
    if (semesters.find((s) => s.id === id)?.isActive) {
      showToast("Tidak bisa menghapus semester aktif");
      return;
    }

    if (
      !confirm(
        `Hapus semester ${id}? Semua data (jadwal/laporan) tidak akan terhapus tapi tidak akan muncul di filter.`
      )
    )
      return;

    try {
      const newList = semesters.filter((s) => s.id !== id).map((s) => s.name);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableSemesters: newList }),
      });

      if (res.ok) {
        showToast("Semester dihapus");
        fetchSemesters();
      }
    } catch {
      showToast("Gagal menghapus semester");
    }
  };

  const isPastSemester = (name: string) => {
    const match = name.match(/^(\d{4})/);
    if (!match) return false;
    const year = parseInt(match[1]);
    const currentYear = new Date().getFullYear();
    return year < currentYear;
  };

  const handleEditSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal.newName.trim() || editModal.newName === editModal.oldName) {
      setEditModal({ ...editModal, isOpen: false });
      return;
    }

    setSubmitting(true);
    try {
      const newList = semesters.map((s) =>
        s.name === editModal.oldName ? editModal.newName : s.name
      );

      const activeSem = semesters.find((s) => s.isActive)?.name;
      const body: Record<string, unknown> = { availableSemesters: newList };
      if (activeSem === editModal.oldName) {
        body.activeSemester = editModal.newName;
      }

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        showToast("Semester berhasil diubah!");
        setEditModal({ isOpen: false, oldName: "", newName: "" });
        fetchSemesters();
      }
    } catch {
      showToast("Gagal mengubah semester");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSemester = async (sem: SemesterData) => {
    if (
      !confirm(
        `Selesaikan semester ${sem.name}? Setelah diselesaikan, semester ini akan TERKUNCI PERMANEN dan tidak bisa diaktifkan kembali sebagai semester berjalan.`
      )
    )
      return;

    setSubmitting(true);
    try {
      const closedList = semesters.filter((s) => s.isClosed).map((s) => s.name);
      const newList = [...closedList, sem.name];

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closedSemesters: newList }),
      });

      if (res.ok) {
        showToast(`Semester ${sem.name} telah diselesaikan!`);
        fetchSemesters();
        setRecapModal({ isOpen: true, data: sem });
      }
    } catch {
      showToast("Gagal menyelesaikan semester");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Memuat Manajemen Semester...</div>;
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#2d3436" }}>
          Daftar Semester
        </h2>
        <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Tambah Semester
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Nama Semester</th>
              <th>Jadwal Aktif</th>
              <th>Laporan Masuk</th>
              <th>Modul Tersedia</th>
              <th style={{ textAlign: "right" }}>Aksi Manajemen</th>
            </tr>
          </thead>
          <tbody>
            {semesters.map((sem) => {
              const isPast = isPastSemester(sem.name);
              return (
                <tr
                  key={sem.id}
                  className={`
                    ${sem.isActive ? styles.rowActive : ""}
                    ${sem.isClosed ? styles.rowClosed : ""}
                    ${isPast && !sem.isActive && !sem.isClosed ? styles.rowPast : ""}
                  `}
                >
                  <td>
                    <div className={styles.semName}>
                      {sem.name}
                      {sem.isActive && <span className={styles.activeBadge}>Active</span>}
                      {sem.isClosed && <span className={styles.closedBadge}>Selesai</span>}
                      {isPast && !sem.isActive && !sem.isClosed && (
                        <span className={styles.pastBadge}>Lampau</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={styles.statValue}>{sem.schedules}</span>
                  </td>
                  <td>
                    <span className={styles.statValue}>{sem.reports}</span>
                  </td>
                  <td>
                    <span className={styles.statValue}>{sem.modules}</span>
                  </td>
                  <td>
                    <div className={styles.actions}>
                      {!sem.isActive && !sem.isClosed && (
                        <button
                          className={styles.setActiveBtn}
                          onClick={() => handleSetActive(sem.id)}
                        >
                          Set Active
                        </button>
                      )}

                      {sem.isActive && !sem.isClosed && (
                        <button
                          className={styles.finishBtn}
                          onClick={() => handleCloseSemester(sem)}
                          disabled={submitting}
                        >
                          Selesaikan Semester
                        </button>
                      )}

                      {sem.isClosed && (
                        <button
                          className={styles.recapBtn}
                          onClick={() => setRecapModal({ isOpen: true, data: sem })}
                        >
                          Lihat Rekap
                        </button>
                      )}

                      {!isPast && !sem.isClosed && (
                        <button
                          className={styles.editBtn}
                          onClick={() =>
                            setEditModal({ isOpen: true, oldName: sem.name, newName: sem.name })
                          }
                          title="Edit Nama"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      )}

                      {!sem.isActive && !isPast && !sem.isClosed && (
                        <button
                          className={styles.deleteBtn}
                          onClick={() => handleDeleteSemester(sem.id)}
                          title="Hapus"
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      )}

                      {(isPast || sem.isClosed) && !sem.isActive && (
                        <div title="Data Terkunci" style={{ opacity: 0.5, padding: "8px" }}>
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {recapModal.isOpen && recapModal.data && (
        <div className={styles.overlay}>
          <div className={styles.modal} style={{ maxWidth: "600px" }}>
            <h2 className={styles.modalTitle}>Rekap Akhir: {recapModal.data.name}</h2>
            <p className={styles.modalDesc}>
              Berikut adalah ringkasan performa LMS selama satu semester ini.
            </p>

            <div className={styles.recapGrid}>
              <div className={styles.recapCard}>
                <span className={styles.recapNum}>{recapModal.data.schedules}</span>
                <span className={styles.recapLabel}>Total Jadwal</span>
              </div>
              <div className={styles.recapCard}>
                <span className={styles.recapNum}>{recapModal.data.reports}</span>
                <span className={styles.recapLabel}>Laporan Selesai</span>
              </div>
              <div className={styles.recapCard}>
                <span className={styles.recapNum}>{recapModal.data.modules}</span>
                <span className={styles.recapLabel}>Modul Terpakai</span>
              </div>
              <div className={styles.recapCard}>
                <span className={styles.recapNum}>{recapModal.data.successRate}%</span>
                <span className={styles.recapLabel}>Laju Pelaporan</span>
              </div>
            </div>

            <div className={styles.modalActions} style={{ marginTop: "32px" }}>
              <button
                className={styles.modalSubmit}
                onClick={() => setRecapModal({ isOpen: false, data: null })}
              >
                Tutup Rekap
              </button>
            </div>
          </div>
        </div>
      )}

      {editModal.isOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Edit Nama Semester</h2>
            <p className={styles.modalDesc}>Mengubah nama tidak akan menghapus data di dalamnya.</p>

            <form onSubmit={handleEditSemester}>
              <input
                autoFocus
                className={styles.inputField}
                value={editModal.newName}
                onChange={(e) => setEditModal({ ...editModal, newName: e.target.value })}
                required
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancel}
                  onClick={() => setEditModal({ ...editModal, isOpen: false })}
                >
                  Batal
                </button>
                <button type="submit" className={styles.modalSubmit} disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.overlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalTitle}>Tambah Semester Baru</h2>
            <p className={styles.modalDesc}>
              Gunakan format tahun (misal: 2025-1 atau 2025-Ganjil).
            </p>

            <form onSubmit={handleAddSemester}>
              <input
                autoFocus
                className={styles.inputField}
                placeholder="Contoh: 2026-Genap"
                value={newSemesterName}
                onChange={(e) => setNewSemesterName(e.target.value)}
                required
              />
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={styles.modalCancel}
                  onClick={() => setIsModalOpen(false)}
                >
                  Batal
                </button>
                <button type="submit" className={styles.modalSubmit} disabled={submitting}>
                  {submitting ? "Menyimpan..." : "Simpan Semester"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div className={styles.toast}>
          <span>✨</span> {toast}
        </div>
      )}
    </div>
  );
}
