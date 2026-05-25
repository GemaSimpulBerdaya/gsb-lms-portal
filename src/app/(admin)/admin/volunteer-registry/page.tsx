"use client";

import { useEffect, useState, useCallback } from "react";
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
} from "lucide-react";
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
import styles from "./registry.module.css";

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
  const [list, setList] = useState<VolunteerRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterActive, setFilterActive] = useState<"true" | "false" | "all">(
    "true",
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VolunteerRegistry | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

  const handleToggleActive = async (v: VolunteerRegistry) => {
    const newActive = !v.isActive;
    const message = newActive
      ? `Aktifkan kembali ${v.name}?`
      : `Nonaktifkan ${v.name}? Mereka akan otomatis dilepas dari tim aktif.`;
    if (!confirm(message)) return;

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
        <h1 className={styles.title}>Registry Relawan</h1>
        <p className={styles.subtitle}>
          Daftar individu relawan lintas tim. Akun login dikelola di halaman{" "}
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
        <select
          value={filterActive}
          onChange={(e) =>
            setFilterActive(e.target.value as "true" | "false" | "all")
          }
          className={styles.filterSelect}
        >
          <option value="true">Aktif saja</option>
          <option value="false">Non-aktif saja</option>
          <option value="all">Semua status</option>
        </select>
        <button className={styles.addBtn} onClick={openCreate}>
          <UserPlus size={16} />
          Tambah Relawan
        </button>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.empty}>Memuat...</div>
        ) : list.length === 0 ? (
          <div className={styles.empty}>
            Belum ada relawan di registry. Klik &quot;Tambah Relawan&quot; untuk mulai.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>NAMA</th>
                <th>KONTAK</th>
                <th>TIM AKTIF</th>
                <th>STATUS</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {list.map((v) => (
                <tr key={v._id} className={!v.isActive ? styles.rowInactive : ""}>
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
                    <div className={styles.contactCell}>
                      {v.phone ? (
                        <span>
                          <Phone size={11} /> {v.phone}
                        </span>
                      ) : null}
                      {v.email ? (
                        <span>
                          <Mail size={11} /> {v.email}
                        </span>
                      ) : null}
                      {!v.phone && !v.email ? (
                        <span className={styles.muted}>—</span>
                      ) : null}
                    </div>
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
      </AdminModal>
    </div>
  );
}
