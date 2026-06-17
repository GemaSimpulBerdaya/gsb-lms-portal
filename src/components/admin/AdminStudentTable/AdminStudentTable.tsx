"use client";

import styles from "./AdminStudentTable.module.css";
import { useState, useEffect } from "react";
import AdminPagination from "@/components/admin/ui/AdminPagination";

export interface Student {
  _id: string;
  name: string;
  fase: string;
  region: string;
  parentName?: string;
  studentCode?: string;
  kodeKelas?: string;
  pic?: string;
  // Metadata & Profile
  gender?: string;
  birthPlace?: string;
  birthDate?: string;
  schoolOrigin?: string;
  phone?: string;
  parentPhone?: string;
  email?: string;
  address?: string;
  program?: string;
  profil?: Record<string, unknown>;
}

interface AdminStudentTableProps {
  students: Student[];
}

export default function AdminStudentTable({ students }: AdminStudentTableProps) {
  const [mounted, setMounted] = useState(false);
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [students]);

  const paginatedStudents = students.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getCategoryClass = (category: string) => {
    const catLower = (category || "").toLowerCase();
    if (catLower.includes('tunas') || catLower.includes('pucuk')) return styles.catTunasPucuk;
    if (catLower.includes('a')) return styles.catA;
    if (catLower.includes('b')) return styles.catB;
    if (catLower.includes('c')) return styles.catC;
    if (catLower.includes('d')) return styles.catD;
    if (catLower.includes('e')) return styles.catE;
    return styles.catLainnya;
  };

  return (
    <div className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>NAMA SISWA</th>
              <th>NO. INDUK</th>
              <th>FASE</th>
              <th>LOKASI BELAJAR</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {paginatedStudents.map((s) => (
              <tr
                key={`${page}-${s._id}`}
                className={mounted ? "admin-page-row" : styles.rowHidden}
              >
                <td>
                  <div className={styles.studentInfo}>
                    <span className={styles.avatar}>
                      {(s.name?.trim()?.[0] || "?").toUpperCase()}
                    </span>
                    <span className={styles.studentName}>{s.name}</span>
                  </div>
                </td>
                <td className={styles.induk}>
                  {s.studentCode || "-"}
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
                      onClick={() => window.location.href = `/admin/student-raports?student=${s._id}`}
                      title="Preview dan download rapor siswa"
                    >
                      📄 Rapor
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {paginatedStudents.length === 0 && (
              <tr>
                <td colSpan={5} className={styles.emptyState}>
                  {students.length === 0 ? "Belum ada data siswa" : "Data siswa pada halaman ini tidak ditemukan"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {students.length > itemsPerPage && (
        <AdminPagination
          page={page}
          onPageChange={setPage}
          totalItems={students.length}
          itemsPerPage={itemsPerPage}
        />
      )}
    </div>
  );
}
