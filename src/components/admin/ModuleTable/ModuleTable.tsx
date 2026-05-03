"use client";

import styles from "./ModuleTable.module.css";
import { useState, useEffect } from "react";
import DeleteConfirmModal from "@/components/admin/DeleteConfirmModal/DeleteConfirmModal";

export interface ModuleItem {
  _id: string;
  title: string;
  slug: string;
  category: "SNBT" | "OFFLINE";
  subCategory?: string;
  week?: number;
  order: number;
  semester?: string;
  hasQuiz?: boolean;
}

interface ModuleTableProps {
  modules: ModuleItem[];
  onDelete: (id: string) => void;
  onEdit: (mod: ModuleItem) => void;
  onAdd: () => void;
  onQuiz: (mod: ModuleItem) => void;
}

export default function ModuleTable({ modules, onDelete, onEdit, onAdd, onQuiz }: ModuleTableProps) {
  const [mounted, setMounted] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: "",
    name: ""
  });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const handleConfirmDelete = () => {
    onDelete(deleteModal.id);
    setDeleteModal({ ...deleteModal, isOpen: false });
  };

  return (
    <div className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Daftar Modul Pembelajaran</h3>
        <button className={styles.addBtn} onClick={onAdd}>
          <span>+</span> Tambah Modul
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>JUDUL MODUL</th>
              <th>KATEGORI</th>
              <th>SUB-KATEGORI</th>
              <th>MINGGU/ORDER</th>
              <th>MODUL</th>
              <th>KUIS</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {modules.map((m, i) => (
              <tr
                key={m._id}
                className={mounted ? styles.rowAnim : styles.rowHidden}
                style={{ animationDelay: `${0.05 * (i + 1)}s` }}
              >
                <td>
                  <div className={styles.moduleCell}>
                    <div className={styles.iconBox}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                      </svg>
                    </div>
                    <div>
                      <div className={styles.moduleTitle}>{m.title}</div>
                      <div className={styles.moduleSlug}>{m.slug}</div>
                    </div>
                  </div>
                </td>
                <td>
                   <span className={`${styles.badge} ${m.category === 'SNBT' ? styles.snbt : styles.offline}`}>
                     {m.category}
                   </span>
                </td>
                <td>
                  <span className={styles.subBadge}>{m.subCategory || "Umum"}</span>
                </td>
                <td>
                  <div className={styles.orderInfo}>
                    {m.category?.toUpperCase() === 'OFFLINE' ? `Pekan ${m.week}` : `Order ${m.order}`}
                  </div>
                </td>
                <td>
                  {(m as any).fileUrl ? (
                    <a 
                      href={(m as any).fileUrl} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className={styles.fileLink}
                      title="Lihat File"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="12" y1="18" x2="12" y2="12" />
                        <polyline points="9 15 12 12 15 15" />
                      </svg>
                    </a>
                  ) : (
                    <span className={styles.noFile}>-</span>
                  )}
                </td>
                <td>
                  {m.category === "SNBT" ? (
                    <button 
                      className={m.hasQuiz ? styles.quizBtnEdit : styles.quizBtnAdd}
                      onClick={() => onQuiz(m)}
                    >
                      {m.hasQuiz ? "📝 Edit Kuis" : "✨ Buat Kuis"}
                    </button>
                  ) : (
                    <span className={styles.noFile}>-</span>
                  )}
                </td>
                <td>
                  <div className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => onEdit(m)}>Edit</button>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => setDeleteModal({ isOpen: true, id: m._id, name: m.title })}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {modules.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📦</div>
                    <p>Tidak ada modul yang ditemukan.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DeleteConfirmModal 
        isOpen={deleteModal.isOpen}
        title="Hapus Modul?"
        message={`Apakah Anda yakin ingin menghapus modul "${deleteModal.name}"? Siswa tidak akan bisa mengakses materi ini lagi.`}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
