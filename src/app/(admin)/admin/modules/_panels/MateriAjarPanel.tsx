"use client";

import { useEffect, useMemo, useState } from "react";
import { Pencil, Trash2, ExternalLink, FileText, Plus } from "lucide-react";
import styles from "../modules.module.css";
import panelStyles from "./materiAjarPanel.module.css";
import { formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";
import DeleteConfirmModal from "@/components/admin/DeleteConfirmModal/DeleteConfirmModal";
import Toast from "@/components/toast/Toast";
import MateriAjarModal, {
  type MateriAjarItem,
} from "@/components/admin/MateriAjarModal/MateriAjarModal";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";

function shortUrl(url: string) {
  try {
    const u = new URL(url);
    const path = u.pathname.length > 1 ? u.pathname.slice(0, 24) + (u.pathname.length > 24 ? "…" : "") : "";
    return u.host + path;
  } catch {
    return url.length > 38 ? url.slice(0, 38) + "…" : url;
  }
}

function isUploadedFile(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return host === "ufs.sh" || host.endsWith(".ufs.sh");
  } catch {
    return false;
  }
}

export default function MateriAjarPanel() {
  const semesterLabels = useSemesterLabels();
  const [items, setItems] = useState<MateriAjarItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<MateriAjarItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MateriAjarItem | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [filterSub, setFilterSub] = useState("ALL");
  const [selectedSemester, setSelectedSemester] = useState("ALL");

  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  const showToast = (message: string, type: "success" | "error" = "success") =>
    setToast({ message, type });

  const fetchItems = async () => {
    try {
      const res = await fetch("/api/admin/materi-ajar");
      if (res.ok) {
        const data = await res.json();
        setItems(data.items || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data materi ajar", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchGlobal = async () => {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
        if (data.activeSemester) setSelectedSemester(data.activeSemester);
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
        if (data.availableSubjects) setAvailableSubjects(data.availableSubjects);
      }
    };
    queueMicrotask(() => {
      fetchGlobal();
      fetchItems();
    });
  }, []);

  const handleAdd = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (item: MateriAjarItem) => {
    setEditing(item);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`/api/admin/materi-ajar/${deleteTarget._id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setItems((prev) => prev.filter((i) => i._id !== deleteTarget._id));
        showToast("Materi ajar berhasil dihapus");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menghapus materi ajar", "error");
      }
    } catch {
      showToast("Terjadi kesalahan koneksi", "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const filtered = useMemo(() => {
    return items.filter((m) => {
      const matchSearch =
        m.title.toLowerCase().includes(search.toLowerCase()) ||
        (m.description || "").toLowerCase().includes(search.toLowerCase());
      const matchLevel = filterLevel === "ALL" || m.fase === filterLevel;
      const matchSub = filterSub === "ALL" || m.subject === filterSub;
      const matchSem =
        selectedSemester === "ALL" || !m.semester || m.semester === selectedSemester;
      return matchSearch && matchLevel && matchSub && matchSem;
    });
  }, [items, search, filterLevel, filterSub, selectedSemester]);

  const uniqueSubjects = useMemo(() => {
    const active = items.map((m) => m.subject).filter((s): s is string => Boolean(s));
    return Array.from(new Set([...availableSubjects, ...active])).sort();
  }, [items, availableSubjects]);

  const uniquePhases = useMemo(() => {
    const active = items.map((m) => m.fase).filter((f): f is string => Boolean(f));
    return Array.from(new Set([...availableLevels, ...active])).sort();
  }, [items, availableLevels]);

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat materi ajar...</p>
      </div>
    );
  }

  return (
    <div>
      <div className={styles.toolbar}>
        <div className={styles.leftTools}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Cari judul materi..."
              className={styles.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className={styles.filters}>
            <AdminFilterSelect
              value={filterLevel === "ALL" ? "" : filterLevel}
              onChange={(v) => setFilterLevel(v === "" ? "ALL" : v)}
              options={uniquePhases}
              clearable
              clearLabel="Semua Fase"
              placeholder="Semua Fase"
            />

            <AdminFilterSelect
              value={filterSub === "ALL" ? "" : filterSub}
              onChange={(v) => setFilterSub(v === "" ? "ALL" : v)}
              options={uniqueSubjects}
              clearable
              clearLabel="Semua Mata Pelajaran"
              placeholder="Semua Mata Pelajaran"
            />

            <AdminFilterSelect
              value={selectedSemester === "ALL" ? "" : selectedSemester}
              onChange={(v) => setSelectedSemester(v === "" ? "ALL" : v)}
              options={availableSemesters.map((s) => ({
                value: s,
                label: formatSemester(s, semesterLabels),
              }))}
              clearable
              clearLabel="Semua Semester"
              placeholder="Semua Semester"
            />
          </div>
        </div>

        <div className={panelStyles.toolbarRight}>
          <div className={panelStyles.resultsCountSm}>
            <strong>{filtered.length}</strong> materi
          </div>
          <button type="button" className={panelStyles.btnAddSm} onClick={handleAdd}>
            <Plus size={14} />
            Tambah Materi
          </button>
        </div>
      </div>

      <div className={panelStyles.tableWrap}>
        {filtered.length === 0 ? (
          <div className={panelStyles.empty}>
            Belum ada materi ajar yang cocok. Klik <strong>Tambah Materi</strong> untuk
            mulai menambahkan.
          </div>
        ) : (
          <table className={panelStyles.table}>
            <thead>
              <tr>
                <th>JUDUL MATERI</th>
                <th>FASE</th>
                <th>MATA PELAJARAN</th>
                <th>BULAN</th>
                <th>FILE / LINK</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m._id}>
                  <td>
                    <div className={panelStyles.titleCell}>
                      <div className={panelStyles.titleText}>{m.title}</div>
                      {m.description && (
                        <div className={panelStyles.descText}>{m.description}</div>
                      )}
                    </div>
                  </td>
                  <td>
                    <span className={panelStyles.subBadge}>{m.fase || "-"}</span>
                  </td>
                  <td>
                    <span className={panelStyles.subBadge}>{m.subject || "-"}</span>
                  </td>
                  <td>
                    {(typeof m.month === "number" && m.month >= 1 && m.month <= 12)
                      ? ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"][m.month - 1]
                      : (m.week ? `Pekan ${m.week}` : "-")}
                  </td>
                  <td>
                    {m.fileUrl ? (
                      <a
                        href={m.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${panelStyles.fileLink} ${isUploadedFile(m.fileUrl) ? panelStyles.uploadedFile : ""}`}
                        title={m.fileUrl}
                      >
                        {isUploadedFile(m.fileUrl) ? <FileText size={15} /> : <ExternalLink size={14} />}
                        <span className={panelStyles.urlPreview}>
                          {isUploadedFile(m.fileUrl) ? "File Upload" : shortUrl(m.fileUrl)}
                        </span>
                      </a>
                    ) : (
                      <span className={panelStyles.muted}>-</span>
                    )}
                  </td>
                  <td>
                    <div className={panelStyles.actions}>
                      <button
                        type="button"
                        className={panelStyles.btnIcon}
                        onClick={() => handleEdit(m)}
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${panelStyles.btnIcon} ${panelStyles.btnIconDanger}`}
                        onClick={() => setDeleteTarget(m)}
                        title="Hapus"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <MateriAjarModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          showToast(editing ? "Materi ajar berhasil diperbarui" : "Materi ajar berhasil ditambahkan");
          fetchItems();
        }}
        itemToEdit={editing}
      />

      <DeleteConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Hapus Materi Ajar"
        message={`Yakin mau hapus materi "${deleteTarget?.title || ""}"? File upload ikut dihapus; link eksternal tidak terpengaruh.`}
      />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
