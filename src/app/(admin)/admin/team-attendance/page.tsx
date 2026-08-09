"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import {
  X,
  Users,
  RefreshCw,
  History,
  Pencil,
  Save,
  Download,
} from "lucide-react";
import * as XLSX from "xlsx";
import styles from "./teamAttendance.module.css";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import { formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";
import AdminTeamAttendanceInput from "@/components/admin/AdminTeamAttendanceInput";

type Status = "HADIR" | "IZIN" | "SAKIT" | "ALFA";
type Role = "KETUA_DIVISI" | "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI";
const STATUSES: Status[] = ["HADIR", "IZIN", "SAKIT", "ALFA"];

interface EditHistoryEntry {
  at: string;
  by: string;
  prevStatus: Status;
  newStatus: Status;
  prevNotes?: string;
  newNotes?: string;
  ip?: string;
  userAgent?: string;
}

interface RecordItem {
  _id: string;
  teamAccountId: string;
  scheduleId: string;
  week: number;
  semester: string;
  date: string;
  volunteerId: string;
  role: Role;
  status: Status;
  notes?: string;
  markedBy: string;
  markedAt: string;
  markedFromIp?: string;
  userAgent?: string;
  unlockedByAdmin?: boolean;
  editHistory?: EditHistoryEntry[];
  team: { id: string; teamName?: string; region?: string };
  schedule: { id: string; region?: string; fase?: string };
  volunteer: { id: string; name?: string; isActive?: boolean };
  anomaly: { frequentEdits: boolean; unlocked: boolean };
}

interface Filters {
  semester: string;
  teamId: string;
  week: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  semester: "",
  teamId: "",
  week: "",
  from: "",
  to: "",
};

export default function AdminTeamAttendancePage() {
  const semesterLabels = useSemesterLabels();
  const [activeTab, setActiveTab] = useState<"input" | "history">("input");
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [teams, setTeams] = useState<
    { _id: string; teamName?: string; region?: string }[]
  >([]);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);

  const [selected, setSelected] = useState<RecordItem | null>(null);
  const [editStatus, setEditStatus] = useState<Status>("HADIR");
  const [editNotes, setEditNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [drawerFeedback, setDrawerFeedback] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [records]);

  const paginatedRecords = records.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const fetchInit = useCallback(async () => {
    try {
      const [setRes, teamsRes] = await Promise.all([
        fetch("/api/admin/settings"),
        fetch("/api/admin/volunteers"),
      ]);
      if (setRes.ok) {
        const s = await setRes.json();
        setAvailableSemesters(s.availableSemesters || []);
        if (s.activeSemester && !filters.semester) {
          setFilters((f) => ({ ...f, semester: s.activeSemester }));
        }
      }
      if (teamsRes.ok) {
        const t = await teamsRes.json();
        setTeams(t.teamAccounts || t.volunteers || []);
      }
    } catch (err) {
      console.error("Init error:", err);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.semester) params.set("semester", filters.semester);
      if (filters.teamId) params.set("teamId", filters.teamId);
      if (filters.week) params.set("week", filters.week);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      const res = await fetch(
        `/api/admin/team-attendance?${params.toString()}`,
      );
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error("Fetch records error:", err);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchInit();
  }, [fetchInit]);

  useEffect(() => {
    const t = setTimeout(fetchRecords, 200);
    return () => clearTimeout(t);
  }, [fetchRecords]);

  const summary = useMemo(() => {
    const total = records.length;
    let hadir = 0,
      izin = 0,
      alpa = 0,
      frequentEdits = 0;
    for (const r of records) {
      if (r.status === "HADIR") hadir++;
      if (r.status === "IZIN") izin++;
      if (r.status === "ALFA") alpa++;
      if (r.anomaly.frequentEdits) frequentEdits++;
    }
    return { total, hadir, izin, alpa, frequentEdits };
  }, [records]);

  const openDrawer = (r: RecordItem) => {
    setSelected(r);
    setEditStatus(r.status);
    setEditNotes(r.notes ?? "");
    setDrawerFeedback(null);
  };

  const handleSaveEdit = async () => {
    if (!selected) return;
    setEditing(true);
    setDrawerFeedback(null);
    try {
      const res = await fetch("/api/admin/team-attendance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: selected._id,
          status: editStatus,
          notes: editNotes,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setDrawerFeedback({
          type: "err",
          text: body.error || "Gagal update",
        });
        return;
      }
      setDrawerFeedback({ type: "ok", text: "Tersimpan" });
      fetchRecords();
      // Update local selected dengan data baru.
      if (body.record) setSelected({ ...selected, ...body.record });
    } catch {
      setDrawerFeedback({ type: "err", text: "Gagal update" });
    } finally {
      setEditing(false);
    }
  };

  const handleExportExcel = () => {
    if (records.length === 0) return;
    const rows = records.map((record) => ({
      Semester: record.semester,
      Pekan: record.week,
      Tanggal: new Date(record.date).toLocaleDateString("id-ID"),
      Tim: record.team.teamName || "-",
      Jadwal: `${record.schedule.region || "-"} — ${record.schedule.fase || "-"}`,
      Relawan: record.volunteer.name || "-",
      Peran: record.role,
      Status: record.status,
      Catatan: record.notes || "-",
      "Waktu Input": new Date(record.markedAt).toLocaleString("id-ID"),
      "Jumlah Edit": record.editHistory?.length ?? 0,
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    sheet["!cols"] = [
      { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 24 }, { wch: 22 },
      { wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 36 }, { wch: 22 }, { wch: 12 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, "Kehadiran Relawan");
    const period = filters.from && filters.to ? `${filters.from}_${filters.to}` : filters.semester || "semua";
    XLSX.writeFile(workbook, `Kehadiran Relawan ${period}.xlsx`);
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
          <h1 className={styles.title}>Presensi Relawan</h1>
          <p className={styles.subtitle}>
            Input dan pantau presensi relawan per pertemuan. Semua perubahan tercatat dalam riwayat audit.
          </p>
      </div>

      <div className={styles.tabBar} role="tablist" aria-label="Menu Presensi Relawan">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "input"}
          className={`${styles.tabBtn} ${activeTab === "input" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("input")}
        >
          Input Presensi
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "history"}
          className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabBtnActive : ""}`}
          onClick={() => setActiveTab("history")}
        >
          Riwayat Presensi
        </button>
      </div>

      {activeTab === "input" ? (
        <AdminTeamAttendanceInput
          semester={filters.semester}
          semesterOptions={availableSemesters.map((semester) => ({
            value: semester,
            label: formatSemester(semester, semesterLabels),
          }))}
          onSemesterChange={(semester) => setFilters({ ...filters, semester })}
        />
      ) : (
        <>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Semester</label>
          <AdminFilterSelect
            width="fluid"
            value={filters.semester}
            onChange={(semester) => setFilters({ ...filters, semester })}
            options={availableSemesters.map((semester) => ({
              value: semester,
              label: formatSemester(semester, semesterLabels),
            }))}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tim</label>
          <AdminFilterSelect
            width="fluid"
            value={filters.teamId}
            onChange={(v) => setFilters({ ...filters, teamId: v })}
            placeholder="Semua tim"
            clearable
            clearLabel="Semua tim"
            options={teams.map((t) => ({
              value: t._id,
              label: `${t.teamName || "(tanpa nama)"}${t.region ? ` · ${t.region}` : ""}`,
            }))}
          />
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Dari</label>
          <input
            className={styles.input}
            type="date"
            value={filters.from}
            onChange={(e) =>
              setFilters({ ...filters, from: e.target.value })
            }
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Sampai</label>
          <input
            className={styles.input}
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        <button className={styles.refreshBtn} onClick={fetchRecords}>
          <RefreshCw size={14} />
          Refresh
        </button>
        <button className={styles.exportBtn} onClick={handleExportExcel} disabled={loading || records.length === 0}>
          <Download size={14} />
          Export
        </button>
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={14} /> Total Kehadiran
          </div>
          <div className={styles.statValue}>{summary.total}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981" }}></div> Hadir
          </div>
          <div className={styles.statValue}>{summary.hadir}</div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f59e0b" }}></div> Izin
          </div>
          <div className={styles.statValue}>{summary.izin}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ef4444" }}></div> Alpa
          </div>
          <div className={styles.statValue}>{summary.alpa}</div>
        </div>
      </div>

      <div className={styles.tableCard}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat data kehadiran tim...</p>
          </div>
        ) : records.length === 0 ? (
          <div className={styles.empty}>
            Belum ada data kehadiran tim sesuai filter.
          </div>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>PEKAN</th>
                <th>TANGGAL</th>
                <th>TIM</th>
                <th>JADWAL</th>
                <th>ANGGOTA</th>
                <th>ROLE</th>
                <th>STATUS</th>
                <th>DI-INPUT</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((r) => (
                <tr
                  key={`${page}-${r._id}`}
                  className={`${styles.row} admin-page-row`}
                  onClick={() => openDrawer(r)}
                >
                  <td>
                    <strong>Pekan {r.week}</strong>
                  </td>
                  <td>
                    {new Date(r.date).toLocaleDateString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {r.team.teamName || "(tanpa nama)"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {r.team.region}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>
                      {r.schedule.region || "-"}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {r.schedule.fase || "-"}
                    </div>
                  </td>
                  <td>
                    {r.volunteer.name ?? (
                      <span style={{ color: "#94a3b8" }}>(tidak ditemukan)</span>
                    )}
                    {r.volunteer.isActive === false && (
                      <span
                        style={{
                          marginLeft: 6,
                          fontSize: 10,
                          color: "#94a3b8",
                          background: "#f1f5f9",
                          padding: "1px 6px",
                          borderRadius: 999,
                        }}
                      >
                        non-aktif
                      </span>
                    )}
                  </td>
                  <td style={{ fontSize: 11, color: "#475569" }}>
                    {r.role}
                  </td>
                  <td>
                    <span
                      className={`${styles.statusBadge} ${
                        styles[`status${r.status}`] || ""
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: "#475569" }}>
                    {new Date(r.markedAt).toLocaleString("id-ID", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AdminPagination
        page={page}
        totalItems={records.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
      />

      {selected && (
        <>
          <div
            className={styles.drawerOverlay}
            onClick={() => setSelected(null)}
          />
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div>
                <h3>Detail Kehadiran</h3>
                <div className={styles.drawerSub}>
                  {selected.volunteer.name ?? "(tanpa nama)"} ·{" "}
                  {selected.role}
                </div>
              </div>
              <button
                className={styles.closeBtn}
                onClick={() => setSelected(null)}
              >
                <X size={16} />
              </button>
            </div>

            <div className={styles.drawerBody}>
              {drawerFeedback && (
                <div
                  className={`${styles.feedback} ${drawerFeedback.type === "ok" ? styles.feedbackOk : styles.feedbackErr}`}
                >
                  {drawerFeedback.text}
                </div>
              )}

              <div className={styles.detailGrid}>
                <span className={styles.detailLabel}>Tim</span>
                <span className={styles.detailValue}>
                  {selected.team.teamName || "—"}{" "}
                  {selected.team.region ? `(${selected.team.region})` : ""}
                </span>
                <span className={styles.detailLabel}>Jadwal</span>
                <span className={styles.detailValue}>
                  {selected.schedule.region || "—"} · {selected.schedule.fase || "—"}
                </span>
                <span className={styles.detailLabel}>Pekan</span>
                <span className={styles.detailValue}>
                  Pekan {selected.week}
                </span>
                <span className={styles.detailLabel}>Tanggal</span>
                <span className={styles.detailValue}>
                  {new Date(selected.date).toLocaleDateString("id-ID", {
                    dateStyle: "long",
                  })}
                </span>
                <span className={styles.detailLabel}>Semester</span>
                <span className={styles.detailValue}>
                  {selected.semester}
                </span>
                <span className={styles.detailLabel}>Status sekarang</span>
                <span className={styles.detailValue}>
                  <span
                    className={`${styles.statusBadge} ${styles[`status${selected.status}`]}`}
                  >
                    {selected.status}
                  </span>
                </span>
                <span className={styles.detailLabel}>Catatan</span>
                <span className={styles.detailValue}>
                  {selected.notes || "—"}
                </span>
                <span className={styles.detailLabel}>Di-input</span>
                <span className={styles.detailValue}>
                  {new Date(selected.markedAt).toLocaleString("id-ID")}
                </span>
                <span className={styles.detailLabel}>IP</span>
                <span className={styles.detailValue}>
                  {selected.markedFromIp || "—"}
                </span>
                <span className={styles.detailLabel}>User Agent</span>
                <span
                  className={styles.detailValue}
                  style={{ fontSize: 10, wordBreak: "break-all" }}
                >
                  {selected.userAgent || "—"}
                </span>
              </div>

              <div className={styles.sectionH}>
                <Pencil size={13} /> Override Status
              </div>
              <div className={styles.editBox}>
                <div className={styles.editFieldRow}>
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={`${styles.editStatusBtn} ${editStatus === s ? styles.active : ""}`}
                      onClick={() => setEditStatus(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <textarea
                  className={styles.editTextarea}
                  placeholder="Catatan (opsional)"
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
                <div className={styles.editFooter}>
                  <button
                    type="button"
                    className={`${styles.editBtn} ${styles.editBtnPrimary}`}
                    onClick={handleSaveEdit}
                    disabled={
                      editing ||
                      (editStatus === selected.status &&
                        editNotes === (selected.notes ?? ""))
                    }
                  >
                    <Save
                      size={12}
                      style={{ display: "inline", marginRight: 4 }}
                    />
                    {editing ? "Menyimpan..." : "Simpan Override"}
                  </button>
                </div>
              </div>

              <div className={styles.sectionH}>
                <History size={13} /> Riwayat Edit (
                {selected.editHistory?.length ?? 0})
              </div>
              {!selected.editHistory ||
              selected.editHistory.length === 0 ? (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>
                  Belum pernah diedit.
                </div>
              ) : (
                <div className={styles.history}>
                  {[...selected.editHistory]
                    .reverse()
                    .map((h, i) => (
                      <div key={i} className={styles.historyItem}>
                        <span>
                          <strong>{h.prevStatus}</strong> →{" "}
                          <strong>{h.newStatus}</strong>
                        </span>
                        {h.prevNotes !== h.newNotes && (
                          <div>
                            Catatan:{" "}
                            <em>
                              &quot;{h.prevNotes ?? ""}&quot;
                            </em>{" "}
                            → <em>&quot;{h.newNotes ?? ""}&quot;</em>
                          </div>
                        )}
                        <div className={styles.historyMeta}>
                          {new Date(h.at).toLocaleString("id-ID")}{" "}
                          {h.ip ? `· IP ${h.ip}` : ""}
                        </div>
                      </div>
                    ))}
                </div>
              )}

            </div>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}
