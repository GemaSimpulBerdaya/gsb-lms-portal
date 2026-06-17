"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import {
  UserPlus,
  Users,
  Phone,
  Mail,
  Calendar,
  Pencil,
  Power,
  Save,
  Search,
  Upload,
  Download,
  FileDown,
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
  Textarea,
} from "@/components/admin/ui/FormField";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import Spinner from "@/components/ui/Spinner/Spinner";
import styles from "./registry.module.css";
import { useDialog } from "@/components/ui/DialogProvider";

interface VolunteerRegistry {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  joinedYear?: number;
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
  phone: "",
  email: "",
  joinedYear: "",
  notes: "",
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

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VolunteerRegistry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [teams, setTeams] = useState<{ _id: string, teamName: string, region: string }[]>([]);

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
      const res = await fetch(
        `/api/admin/volunteer-registry?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setList(data.volunteers || []);
      }
    } catch (err) {
      console.error("Fetch registry error:", err);
    } finally {
      setLoading(false);
    }
  }, [search, filterActive]);

  useEffect(() => {
    const t = setTimeout(fetchList, 250);
    return () => clearTimeout(t);
  }, [fetchList]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [list.length]);

  const currentList = list.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/volunteers");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.volunteers || []);
      }
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, teamId: "", role: "FASILITATOR" } as any);
    setError("");
    setModalOpen(true);
  };

  const openEdit = (v: VolunteerRegistry) => {
    setEditing(v);
    setForm({
      name: v.name,
      phone: v.phone ?? "",
      email: v.email ?? "",
      joinedYear: v.joinedYear ? String(v.joinedYear) : "",
      notes: v.notes ?? "",
      isActive: v.isActive,
    });
    setError("");
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        phone: form.phone || undefined,
        email: form.email || undefined,
        notes: form.notes,
        isActive: form.isActive,
      };
      if (!editing && (form as any).teamId) {
        payload.teamId = (form as any).teamId;
        payload.role = (form as any).role || "FASILITATOR";
      }
      const yr = Number(form.joinedYear);
      if (Number.isFinite(yr) && yr > 1900) payload.joinedYear = yr;

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
    const headers = [
      "name",
      "email",
      "phone",
      "joinedYear",
      "notes",
      "teamName",
      "teamEmail",
      "teamRegion",
      "teamPassword",
      "role",
    ];
    const example = [
      {
        name: "Budi Santoso",
        email: "budi@example.com",
        phone: "081234567890",
        joinedYear: 2024,
        notes: "Mahasiswa Pendidikan",
        teamName: "Tim Offline Depok 1",
        teamEmail: "tim.depok1@gsb.com",
        teamRegion: "Offline Depok",
        teamPassword: "",
        role: "FASILITATOR",
      },
      {
        name: "Andi Wijaya",
        email: "",
        phone: "081234567891",
        joinedYear: 2024,
        notes: "",
        teamName: "Tim Offline Depok 1",
        teamEmail: "tim.depok1@gsb.com",
        teamRegion: "Offline Depok",
        teamPassword: "",
        role: "PENGAJAR",
      },
      {
        name: "Citra Lestari",
        email: "",
        phone: "",
        joinedYear: 2025,
        notes: "Hanya registry, belum di tim",
        teamName: "",
        teamEmail: "",
        teamRegion: "",
        teamPassword: "",
        role: "",
      },
    ];

    const ws = XLSX.utils.json_to_sheet(example, { header: headers });
    // Lebar kolom biar gampang dibaca.
    ws["!cols"] = headers.map((h) => ({
      wch: ["notes", "teamName", "teamEmail"].includes(h) ? 22 : 14,
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relawan");

    // Sheet bantuan readme.
    const readme = XLSX.utils.aoa_to_sheet([
      ["TEMPLATE IMPOR DATA RELAWAN GSB"],
      [""],
      ["KOLOM WAJIB:"],
      ["  - name        : Nama lengkap orang"],
      [""],
      ["KOLOM REGISTRY (opsional):"],
      ["  - email       : Email kontak (harus unik)"],
      ["  - phone       : Nomor HP/WA"],
      ["  - joinedYear  : Tahun mulai jadi relawan (mis. 2024)"],
      ["  - notes       : Catatan internal"],
      [""],
      ["KOLOM AKUN TIM (opsional, isi semua atau kosongkan semua):"],
      ["  - teamName    : Nama tim, mis. 'Tim Offline Depok 1'"],
      ["  - teamEmail   : Email login tim (wajib kalau teamName diisi)"],
      ["  - teamRegion  : Lokasi belajar, mis. 'Offline Depok'"],
      ["  - teamPassword: Password login. Kosongkan -> default 'password123'"],
      ["  - role        : FASILITATOR | PENGAJAR | DOKUMENTASI (default FASILITATOR)"],
      [""],
      ["CATATAN PENTING:"],
      ["  - Beberapa baris bisa pakai teamEmail yang sama -> akun dishare di tim itu."],
      ["  - Kalau orang sudah ada di tim LAIN, sistem TIDAK akan auto-pindah."],
      ["    Pindah tim wajib dikonfirmasi manual via halaman Akun Tim."],
      ["  - Hapus baris contoh di sheet 'Relawan' sebelum impor data asli."],
    ]);
    readme["!cols"] = [{ wch: 70 }];
    XLSX.utils.book_append_sheet(wb, readme, "Petunjuk");

    XLSX.writeFile(wb, "template-impor-relawan.xlsx");
  };


  const handleExportExcel = () => {
    const rows = list.map((v) => ({
      name: v.name,
      email: v.email || "",
      phone: v.phone || "",
      joinedYear: v.joinedYear || "",
      status: v.isActive ? "Aktif" : "Non-aktif",
      teamName: v.currentTeam?.teamName || "",
      teamRegion: v.currentTeam?.region || "",
      role: v.currentTeam?.role || "",
      notes: v.notes || "",
    }));

    const headers = [
      "name",
      "email",
      "phone",
      "joinedYear",
      "status",
      "teamName",
      "teamRegion",
      "role",
      "notes",
    ];
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    ws["!cols"] = [
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 12 },
      { wch: 12 },
      { wch: 24 },
      { wch: 20 },
      { wch: 16 },
      { wch: 28 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relawan");
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

        // Cari sheet "Relawan" atau pakai sheet pertama yang bukan "Petunjuk".
        const sheetName =
          wb.SheetNames.find((n) => n.toLowerCase() === "relawan") ||
          wb.SheetNames.find((n) => n.toLowerCase() !== "petunjuk") ||
          wb.SheetNames[0];
        if (!sheetName) {
          setImportResult({ type: "err", text: "File Excel kosong" });
          return;
        }
        const ws = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
          defval: "",
        });

        // Trim & filter baris kosong.
        const cleaned = json
          .map((row) => {
            const out: Record<string, unknown> = {};
            for (const [k, v] of Object.entries(row)) {
              let key = String(k).trim();
              const lowerKey = key.toLowerCase();

              if (lowerKey === "team name" || lowerKey === "nama tim" || lowerKey === "tim") key = "teamName";
              if (lowerKey === "region" || lowerKey === "team region" || lowerKey === "wilayah") key = "teamRegion";
              if (lowerKey === "team email" || lowerKey === "email tim") key = "teamEmail";
              if (lowerKey === "email" || lowerKey === "email kontak") key = "email";
              if (lowerKey === "team password" || lowerKey === "password tim") key = "teamPassword";
              if (lowerKey === "joined year" || lowerKey === "tahun bergabung") key = "joinedYear";
              if (lowerKey === "nama" || lowerKey === "nama lengkap" || lowerKey === "nama relawan") key = "name";
              if (lowerKey === "phone" || lowerKey === "telepon" || lowerKey === "no hp" || lowerKey === "no. hp" || lowerKey === "whatsapp" || lowerKey === "nomor hp") key = "phone";
              if (lowerKey === "peran" || lowerKey === "role") key = "role";
              if (lowerKey === "catatan" || lowerKey === "keterangan") key = "notes";

              const val = typeof v === "string" ? v.trim() : v;
              if (val !== "" && val !== null && val !== undefined) {
                out[key] = val;
              }
            }
            return out;
          })
          .filter((row) => row.name);

        if (cleaned.length === 0) {
          setImportResult({
            type: "err",
            text: "Tidak ada baris valid (kolom 'name' wajib diisi)",
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

        const detailParts = [
          `Registry: +${data.registryCreated} baru, ${data.registryUpdated} diupdate`,
          `Tim: +${data.teamsCreated} baru, ${data.teamsUpdated} disentuh`,
          `Anggota dimasukkan: ${data.membersAdded}`,
        ];
        if ((data.transfers ?? []).length > 0) {
          detailParts.push(
            `${data.transfers.length} transfer di-skip (perlu konfirmasi manual)`,
          );
        }
        if ((data.errors ?? []).length > 0) {
          detailParts.push(`${data.errors.length} baris error`);
        }

        setImportResult({
          type: "ok",
          text: `Impor selesai: ${data.totalRows} baris diproses`,
          detail: detailParts.join(" · "),
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
          Daftar pengelolaan tim relawan. Cek akun login tim relawan kamu di halaman{" "}
          <a href="/admin/volunteers" className={styles.inlineLink}>
            Akun Tim
          </a>
          .
        </p>
      </div>

      <div className={styles.toolbar}>
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
          value={filterActive}
          onChange={(v) => setFilterActive(v as "true" | "false" | "all")}
          options={[
            { value: "true", label: "Aktif" },
            { value: "false", label: "Non-aktif" },
            { value: "all", label: "Semua status" }
          ]}
        />
        <input
          type="file"
          accept=".xlsx,.xls"
          ref={fileInputRef}
          onChange={handleImportExcel}
          style={{ display: "none" }}
        />
        <button
          className={styles.toolBtn}
          onClick={handleDownloadTemplate}
          title="Unduh template Excel"
        >
          <Download size={14} />
          Template
        </button>
        <button
          className={styles.toolBtn}
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          title="Impor data relawan dari Excel"
        >
          <Upload size={14} />
          {importing ? "Mengimpor..." : "Impor Excel"}
        </button>
        <button
          className={styles.toolBtn}
          onClick={handleExportExcel}
          title="Export data relawan ke Excel"
        >
          <FileDown size={14} />
          Export Excel
        </button>
        <button className={styles.addBtn} onClick={openCreate}>
          <UserPlus size={16} />
          Tambah Relawan
        </button>
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
                <th>EMAIL</th>
                <th>NO HP</th>
                <th>TIM AKTIF</th>
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
                      <div>
                        <div className={styles.nameMain}>{v.name}</div>
                        {v.joinedYear ? (
                          <div className={styles.nameSub}>
                            <Calendar size={11} /> Sejak {v.joinedYear}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </td>
                  <td>
                    {v.email ? (
                      <span className={styles.contactValue} title={v.email}>
                        <Mail size={11} /> {v.email}
                      </span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    {v.phone ? (
                      <span className={styles.contactValue} title={v.phone}>
                        <Phone size={11} /> {v.phone}
                      </span>
                    ) : (
                      <span className={styles.muted}>—</span>
                    )}
                  </td>
                  <td>
                    {v.currentTeam ? (
                      <div className={styles.teamCell}>
                        <strong>{v.currentTeam.teamName || "Tim"}</strong>
                        <small>
                          {v.currentTeam.region ?? ""} ·{" "}
                          <em>{v.currentTeam.role}</em>
                        </small>
                      </div>
                    ) : (
                      <span className={styles.muted}>Belum di tim</span>
                    )}
                  </td>
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
            ? "Update data orang. Perubahan tidak menyentuh tim/akun login."
            : "Daftarkan orang baru ke registry. Penugasan ke tim dilakukan di halaman Akun Tim."
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

        <Section title="Identitas">
          <Field label="Nama Lengkap" required>
            <Input
              type="text"
              placeholder="Contoh: Ahmad Fauzi"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </Field>
          <Row>
            <Field label="Nomor HP / WA">
              <Input
                icon={Phone}
                type="tel"
                placeholder="08xxxxxxxxxx"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </Field>
            <Field label="Email kontak (opsional)">
              <Input
                icon={Mail}
                type="email"
                placeholder="email@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </Field>
          </Row>
          <Field label="Tahun mulai jadi relawan">
            <Input
              icon={Calendar}
              type="number"
              placeholder="Contoh: 2024"
              value={form.joinedYear}
              onChange={(e) => setForm({ ...form, joinedYear: e.target.value })}
              min={2000}
              max={new Date().getFullYear() + 1}
            />
          </Field>
          <Field label="Catatan internal">
            <Textarea
              rows={3}
              placeholder="Catatan opsional, tidak terlihat oleh relawan."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
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

        {!editing && (
          <Section title="Assign ke Tim Aktif (Opsional)" description="Langsung masukkan relawan ini ke dalam tim sebagai anggota.">
            <Row>
              <Field label="Pilih Tim">
                <select
                  className={styles.filterSelect}
                  value={(form as any).teamId || ""}
                  onChange={(e) => setForm({ ...form, teamId: e.target.value } as any)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                >
                  <option value="">— Tidak dimasukkan ke tim —</option>
                  {teams.map(t => (
                    <option key={t._id} value={t._id}>{t.teamName} ({t.region})</option>
                  ))}
                </select>
              </Field>
              <Field label="Role di Tim">
                <select
                  className={styles.filterSelect}
                  value={(form as any).role || "FASILITATOR"}
                  onChange={(e) => setForm({ ...form, role: e.target.value } as any)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                  disabled={!(form as any).teamId}
                >
                  <option value="FASILITATOR">Fasilitator</option>
                  <option value="PENGAJAR">Pengajar</option>
                  <option value="DOKUMENTASI">Dokumentasi</option>
                </select>
              </Field>
            </Row>
          </Section>
        )}
      </AdminModal>
    </div>
  );
}
