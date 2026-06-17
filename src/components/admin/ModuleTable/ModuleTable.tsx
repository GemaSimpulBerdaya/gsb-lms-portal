"use client";

import styles from "./ModuleTable.module.css";
import { useState, useEffect } from "react";
import { ExternalLink } from "lucide-react";
import DeleteConfirmModal from "@/components/admin/DeleteConfirmModal/DeleteConfirmModal";
import { useMounted } from "@/hooks/useMounted";
import AdminPagination from "@/components/admin/ui/AdminPagination";

export interface ModuleItem {
  _id: string;
  title: string;
  slug: string;
  programType: "SNBT" | "OFFLINE";
  learningLocation?: string;
  fase?: string;
  subject?: string;
  week?: number;
  month?: number | null;
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

const MONTH_NAMES = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function monthLabel(monthNum: number | null | undefined): string | null {
  if (typeof monthNum !== "number" || monthNum < 1 || monthNum > 12) return null;
  return MONTH_NAMES[monthNum - 1];
}

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.slice(0, 24) + (u.pathname.length > 24 ? "…" : "") : "";
    return u.host + path;
  } catch {
    return url.length > 38 ? url.slice(0, 38) + "…" : url;
  }
}

/**
 * Label mata pelajaran dengan prefix waktu (bulan / pekan).
 * Prioritas: `month` (sistem baru, nama bulan) > `week` legacy (Pekan X).
 */
function formatSubjectWithWeek(module: ModuleItem): string {
  const subject = module.subject || "-";
  const mLabel = monthLabel(module.month);
  if (mLabel) return `${mLabel}: ${subject}`;
  if (module.week != null) {
    const sep = module.programType === "SNBT" ? " - " : ": ";
    return `Pekan ${module.week}${sep}${subject}`;
  }
  return subject;
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
              <th>FASE</th>
              <th>MATA PELAJARAN</th>
              <th>BULAN</th>
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
                  <span className={styles.subBadge}>
                    {m.fase || "-"}
                  </span>
                </td>
                <td>
                  <span className={styles.subBadge}>
                    {formatSubjectWithWeek(m)}
                  </span>
                </td>
                <td>
                  <div className={styles.orderInfo}>
                    {monthLabel(m.month) ??
                      (m.week != null ? `Pekan ${m.week}` : "-")}
                  </div>
                </td>
                <td>
                  {m.fileUrl ? (
                    <a
                      href={m.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.fileLink}
                      title={m.fileUrl}
                    >
                      <ExternalLink size={14} />
                      <span className={styles.urlPreview}>{shortUrl(m.fileUrl)}</span>
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
                <td colSpan={8}>
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
