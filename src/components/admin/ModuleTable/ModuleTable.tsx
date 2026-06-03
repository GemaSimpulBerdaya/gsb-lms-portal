"use client";

import styles from "./ModuleTable.module.css";
import { useState, useEffect } from "react";
import DeleteConfirmModal from "@/components/admin/DeleteConfirmModal/DeleteConfirmModal";
import { useMounted } from "@/hooks/useMounted";
import AdminPagination from "@/components/admin/ui/AdminPagination";

export interface ModuleItem {
  _id: string;
  title: string;
  slug: string;
  programType: "SNBT" | "OFFLINE";
  fase?: string;
  subject?: string;
  week?: number;
  order: number;
  semester?: string;
  hasQuiz?: boolean;
  description?: string;
  fileUrl?: string;
}

interface ModuleTableProps {
  modules: ModuleItem[];
  onDelete: (id: string) => void;
  onEdit: (mod: ModuleItem) => void;
  onAdd: () => void;
  onQuiz: (mod: ModuleItem) => void;
}

export default function ModuleTable({ modules, onDelete, onEdit, onAdd, onQuiz }: ModuleTableProps) {
  const mounted = useMounted();
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: "",
    name: ""
  });
  
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [modules]);

  const paginatedModules = modules.slice((page - 1) * itemsPerPage, page * itemsPerPage);

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
              <th>PROGRAM</th>
              <th>FASE</th>
              <th>MATA PELAJARAN</th>
              <th>PEKAN</th>
              <th>MODUL</th>
              <th>KUIS</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {paginatedModules.map((m) => (
              <tr
                key={`${page}-${m._id}`}
                className={mounted ? "admin-page-row" : styles.rowHidden}
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
                   <span className={`${styles.badge} ${m.programType === 'SNBT' ? styles.snbt : styles.offline}`}>
                     {m.programType === 'SNBT' ? 'Kelas SNBT' : 'Kelas Reguler'}
                   </span>
                </td>
                <td>
                  <span className={styles.subBadge}>
                    {m.fase || "-"}
                  </span>
                </td>
                <td>
                  <span className={styles.subBadge}>
                    {m.subject || "-"}
                  </span>
                </td>
                <td>
                  <div className={styles.orderInfo}>
                    {m.programType?.toUpperCase() === 'OFFLINE' ? `Pekan ${m.week}` : `-`}
                  </div>
                </td>
                <td>
                  {m.fileUrl ? (
                    <a 
                      href={m.fileUrl} 
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
                  {m.programType === "SNBT" ? (
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
                      Hapus
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

      <AdminPagination
        page={page}
        totalItems={modules.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
      />

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
