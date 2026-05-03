"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import AdminStudentTable, { Student } from "@/components/admin/AdminStudentTable/AdminStudentTable";
import StudentModal from "@/components/admin/StudentModal/StudentModal";
import DeleteConfirmModal from "@/components/admin/DeleteConfirmModal/DeleteConfirmModal";
import Toast from "@/components/Toast/Toast";
import styles from "./students.module.css";
import * as XLSX from "xlsx";

export default function AdminStudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("ALL");
  const [filterRegion, setFilterRegion] = useState("ALL");

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch("/api/admin/students");
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data anak didik", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
      if (res.ok) {
        setStudents(students.filter(s => s._id !== id));
        showToast("Siswa berhasil dihapus");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menghapus data", "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan koneksi", "error");
    }
  };

  const handleEdit = (student: Student) => {
    setEditingStudent(student);
    setIsModalOpen(true);
  };

  const handleAdd = () => {
    setEditingStudent(null);
    setIsModalOpen(true);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);

        const mappedData = data.map((row: any) => ({
          name: row["Nama"] || row["name"],
          category: (row["Kategori"] || row["category"] || "SD").toUpperCase(),
          region: row["Wilayah"] || row["region"],
          parentName: row["Orang Tua"] || row["parentName"]
        }));

        const res = await fetch("/api/admin/students/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: mappedData })
        });

        if (res.ok) {
          const result = await res.json();
          showToast(result.message);
          fetchStudents();
        } else {
          const err = await res.json();
          showToast(err.error || "Gagal impor data", "error");
        }
      } catch (err) {
        showToast("Gagal membaca file Excel", "error");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  // Unique Regions for Filter
  const regions = useMemo(() => {
    const r = students.map(s => s.region).filter((reg): reg is string => Boolean(reg));
    return Array.from(new Set(r));
  }, [students]);

  // Filtered Data
  const filteredStudents = useMemo(() => {
    return students.filter(s => {
      const matchSearch = s.name.toLowerCase().includes(search.toLowerCase());
      const matchCat = filterCategory === "ALL" || s.category === filterCategory;
      const matchReg = filterRegion === "ALL" || s.region === filterRegion;
      return matchSearch && matchCat && matchReg;
    });
  }, [students, search, filterCategory, filterRegion]);

  const [bulkDeleteModal, setBulkDeleteModal] = useState({ isOpen: false, title: "", message: "", count: 0 });

  const handleBulkDelete = async () => {
    if (filterCategory === "ALL" && filterRegion === "ALL") {
      showToast("Pilih jenjang atau wilayah dulu", "error");
      return;
    }

    const title = filterCategory !== "ALL" && filterRegion !== "ALL" 
      ? `Hapus Semua Siswa ${filterCategory} di ${filterRegion}?`
      : filterCategory !== "ALL" 
        ? `Hapus Semua Siswa Jenjang ${filterCategory}?`
        : `Hapus Semua Siswa di Wilayah ${filterRegion}?`;

    setBulkDeleteModal({
      isOpen: true,
      title,
      message: `Tindakan ini akan menghapus ${filteredStudents.length} data secara permanen. Apakah Anda yakin?`,
      count: filteredStudents.length
    });
  };

  const confirmBulkDelete = async () => {
    setLoading(true);
    setBulkDeleteModal({ ...bulkDeleteModal, isOpen: false });
    try {
      const res = await fetch("/api/admin/students/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          category: filterCategory === "ALL" ? undefined : filterCategory,
          region: filterRegion === "ALL" ? undefined : filterRegion
        })
      });

      if (res.ok) {
        const result = await res.json();
        showToast(result.message);
        fetchStudents();
      } else {
        const err = await res.json();
        showToast(err.error || "Gagal hapus massal", "error");
      }
    } catch (err) {
      showToast("Terjadi kesalahan koneksi", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleModalSuccess = () => {
    showToast(editingStudent ? "Data berhasil diperbarui" : "Siswa berhasil ditambahkan");
    fetchStudents();
  };

  if (loading) {
    return <div className={styles.loading}>Memuat data anak didik...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Database Anak Didik</h1>
          <div className={styles.headerActions}>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              style={{ display: 'none' }} 
              ref={fileInputRef}
              onChange={handleImportExcel}
            />
            <button 
              className={styles.importBtn} 
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Mengimpor..." : "📥 Impor Excel"}
            </button>
          </div>
        </div>
        <p className={styles.subtitle}>Kelola semua data siswa GSB dari berbagai jenjang pendidikan.</p>
      </div>

      {/* Filter Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.leftTools}>
          <div className={styles.searchWrapper}>
             <span className={styles.searchIcon}>🔍</span>
             <input 
               type="text" 
               placeholder="Cari nama siswa..." 
               className={styles.searchInput}
               value={search}
               onChange={e => setSearch(e.target.value)}
             />
          </div>

          <div className={styles.filters}>
            <select 
              className={styles.filterSelect}
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="ALL">Semua Jenjang</option>
              <option value="TK">TK</option>
              <option value="SD">SD</option>
              <option value="SMP">SMP</option>
              <option value="DISABILITAS">Disabilitas</option>
            </select>

            <select 
              className={styles.filterSelect}
              value={filterRegion}
              onChange={e => setFilterRegion(e.target.value)}
            >
              <option value="ALL">Semua Wilayah</option>
              {regions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        </div>
        
        <div className={styles.rightTools}>
          {(filterCategory !== "ALL" || filterRegion !== "ALL") && (
            <button className={styles.bulkDeleteBtn} onClick={handleBulkDelete}>
              🗑️ Hapus Massal ({filteredStudents.length})
            </button>
          )}
          <div className={styles.resultsCount}>
            Total: <strong>{filteredStudents.length}</strong> siswa
          </div>
        </div>
      </div>

      <AdminStudentTable 
        students={filteredStudents} 
        onDelete={handleDelete}
        onEdit={handleEdit}
        onAdd={handleAdd}
      />

      <StudentModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        existingRegions={regions}
        studentToEdit={editingStudent}
      />

      <DeleteConfirmModal 
        isOpen={bulkDeleteModal.isOpen}
        title={bulkDeleteModal.title}
        message={bulkDeleteModal.message}
        onClose={() => setBulkDeleteModal({ ...bulkDeleteModal, isOpen: false })}
        onConfirm={confirmBulkDelete}
        loading={loading}
      />

      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}
    </div>
  );
}
