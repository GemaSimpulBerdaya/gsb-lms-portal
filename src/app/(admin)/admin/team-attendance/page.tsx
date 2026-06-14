"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  X,
  Users,
  RefreshCw,
  AlertTriangle,
  History,
  Pencil,
  Save,
  Camera,
} from "lucide-react";
import styles from "./teamAttendance.module.css";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import { formatSemester, getCurrentSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import Spinner from "@/components/ui/Spinner/Spinner";

type Status = "HADIR" | "IZIN" | "SAKIT" | "ALFA";
type Role = "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI";
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
  relawanId: string;
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
  volunteer: { id: string; name?: string; isActive?: boolean };
  anomaly: { lateInput: boolean; frequentEdits: boolean; unlocked: boolean };
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
        setTeams(t.volunteers || []);
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
      late = 0,
      frequentEdits = 0;
    for (const r of records) {
      if (r.status === "HADIR") hadir++;
      if (r.status === "IZIN") izin++;
      if (r.status === "ALFA") alpa++;
      if (r.anomaly.lateInput) late++;
      if (r.anomaly.frequentEdits) frequentEdits++;
    }
    return { total, hadir, izin, alpa, late, frequentEdits };
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
          <h1 className={styles.title}>Kehadiran Relawan</h1>
          <p className={styles.subtitle}>
            Pantau kehadiran relawan, ubah status bila ada kesalahan, dan cek riwayat edit untuk keperluan forensik audit.
          </p>
      </div>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Semester</label>
          <select
            className={styles.select}
            value={filters.semester}
            onChange={(e) =>
              setFilters({ ...filters, semester: e.target.value })
            }
          >
            {availableSemesters.map((s) => (
              <option key={s} value={s}>
                {formatSemester(s, semesterLabels)}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Tim</label>
          <select
            className={styles.select}
            value={filters.teamId}
            onChange={(e) =>
              setFilters({ ...filters, teamId: e.target.value })
            }
          >
            <option value="">Semua tim</option>
            {teams.map((t) => (
              <option key={t._id} value={t._id}>
                {t.teamName || "(tanpa nama)"}{" "}
                {t.region ? `· ${t.region}` : ""}
              </option>
            ))}
          </select>
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

        <div className={styles.statCard}>
          <div className={styles.statLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <AlertTriangle size={14} /> Sering diedit
          </div>
          <div
            className={`${styles.statValue} ${summary.frequentEdits > 0 ? styles.statValueAlert : ""}`}
          >
            {summary.frequentEdits}
          </div>
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
                <th>TANGGAL</th>
                <th>TIM</th>
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
                    <strong>P{r.week}</strong>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {new Date(r.date).toLocaleDateString("id-ID", {
                        day: "2-digit",
                        month: "short",
                      })}
                    </div>
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
                <span className={styles.detailLabel}>Pertemuan</span>
                <span className={styles.detailValue}>
                  Pekan {selected.week} ·{" "}
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

              {selected.anomaly.lateInput && (
                <div className={styles.sectionH}>
                  <AlertTriangle size={13} /> Anomali
                </div>
              )}
              {selected.anomaly.lateInput && (
                <div
                  style={{
                    fontSize: 12,
                    color: "#b45309",
                    background: "#fffbeb",
                    border: "1px solid #fcd34d",
                    borderRadius: 8,
                    padding: 10,
                    lineHeight: 1.5,
                  }}
                >
                  <Camera
                    size={12}
                    style={{ display: "inline", marginRight: 4 }}
                  />
                  Input dilakukan{" "}
                  {Math.round(
                    (new Date(selected.markedAt).getTime() -
                      new Date(selected.date).getTime()) /
                      3600000,
                  )}{" "}
                  jam setelah jadwal. Cek apakah pertemuan benar-benar
                  berlangsung.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
