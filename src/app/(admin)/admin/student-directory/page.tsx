"use client";
/* eslint-disable react-hooks/preserve-manual-memoization */

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import { Download, FileSpreadsheet, FileDown, Pencil, Trash2, User, Plus, RefreshCw } from "lucide-react";
import { Student } from "@/components/admin/AdminStudentTable/AdminStudentTable";
import Toast from "@/components/toast/Toast";
import Spinner from "@/components/ui/Spinner/Spinner";
import * as XLSX from "xlsx";
import { mapRow, studentToTemplateRow, STUDENT_PROFILE_KEYS, TEMPLATE_HEADERS, TEMPLATE_SAMPLE_ROW, type RawRow } from "@/lib/studentImportMapping";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import { formatFaseLabel } from "@/utils/formatters";
import StudentModal from "@/components/admin/StudentModal/StudentModal";
import DeleteConfirmModal from "@/components/admin/DeleteConfirmModal/DeleteConfirmModal";
import styles from "./directory.module.css";

// Label tampilan untuk key profil (camelCase -> Indonesia)
const PROFILE_LABELS: Record<string, string> = {
  tinggalBersama: "Tinggal Bersama",
  statusOrtu: "Status Orang Tua",
  jumlahSaudara: "Jumlah Saudara",
  kategoriKhusus: "Kategori Khusus",
  jenisDisabilitas: "Jenis Disabilitas",
  penghasilanOrtu: "Penghasilan Ortu/Bulan",
  bantuanPemerintah: "Bantuan Pemerintah",
  jenisTempatTinggal: "Jenis Tempat Tinggal",
  kendaraan: "Kendaraan",
  sumberAir: "Sumber Air",
  aksesListrik: "Akses Listrik",
  bahanBakarMasak: "Bahan Bakar Masak",
  perangkatRumah: "Perangkat di Rumah",
  aksesInternet: "Akses Internet",
  perangkatBelajar: "Perangkat Belajar",
  mapelFavorit: "Mapel Favorit",
  mapelSulit: "Mapel Sulit",
  citaCita: "Cita-cita",
  hobi: "Hobi",
  gayaBelajar: "Gaya Belajar",
  kemampuanMembaca: "Kemampuan Membaca",
  kemampuanInggris: "Kemampuan Inggris",
  jenisBukuDisukai: "Jenis Buku Disukai",
  kesediaanHadirOfflineDepok: "Kesediaan Hadir (Offline Depok)",
  transportOfflineDepok: "Transport (Offline Depok)",
  kesediaanHadirOfflineSasak: "Kesediaan Hadir (Offline Sasak)",
  transportOfflineSasak: "Transport (Offline Sasak)",
  kesediaanHadirOnlineReguler: "Kesediaan Hadir (Online Reguler)",
  kesediaanOncamReguler: "Kesediaan Oncam (Reguler)",
  kesediaanHadirOnlineSNBT: "Kesediaan Hadir (Online SNBT)",
  kesediaanOncamSNBT: "Kesediaan Oncam (SNBT)",
  targetKampus1: "Target Kampus 1",
  targetKampus2: "Target Kampus 2",
  targetKampus3: "Target Kampus 3",
  targetKampus4: "Target Kampus 4",
  kesediaanSelfDev: "Kesediaan Self Development",
  pernyataanPersetujuan: "Pernyataan Persetujuan",
  sejakKapanGSB: "Sejak Kapan Ikut GSB",
};

function Field({ label, value }: { label: string; value?: string }) {
  if (!value || value === "null" || value === "undefined") return null;
  return (
    <div className={styles.fieldRow}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export default function StudentDirectoryPage() {
  "use no memo";
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("ALL");
  const [filterFase, setFilterFase] = useState("ALL");
  const [filterGender, setFilterGender] = useState("ALL");
  const [selected, setSelected] = useState<Student | null>(null);

  // Edit / Delete State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: "",
    name: "",
  });

  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/students", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const sorted = (data.students || []).sort((a: Student, b: Student) =>
          a.name.localeCompare(b.name)
        );
        setStudents(sorted);
      }
    } catch (err) {
      console.error("Gagal mengambil data siswa", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
        if (data.availableRegions) setAvailableRegions(data.availableRegions);
      }
    } catch (err) {
      console.error("Gagal load settings", err);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchStudents();
      fetchSettings();
    }, 0);
    return () => clearTimeout(t);
  }, [fetchStudents, fetchSettings]);

  const handleDelete = async () => {
    try {
      const res = await fetch(`/api/admin/students/${deleteModal.id}`, { method: "DELETE" });
      if (res.ok) {
        setStudents(students.filter((s) => s._id !== deleteModal.id));
        showToast("Siswa berhasil dihapus");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menghapus data", "error");
      }
    } catch {
      showToast("Terjadi kesalahan koneksi", "error");
    } finally {
      setDeleteModal({ ...deleteModal, isOpen: false });
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

  const handleModalSuccess = () => {
    showToast(editingStudent ? "Data berhasil diperbarui" : "Siswa berhasil ditambahkan");
    fetchStudents();
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet([TEMPLATE_SAMPLE_ROW], { header: TEMPLATE_HEADERS });
    ws["!cols"] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.min(Math.max(h.length, 12), 45) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, "Template Impor Siswa GSB.xlsx");
  };

  const handleExportExcel = () => {
    if (filtered.length === 0) {
      showToast("Tidak ada data siswa untuk diekspor", "error");
      return;
    }
    const rows = filtered.map(studentToTemplateRow);
    const ws = XLSX.utils.json_to_sheet(rows, { header: TEMPLATE_HEADERS });
    ws["!cols"] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.min(Math.max(h.length, 12), 45) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    const stamp = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Data Siswa GSB ${stamp}.xlsx`);
    showToast(`${filtered.length} siswa diekspor`);
  };

  const handleRefresh = () => {
    fetchStudents();
    fetchSettings();
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const wb = XLSX.read(evt.target?.result, { type: "binary" });
        const allRows: RawRow[] = [];

        for (const sheetName of wb.SheetNames) {
          if (/indikator|rubrik|conflict/i.test(sheetName)) continue;
          const ws = wb.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json<RawRow>(ws);
          allRows.push(...rows);
        }

        const mapped = allRows.map(mapRow).filter((s) => s.name && s.fase);

        if (mapped.length === 0) {
          showToast("Tidak ada baris siswa valid (butuh Nama + bisa diturunkan Fase)", "error");
          return;
        }

        const res = await fetch("/api/admin/students/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ students: mapped }),
        });

        if (res.ok) {
          const result = await res.json();
          showToast(result.message);
          fetchStudents();
        } else {
          const errData = await res.json();
          showToast(errData.error || "Gagal mengimpor siswa", "error");
        }
      } catch (err) {
        showToast(err instanceof Error ? err.message : "File Excel rusak atau tidak sesuai format", "error");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.onerror = () => {
      showToast("Gagal membaca file", "error");
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const uniqueRegions = useMemo(() => {
    const regs = students.map((s) => s.region).filter((r): r is string => Boolean(r));
    return Array.from(new Set([...availableRegions, ...regs])).sort((a, b) => a.localeCompare(b));
  }, [students, availableRegions]);

  const uniqueFases = useMemo(() => {
    const fas = students.map((s) => s.fase).filter((f): f is string => Boolean(f));
    return Array.from(new Set([...availableLevels, ...fas])).sort((a, b) => a.localeCompare(b));
  }, [students, availableLevels]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        (s.studentCode || "").toLowerCase().includes(q);
      const matchRegion = filterRegion === "ALL" || s.region === filterRegion;
      const matchFase = filterFase === "ALL" || s.fase === filterFase;
      const matchGender = filterGender === "ALL" || s.gender === filterGender;
      return matchSearch && matchRegion && matchFase && matchGender;
    });
  }, [students, search, filterRegion, filterFase, filterGender]);

  const paginated = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  useEffect(() => {
    setPage(1);
  }, [filtered.length]);

  return (
    <div className={styles.container}>
      {/* Header with black gradient background */}
      <div className={styles.header}>
        <h1 className={styles.title}>Direktori Siswa</h1>
        <p className={styles.subtitle}>
          Pusat data lengkap anak didik dari Google Form intake (profil, keluarga, ekonomi).
        </p>
      </div>

      {/* Action Row: Template, Import, Export (Left) & Tambah (Right) */}
      <div className={styles.actionRow}>
        <div className={styles.actionLeft}>
          <button
            className={styles.templateBtn}
            onClick={handleDownloadTemplate}
            title="Unduh template Excel"
          >
            <FileDown size={14} /> Template
          </button>
          <input
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            ref={fileInputRef}
            onChange={handleImportExcel}
          />
          <button
            className={styles.importBtn}
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            <FileSpreadsheet size={14} />
            {importing ? "Mengimpor..." : "Import Excel"}
          </button>
          <button
            className={styles.exportBtn}
            onClick={handleExportExcel}
            disabled={filtered.length === 0}
          >
            <Download size={14} /> Export
          </button>
          <button
            className={styles.refreshBtn}
            onClick={handleRefresh}
            disabled={loading}
            title="Muat ulang data siswa"
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
        <button className={styles.addBtn} onClick={handleAdd}>
          <Plus size={14} /> Tambah Siswa
        </button>
      </div>

      {/* Filters Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.leftTools}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Cari nama atau No. Induk..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <AdminFilterSelect
              width="lg"
              value={filterRegion === "ALL" ? "" : filterRegion}
              onChange={(v) => setFilterRegion(v || "ALL")}
              placeholder="Semua Lokasi"
              clearable
              clearLabel="Semua Lokasi"
              options={uniqueRegions.map((reg) => ({ value: reg, label: reg }))}
            />

            <AdminFilterSelect
              value={filterFase === "ALL" ? "" : filterFase}
              onChange={(v) => setFilterFase(v || "ALL")}
              placeholder="Semua Fase"
              clearable
              clearLabel="Semua Fase"
              options={uniqueFases.map((fase) => ({ value: fase, label: formatFaseLabel(fase) }))}
            />

            <AdminFilterSelect
              value={filterGender === "ALL" ? "" : filterGender}
              onChange={(v) => setFilterGender(v || "ALL")}
              placeholder="Semua Gender"
              clearable
              clearLabel="Semua Gender"
              options={[
                { value: "L", label: "Laki-laki (L)" },
                { value: "P", label: "Perempuan (P)" }
              ]}
            />
          </div>
        </div>
      </div>

      {/* Split Columns Table */}
      <div className={styles.tableWrapper}>
        {loading ? (
          <div className={styles.loadingState}>
            <Spinner />
            <p>Memuat data siswa...</p>
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>NO. INDUK</th>
                <th>NAMA SISWA</th>
                <th>FASE</th>
                <th>LOKASI</th>
                <th>GENDER</th>
                <th>ASAL SEKOLAH</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((s) => (
                <tr key={s._id} onClick={() => setSelected(s)} className={styles.clickableRow}>
                  <td className={styles.studentCode} style={{ fontWeight: 700, color: "var(--admin-muted)" }}>{s.studentCode || "-"}</td>
                  <td className={styles.studentName}>{s.name}</td>
                  <td>
                    <span className={styles.studentFase}>{s.fase}</span>
                  </td>
                  <td className={styles.studentRegion}>{s.region || "-"}</td>
                  <td>{s.gender || "-"}</td>
                  <td className={styles.truncateCell} title={s.schoolOrigin}>{s.schoolOrigin || "-"}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className={styles.actionButtons}>
                      <button
                        className={styles.detailBtn}
                        onClick={() => setSelected(s)}
                        title="Lihat Profil Lengkap"
                      >
                        <User size={14} />
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={() => handleEdit(s)}
                        title="Edit Data Siswa"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => setDeleteModal({ isOpen: true, id: s._id, name: s.name })}
                        title="Hapus Siswa"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginated.length === 0 && (
                <tr>
                  <td colSpan={7} className={styles.emptyState}>
                    {students.length === 0 ? "Belum ada data siswa" : "Tidak ada hasil pencarian"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {!loading && filtered.length > itemsPerPage && (
        <AdminPagination
          page={page}
          onPageChange={setPage}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
        />
      )}

      <StudentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={handleModalSuccess}
        availableRegions={availableRegions}
        availableLevels={availableLevels}
        studentToEdit={editingStudent}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleDelete}
        title="Hapus Anak Didik"
        message={`Yakin mau menghapus siswa "${deleteModal.name}"?`}
      />

      {selected && (
        <div className={styles.drawerOverlay} onClick={() => setSelected(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <h2>{selected.name}</h2>
                <span className={styles.drawerSub}>
                  {selected.studentCode ? `No. Induk ${selected.studentCode} · ` : ""}
                  {selected.fase} · {selected.region || "-"}
                </span>
              </div>
              <button className={styles.closeDrawer} onClick={() => setSelected(null)}>
                ×
              </button>
            </div>

            <div className={styles.drawerBody}>
              <section>
                <h3>Data Utama</h3>
                <dl className={styles.fieldList}>
                  <Field label="Nama Orang Tua" value={selected.parentName} />
                  <Field label="Jenis Kelamin" value={selected.gender} />
                  <Field label="Tempat Lahir" value={selected.birthPlace} />
                  <Field
                    label="Tanggal Lahir"
                    value={
                      selected.birthDate
                        ? new Date(selected.birthDate).toLocaleDateString("id-ID")
                        : undefined
                    }
                  />
                  <Field label="Asal Sekolah" value={selected.schoolOrigin} />
                  <Field label="WA Siswa" value={selected.phone} />
                  <Field label="WA Orang Tua" value={selected.parentPhone} />
                  <Field label="Alamat" value={selected.address} />
                  <Field label="Program" value={selected.program} />
                  <Field label="PIC" value={selected.pic} />
                </dl>
              </section>

              <section>
                <h3>Profil Intake (Survey)</h3>
                <dl className={styles.fieldList}>
                  {STUDENT_PROFILE_KEYS.map(({ key }) => {
                    const val = selected.profil?.[key];
                    if (val === undefined || val === null || val === "") return null;
                    return (
                      <Field key={key} label={PROFILE_LABELS[key] || key} value={String(val)} />
                    );
                  })}
                  {(!selected.profil || Object.keys(selected.profil).length === 0) && (
                    <div className={styles.emptyState}>Data profil intake belum diisi/diimpor.</div>
                  )}
                </dl>
              </section>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
