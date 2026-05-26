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
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: "",
    name: ""
  });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

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
        <h3 className={styles.tableTitle}>Manajemen Anak Didik</h3>
        <button className={styles.addBtn} onClick={onAdd}>
          <span>+</span> Tambah Siswa
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ANAK DIDIK</th>
              <th>FASE</th>
              <th>WILAYAH</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
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
                      title="Lihat Rekap Nilai & Raport"
                    >
                      📄 Raport
                    </button>
                    <button className={styles.editBtn} onClick={() => onEdit(s)}>Edit</button>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setDeleteModal({ isOpen: true, id: s._id, name: s.name })}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {students.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                  Belum ada data anak didik.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DeleteConfirmModal 
        isOpen={deleteModal.isOpen}
        title="Hapus Data Anak Didik?"
        message={`Apakah Anda yakin ingin menghapus data "${deleteModal.name}"? Tindakan ini tidak dapat dibatalkan.`}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
