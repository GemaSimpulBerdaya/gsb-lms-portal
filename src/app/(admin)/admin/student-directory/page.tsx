"use client";

import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Download, FileSpreadsheet, FileDown } from "lucide-react";
import { Student } from "@/components/admin/AdminStudentTable/AdminStudentTable";
import Toast from "@/components/toast/Toast";
import Spinner from "@/components/ui/Spinner/Spinner";
import * as XLSX from "xlsx";
import { mapRow, studentToTemplateRow, STUDENT_PROFILE_KEYS, TEMPLATE_HEADERS, TEMPLATE_SAMPLE_ROW, type RawRow } from "@/lib/studentImportMapping";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import { formatFaseLabel } from "@/utils/formatters";
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

export default function StudentDirectoryPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [filterRegion, setFilterRegion] = useState("ALL");
  const [filterFase, setFilterFase] = useState("ALL");
  const [filterGender, setFilterGender] = useState("ALL");
  const [selected, setSelected] = useState<Student | null>(null);

  const [page, setPage] = useState(1);
  const itemsPerPage = 15;

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  const fetchStudents = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/students");
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

  useEffect(() => {
    const t = setTimeout(fetchStudents, 0);
    return () => clearTimeout(t);
  }, [fetchStudents]);

  const handleDownloadTemplate = () => {
    // Bikin sheet dari header template + 1 baris contoh, lalu unduh .xlsx.
    const ws = XLSX.utils.json_to_sheet([TEMPLATE_SAMPLE_ROW], { header: TEMPLATE_HEADERS });
    // Lebar kolom enak dibaca
    ws["!cols"] = TEMPLATE_HEADERS.map((h) => ({ wch: Math.min(Math.max(h.length, 12), 45) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Siswa");
    XLSX.writeFile(wb, "Template Impor Siswa GSB.xlsx");
  };

  const handleExportExcel = () => {
    // Export siswa terfilter ke Excel pakai header template (round-trip:
    // hasil export bisa diimpor balik karena cocok dengan mapRow).
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
          // Skip sheet non-siswa (rubrik, indikator, dsb.)
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
          const err = await res.json();
          showToast(err.error || "Gagal impor data", "error");
        }
      } catch {
        showToast("Gagal membaca file Excel", "error");
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const uniqueRegions = useMemo(() => {
    const regs = students.map((s) => s.region).filter((r): r is string => Boolean(r));
    return Array.from(new Set(regs)).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const uniqueFase = useMemo(() => {
    const f = students.map((s) => s.fase).filter((x): x is string => Boolean(x));
    return Array.from(new Set(f)).sort((a, b) => a.localeCompare(b));
  }, [students]);

  // NOTE: filtered di-compute langsung tanpa useMemo agar React Compiler
  // bisa optimize component ini secara otomatis. Manual useMemo di sini
  // memicu rule react-hooks/preserve-manual-memoization karena Compiler
  // gagal preserve memoization pas nested filter chain.
  const q = search.toLowerCase();
  const filtered = students.filter((s) => {
    const matchSearch =
      s.name.toLowerCase().includes(q) ||
      (s.studentCode || "").toLowerCase().includes(q) ||
      (s.schoolOrigin || "").toLowerCase().includes(q);
    const matchReg = filterRegion === "ALL" || s.region === filterRegion;
    const matchFase = filterFase === "ALL" || s.fase === filterFase;
    const matchGender = filterGender === "ALL" || s.gender === filterGender;
    return matchSearch && matchReg && matchFase && matchGender;
  });

  // Reset ke halaman 1 saat hasil filter berubah.
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [search, filterRegion, filterFase, filterGender, filtered.length]);

  const paginated = useMemo(() => {
    const start = (page - 1) * itemsPerPage;
    return filtered.slice(start, start + itemsPerPage);
  }, [filtered, page]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat direktori siswa...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1 className={styles.title}>Direktori Siswa</h1>
          <div className={styles.headerActions}>
            <input
              type="file"
              accept=".xlsx, .xls"
              style={{ display: "none" }}
              ref={fileInputRef}
              onChange={handleImportExcel}
            />
            <button
              className={styles.templateBtn}
              onClick={handleDownloadTemplate}
              type="button"
            >
              <FileSpreadsheet size={16} style={{ display: "inline", marginRight: 4 }} /> Download Template
            </button>
            <button
              className={styles.templateBtn}
              onClick={handleExportExcel}
              type="button"
            >
              <FileDown size={16} style={{ display: "inline", marginRight: 4 }} /> Export Excel
            </button>
            <button
              className={styles.importBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              {importing ? "Mengimpor..." : <><Download size={16} style={{ display: "inline", marginRight: 4 }} /> Impor Excel</>}
            </button>
          </div>
        </div>
        <p className={styles.subtitle}>
          Data lengkap siswa hasil form pendaftaran. Impor Excel pakai kolom <strong>No. Induk</strong> agar data tidak terduplikasi saat impor ulang.
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrapper}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Cari nama / No. Induk / asal sekolah..."
            className={styles.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className={styles.filterSelect}
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
        >
          <option value="ALL">Semua Lokasi Belajar</option>
          {uniqueRegions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterFase}
          onChange={(e) => setFilterFase(e.target.value)}
        >
          <option value="ALL">Semua Fase</option>
          {uniqueFase.map((f) => (
            <option key={f} value={f}>{formatFaseLabel(f)}</option>
          ))}
        </select>
        <select
          className={styles.filterSelect}
          value={filterGender}
          onChange={(e) => setFilterGender(e.target.value)}
        >
          <option value="ALL">Semua L/P</option>
          <option value="Laki-laki">Laki-laki</option>
          <option value="Perempuan">Perempuan</option>
        </select>
        <div className={styles.resultsCount}>
          Total: <strong>{filtered.length}</strong> siswa
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>No. Induk</th>
              <th>Nama</th>
              <th>L/P</th>
              <th>Fase</th>
              <th>Lokasi</th>
              <th>Asal Sekolah</th>
              <th>WA Siswa</th>
              <th>WA Ortu</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className={styles.empty}>Belum ada data siswa.</td>
              </tr>
            ) : (
              paginated.map((s) => (
                <tr key={s._id}>
                  <td>{s.studentCode || "-"}</td>
                  <td className={styles.nameCell}>{s.name}</td>
                  <td>{s.gender === "Laki-laki" ? "L" : s.gender === "Perempuan" ? "P" : "-"}</td>
                  <td>{s.fase}</td>
                  <td>{s.region || "-"}</td>
                  <td>{s.schoolOrigin || "-"}</td>
                  <td>{s.phone || "-"}</td>
                  <td>{s.parentPhone || "-"}</td>
                  <td>
                    <button className={styles.detailBtn} onClick={() => setSelected(s)}>
                      Lihat
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <AdminPagination
          page={page}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
        />
      )}

      {selected && (
        <div className={styles.drawerOverlay} onClick={() => setSelected(null)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <div>
                <h2>{selected.name}</h2>
                <span className={styles.drawerSub}>
                  {selected.studentCode ? `No. Induk ${selected.studentCode} · ` : ""}{selected.fase} · {selected.region || "-"}
                </span>
              </div>
              <button className={styles.closeBtn} onClick={() => setSelected(null)}>✕</button>
            </div>

            <div className={styles.drawerBody}>
              <section>
                <h3>Data Utama</h3>
                <Field label="Jenis Kelamin" value={selected.gender} />
                <Field label="Tempat Lahir" value={selected.birthPlace} />
                <Field
                  label="Tanggal Lahir"
                  value={selected.birthDate ? new Date(selected.birthDate).toLocaleDateString("id-ID") : undefined}
                />
                <Field label="Asal Sekolah" value={selected.schoolOrigin} />
                <Field label="WA Siswa" value={selected.phone} />
                <Field label="WA Orang Tua" value={selected.parentPhone} />
                <Field label="Alamat" value={selected.address} />
                <Field label="Program" value={selected.program} />
                <Field label="PIC" value={selected.pic} />
              </section>

              <section>
                <h3>Profil Survei</h3>
                {STUDENT_PROFILE_KEYS.map(({ key }) => {
                  const val = selected.profil?.[key];
                  if (val === undefined || val === null || val === "") return null;
                  return <Field key={key} label={PROFILE_LABELS[key] || key} value={String(val)} />;
                })}
                {(!selected.profil || Object.keys(selected.profil).length === 0) && (
                  <p className={styles.noProfile}>Belum ada data survei (siswa ini mungkin diinput manual, bukan dari impor form).</p>
                )}
              </section>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{value || "-"}</span>
    </div>
  );
}
