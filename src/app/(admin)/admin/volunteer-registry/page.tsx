"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import {
  UserPlus,
  Users,
  Pencil,
  Power,
  Save,
  Search,
  Upload,
  Download,
  FileDown,
  MapPin,
  Tag,
} from "lucide-react";
import * as XLSX from "xlsx";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import {
  Section,
  Field,
  Input,
  Button,
  ErrorBox,
  Row,
  Select,
} from "@/components/admin/ui/FormField";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import Spinner from "@/components/ui/Spinner/Spinner";
import styles from "./registry.module.css";
import { useDialog } from "@/components/ui/DialogProvider";
import {
  mapVolunteerRegistryRow,
  parseVolunteerRoles,
  sheetFromVolunteerRegion,
  VOLUNTEER_ASSIGNMENT_ROLES,
  VOLUNTEER_LOCATION_SHEETS,
  VOLUNTEER_REGISTRY_HEADERS,
  VOLUNTEER_REGISTRY_SAMPLE_ROW,
  volunteerToLocationRow,
} from "@/lib/volunteerRegistryImportMapping";

interface VolunteerRegistry {
  _id: string;
  name: string;
  assignmentRegion?: string;
  assignmentRole?: string;
  assignmentRoles?: string[];
  assignmentFase?: string;
  assignmentWeek?: string;
  isActive: boolean;
  notes?: string;
  currentTeam: {
    id: string;
    teamName?: string;
    region?: string;
    role: string;
  } | null;
}

const EMPTY_FORM = {
  name: "",
  assignmentRegion: "",
  assignmentRoles: [] as string[],
  assignmentFase: "",
  assignmentWeek: "",
  isActive: true,
};

export default function VolunteerRegistryPage() {
  const { showConfirm } = useDialog();
  const [list, setList] = useState<VolunteerRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"true" | "false" | "all">(
    "true",
  );
  const [filterRegion, setFilterRegion] = useState("");
  const [filterFase, setFilterFase] = useState("");
  const [filterWeek, setFilterWeek] = useState("");
  const [filterOptions, setFilterOptions] = useState<{ regions: string[]; fases: string[]; weeks: string[] }>({
    regions: [],
    fases: [],
    weeks: [],
  });

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VolunteerRegistry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    type: "ok" | "err";
    text: string;
    detail?: string;
  } | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      params.set("active", filterActive);
      if (filterRegion) params.set("region", filterRegion);
      if (filterFase) params.set("fase", filterFase);
      if (filterWeek) params.set("week", filterWeek);
      const res = await fetch(
        `/api/admin/volunteer-registry?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setList(data.registryEntries || data.volunteers || []);
        setFilterOptions(data.filterOptions || { regions: [], fases: [], weeks: [] });
      }
    } catch (err) {
      console.error("Fetch registry error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterActive, filterRegion, filterFase, filterWeek]);

  useEffect(() => {
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
  }, [fetchList]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [list.length]);

  const currentList = list.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (v: VolunteerRegistry) => {
    setEditing(v);
    setForm({
      name: v.name,
      assignmentRegion: v.assignmentRegion ?? "",
      assignmentRoles: v.assignmentRoles?.length
        ? v.assignmentRoles
        : parseVolunteerRoles(v.assignmentRole),
      assignmentFase: v.assignmentFase ?? "",
      assignmentWeek: v.assignmentWeek ?? "",
      isActive: v.isActive,
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (form.assignmentRoles.length === 0) {
      setError("Pilih minimal satu peran");
      setSaving(false);
      return;
    }
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        assignmentRegion: form.assignmentRegion,
        assignmentRoles: form.assignmentRoles,
        assignmentFase: form.assignmentFase,
        assignmentWeek: form.assignmentWeek,
        isActive: form.isActive,
      };

      const url = editing
        ? `/api/admin/volunteer-registry/${editing._id}`
        : "/api/admin/volunteer-registry";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal menyimpan");
        return;
      }
      setModalOpen(false);
      fetchList();
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadTemplate = () => {
    const wb = XLSX.utils.book_new();
    for (const { sheetName } of VOLUNTEER_LOCATION_SHEETS) {
      const ws = XLSX.utils.json_to_sheet([VOLUNTEER_REGISTRY_SAMPLE_ROW], {
        header: [...VOLUNTEER_REGISTRY_HEADERS],
      });
      ws["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 24 }, { wch: 28 }, { wch: 22 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    }

    XLSX.writeFile(wb, "template-impor-relawan.xlsx");
  };


  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    const grouped = new Map<string, VolunteerRegistry[]>();
    for (const volunteer of list) {
      const sheetName = sheetFromVolunteerRegion(volunteer.assignmentRegion || "");
      grouped.set(sheetName, [...(grouped.get(sheetName) || []), volunteer]);
    }
    for (const { sheetName } of VOLUNTEER_LOCATION_SHEETS) {
      const rows = (grouped.get(sheetName) || []).map((volunteer, index) =>
        volunteerToLocationRow({
          name: volunteer.name,
          assignmentRegion: volunteer.assignmentRegion,
          assignmentRoles: volunteer.assignmentRoles?.length
            ? volunteer.assignmentRoles
            : parseVolunteerRoles(volunteer.assignmentRole),
          assignmentFase: volunteer.assignmentFase,
          assignmentWeek: volunteer.assignmentWeek,
        }, index),
      );
      const ws = XLSX.utils.json_to_sheet(rows, { header: [...VOLUNTEER_REGISTRY_HEADERS] });
      ws["!cols"] = [{ wch: 8 }, { wch: 30 }, { wch: 24 }, { wch: 28 }, { wch: 22 }, { wch: 12 }];
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
    }
    XLSX.writeFile(wb, "export-daftar-relawan.xlsx");
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });

        const locationSheets = wb.SheetNames.filter((name) => /^Untuk LMS - /i.test(name));
        if (locationSheets.length === 0) {
          setImportResult({ type: "err", text: "Sheet Untuk LMS per lokasi tidak ditemukan" });
          return;
        }
        const cleaned = locationSheets.flatMap((sheetName) =>
          XLSX.utils
            .sheet_to_json<Record<string, unknown>>(wb.Sheets[sheetName], { defval: "" })
            .map((row) => mapVolunteerRegistryRow(row, sheetName))
            .filter((row) => row.name),
        );

        if (cleaned.length === 0) {
          setImportResult({
            type: "err",
            text: "Tidak ada baris relawan valid",
          });
          return;
        }

        const res = await fetch("/api/admin/volunteer-registry/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rows: cleaned }),
        });
        const data = await res.json();
        if (!res.ok) {
          setImportResult({
            type: "err",
            text: data.error || "Impor gagal",
          });
          return;
        }

        setImportResult({
          type: "ok",
          text: `Impor selesai: ${data.created} baru, ${data.updated} diperbarui.`,
        });
        fetchList();
      } catch (err) {
        console.error("Import error:", err);
        setImportResult({
          type: "err",
          text:
            err instanceof Error ? err.message : "Gagal membaca file Excel",
        });
      } finally {
        setImporting(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleToggleActive = async (v: VolunteerRegistry) => {
    const newActive = !v.isActive;
    const message = newActive
      ? `Aktifkan kembali ${v.name}?`
      : `Nonaktifkan ${v.name}? Mereka akan otomatis dilepas dari tim aktif.`;
    const isConfirmed = await showConfirm(message, newActive ? "Aktifkan Relawan" : "Nonaktifkan Relawan");
    if (!isConfirmed) return;

    try {
      if (newActive) {
        await fetch(`/api/admin/volunteer-registry/${v._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
      } else {
        await fetch(`/api/admin/volunteer-registry/${v._id}`, {
          method: "DELETE",
        });
      }
      fetchList();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Daftar Relawan</h1>
        <p className={styles.subtitle}>
          Master orang (nama, lokasi, peran, fase, pekan). Masukkan ke tim di{" "}
          <a href="/admin/team-members" className={styles.inlineLink}>
            Anggota Tim
          </a>
          . Akun login di{" "}
          <a href="/admin/volunteers" className={styles.inlineLink}>
            Akun Tim
          </a>
          .
        </p>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.toolbarFilters}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Cari nama relawan..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <AdminFilterSelect
            width="fluid"
            value={filterActive}
            onChange={(v) => setFilterActive(v as "true" | "false" | "all")}
            options={[
              { value: "true", label: "Aktif" },
              { value: "false", label: "Non-aktif" },
              { value: "all", label: "Semua status" }
            ]}
          />
          <AdminFilterSelect
            width="fluid"
            value={filterRegion}
            onChange={setFilterRegion}
            options={[
              { value: "", label: "Semua lokasi" },
              ...filterOptions.regions.map((region) => ({ value: region, label: region })),
            ]}
          />
          <AdminFilterSelect
            width="fluid"
            value={filterFase}
            onChange={setFilterFase}
            options={[
              { value: "", label: "Semua fase" },
              ...filterOptions.fases.map((fase) => ({ value: fase, label: fase })),
            ]}
          />
          <AdminFilterSelect
            width="fluid"
            value={filterWeek}
            onChange={setFilterWeek}
            options={[
              { value: "", label: "Semua pekan" },
              ...filterOptions.weeks.map((week) => ({ value: week, label: `Pekan ${week}` })),
            ]}
          />
        </div>
        <input
          type="file"
          accept=".xlsx,.xls"
          ref={fileInputRef}
          onChange={handleImportExcel}
          style={{ display: "none" }}
        />
        <div className={styles.toolbarActions}>
          <button className={styles.toolBtn} onClick={handleDownloadTemplate} title="Unduh template Excel">
            <Download size={14} /> Template
          </button>
          <button className={styles.toolBtn} onClick={() => fileInputRef.current?.click()} disabled={importing} title="Impor data relawan dari Excel">
            <Upload size={14} /> {importing ? "Mengimpor..." : "Impor Excel"}
          </button>
          <button className={styles.toolBtn} onClick={handleExportExcel} title="Export data relawan ke Excel">
            <FileDown size={14} /> Export Excel
          </button>
          <button className={styles.addBtn} onClick={openCreate}>
            <UserPlus size={16} /> Tambah Relawan
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className={`${styles.importBanner} ${importResult.type === "ok" ? styles.importOk : styles.importErr
            }`}
        >
          <strong>{importResult.text}</strong>
          {importResult.detail && (
            <div className={styles.importDetail}>{importResult.detail}</div>
          )}
          <button
            className={styles.importClose}
            onClick={() => setImportResult(null)}
          >
            Ã—
          </button>
        </div>
      )}

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat data relawan...</p>
          </div>
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            Belum ada relawan di registry. Klik &quot;Tambah Relawan&quot; untuk mulai.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>NAMA</th>
                <th>LOKASI</th>
                <th>PERAN</th>
                <th>FASE</th>
                <th>PEKAN</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {currentList.map((v) => (
                <tr
                  key={`${page}-${v._id}`}
                  className={`admin-page-row ${!v.isActive ? styles.rowInactive : ""}`}
                >
                  <td>
                    <div className={styles.nameCell}>
                      <div className={styles.avatar}>
                        {v.name.charAt(0).toUpperCase()}
                      </div>
                      <div className={styles.nameMain}>{v.name}</div>
                    </div>
                  </td>
                  <td>{v.assignmentRegion || "—"}</td>
                  <td>{(v.assignmentRoles?.length ? v.assignmentRoles : parseVolunteerRoles(v.assignmentRole)).join(", ") || "—"}</td>
                  <td>{v.assignmentFase || "—"}</td>
                  <td>{v.assignmentWeek || "—"}</td>
                  <td>
                    {v.isActive ? (
                      <span className={`${styles.badge} ${styles.badgeActive}`}>
                        Aktif
                      </span>
                    ) : (
                      <span className={`${styles.badge} ${styles.badgeInactive}`}>
                        Non-aktif
                      </span>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.editBtn}
                        onClick={() => openEdit(v)}
                        title="Edit"
                      >
                        <Pencil size={14} /> Edit
                      </button>
                      <button
                        className={styles.toggleBtn}
                        onClick={() => handleToggleActive(v)}
                        title={v.isActive ? "Nonaktifkan" : "Aktifkan"}
                      >
                        <Power size={14} />
                        {v.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <AdminPagination
          page={page}
          totalItems={list.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
        />
      </div>

      <AdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Data Relawan" : "Tambah Relawan Baru"}
        subtitle={
          editing
            ? "Update penugasan relawan."
            : "Isi data sesuai sheet Untuk LMS per lokasi."
        }
        icon={Users}
        onSubmit={handleSubmit}
        footer={
          <>
            <Button type="button" variant="cancel" onClick={() => setModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Menyimpan..." : (
                <>
                  <Save size={16} /> Simpan
                </>
              )}
            </Button>
          </>
        }
      >
        {error && <ErrorBox message={error} />}

        <Section title="Data Relawan">
          <Field label="Nama Relawan" required>
            <Input
              type="text"
              placeholder="Nama lengkap relawan"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Row>
            <Field label="Lokasi" required>
              <Select
                icon={MapPin}
                value={form.assignmentRegion}
                onChange={(e) => setForm({ ...form, assignmentRegion: e.target.value })}
                required
              >
                <option value="">Pilih lokasi</option>
                {VOLUNTEER_LOCATION_SHEETS.map(({ region }) => (
                  <option key={region} value={region}>{region}</option>
                ))}
              </Select>
            </Field>
            <Field label="Peran" required>
              <div className={styles.roleOptions}>
                {VOLUNTEER_ASSIGNMENT_ROLES.map((role) => (
                  <label key={role} className={styles.checkboxRow}>
                    <input
                      type="checkbox"
                      checked={form.assignmentRoles.includes(role)}
                      onChange={(event) => setForm({
                        ...form,
                        assignmentRoles: event.target.checked
                          ? [...form.assignmentRoles, role]
                          : form.assignmentRoles.filter((item) => item !== role),
                      })}
                    />
                    <span>{role}</span>
                  </label>
                ))}
              </div>
            </Field>
          </Row>
          <Row>
            <Field label="Fase" required>
              <Select
                icon={Tag}
                value={form.assignmentFase}
                onChange={(e) => setForm({ ...form, assignmentFase: e.target.value })}
                required
              >
                <option value="">Pilih fase</option>
                <option value="ALL">Semua fase</option>
                {filterOptions.fases.map((fase) => (
                  <option key={fase} value={fase}>{fase}</option>
                ))}
              </Select>
            </Field>
            <Field label="Pekan" required>
              <Input
                type="text"
                placeholder="Contoh: 1 atau 1&3"
                value={form.assignmentWeek}
                onChange={(e) => setForm({ ...form, assignmentWeek: e.target.value })}
                required
              />
            </Field>
          </Row>
          {editing && (
            <Field label="Status">
              <label className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) =>
                    setForm({ ...form, isActive: e.target.checked })
                  }
                />
                <span>Aktif</span>
              </label>
            </Field>
          )}
        </Section>


      </AdminModal>
    </div>
  );
}
