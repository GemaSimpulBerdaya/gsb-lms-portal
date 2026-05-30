"use client";

import styles from "./AdminStudentTable.module.css";
import { useState, useEffect } from "react";
import DeleteConfirmModal from "../DeleteConfirmModal/DeleteConfirmModal";

export interface Student {
  _id: string;
  name: string;
  fase: string;
  region?: string;
  parentName?: string;
  // Data Excel
  studentCode?: string;
  kodeKelas?: string;
  pic?: string;
  // Data raport
  gender?: "Laki-laki" | "Perempuan";
  birthPlace?: string;
  birthDate?: string;
  schoolOrigin?: string;
  phone?: string;
  address?: string;
}

interface AdminStudentTableProps {
  students: Student[];
  onDelete: (id: string) => void;
  onEdit: (student: Student) => void;
  onAdd: () => void;
}

export default function AdminStudentTable({ students, onDelete, onEdit, onAdd }: AdminStudentTableProps) {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: "",
    name: ""
  });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Reset page if students list changes length significantly or filters change
  useEffect(() => {
    setPage(1);
  }, [students.length]);

  const totalPages = Math.ceil(students.length / itemsPerPage);
  const currentStudents = students.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getCategoryClass = (cat: string) => {
    switch (cat) {
      case "FASE A":
      case "FASE B":
      case "FASE C":
      case "SD": return styles.catSD;
      case "FASE D":
      case "SMP": return styles.catSMP;
      case "FASE PUCUK":
      case "TK": return styles.catTK;
      case "FASE E":
      case "SNBT": return styles.catSMP; // Use SMP color for now or add more
      case "DISABILITAS": return styles.catDIS;
      default: return "";
    }
  };

  const getRandomColor = (str: string) => {
    const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleConfirmDelete = () => {
    onDelete(deleteModal.id);
    setDeleteModal({ ...deleteModal, isOpen: false });
  };

  return (
    <div className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Data Siswa</h3>
        <button className={styles.addBtn} onClick={onAdd}>
          <span>+</span> Tambah Siswa
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>SISWA</th>
              <th>FASE</th>
              <th>WILAYAH</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {currentStudents.map((s, i) => (
              <tr
                key={s._id}
                className={mounted ? styles.rowAnim : styles.rowHidden}
                style={{ animationDelay: `${0.03 * (i + 1)}s` }}
              >
                <td>
                  <div className={styles.studentCell}>
                    <div
                      className={styles.avatar}
                      style={{ background: getRandomColor(s.name) }}
                    >
                      {s.name.charAt(0)}
                    </div>
                    <div>
                      <div className={styles.studentName}>{s.name}</div>
                      {s.studentCode && (
                        <div className={styles.parentName}>{s.studentCode}</div>
                      )}
                    </div>
                  </div>
                </td>
                <td>
                   <span className={`${styles.categoryCell} ${getCategoryClass(s.fase)}`}>
                     {s.fase}
                   </span>
                </td>
                <td className={styles.regionCell}>{s.region || "-"}</td>
                <td>
                  <div className={styles.actions}>
                    <button
                      className={styles.raportBtn}
                      onClick={() => window.location.href = `/admin/grades?student=${s._id}`}
                      title="Lihat Rekap Nilai & Rapor"
                    >
                      📄 Rapor
                    </button>
                    <button className={styles.editBtn} onClick={() => onEdit(s)}>Edit</button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setDeleteModal({ isOpen: true, id: s._id, name: s.name })}
                    >
                      Hapus
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                  Belum ada data siswa.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(() => {
        const pages = [];
        if (totalPages <= 7) {
          for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
          if (page <= 4) {
            pages.push(1, 2, 3, 4, 5, 'jump-next', totalPages);
          } else if (page >= totalPages - 3) {
            pages.push(1, 'jump-prev', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
          } else {
            pages.push(1, 'jump-prev', page - 1, page, page + 1, 'jump-next', totalPages);
          }
        }
        
        return (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0px", padding: "16px 24px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "0 0 12px 12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#64748b" }}>
              Menampilkan data <strong style={{ color: "#0f172a" }}>{(page - 1) * itemsPerPage + 1}</strong> - <strong style={{ color: "#0f172a" }}>{Math.min(page * itemsPerPage, students.length)}</strong> dari <strong style={{ color: "#0f172a" }}>{students.length}</strong>
            </span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: "6px 12px", fontSize: "13px", fontWeight: "600", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 1 ? "#f1f5f9" : "#fff", color: page === 1 ? "#94a3b8" : "#334155", cursor: page === 1 ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              >
                ‹ Prev
              </button>
              
              {pages.map((p, idx) => {
                if (p === 'jump-prev' || p === 'jump-next') {
                  return (
                    <span
                      key={idx}
                      style={{ padding: "6px 4px", fontSize: "13px", color: "#94a3b8", letterSpacing: "2px" }}
                    >
                      •••
                    </span>
                  );
                }
                return (
                  <button
                    key={idx}
                    onClick={() => typeof p === 'number' && setPage(p)}
                    style={{ 
                      padding: "6px 12px", minWidth: "32px", fontSize: "13px", 
                      fontWeight: p === page ? "600" : "500", 
                      borderRadius: "6px", 
                      border: "1px solid", 
                      borderColor: p === page ? "#F58220" : "#e2e8f0", 
                      background: p === page ? "#F58220" : "#fff", 
                      color: p === page ? "#fff" : "#334155", 
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: "6px 12px", fontSize: "13px", fontWeight: "600", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === totalPages ? "#f1f5f9" : "#fff", color: page === totalPages ? "#94a3b8" : "#334155", cursor: page === totalPages ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              >
                Next ›
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", paddingLeft: "12px", borderLeft: "1px solid #cbd5e1" }}>
                <span style={{ fontSize: "13px", color: "#64748b" }}>Ke hal:</span>
                <select 
                  value={page} 
                  onChange={(e) => setPage(Number(e.target.value))}
                  style={{ padding: "4px 24px 4px 8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", appearance: "auto" }}
                >
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })()}

      <DeleteConfirmModal 
        isOpen={deleteModal.isOpen}
        title="Hapus Data Siswa?"
        message={`Apakah Anda yakin ingin menghapus data "${deleteModal.name}"? Tindakan ini tidak dapat dibatalkan.`}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
