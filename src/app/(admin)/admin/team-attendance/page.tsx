"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  X,
  Users,
  RefreshCw,
  Clock,
  AlertTriangle,
  Unlock,
  History,
  Pencil,
  Save,
  Camera,
} from "lucide-react";
import styles from "./teamAttendance.module.css";
import { useDialog } from "@/components/ui/DialogProvider";

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
  const { showConfirm } = useDialog();
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
  const totalPages = Math.ceil(records.length / itemsPerPage);

  useEffect(() => {
    setPage(1);
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
      late = 0,
      unlocked = 0,
      frequentEdits = 0;
    for (const r of records) {
      if (r.status === "HADIR") hadir++;
      if (r.anomaly.lateInput) late++;
      if (r.anomaly.unlocked) unlocked++;
      if (r.anomaly.frequentEdits) frequentEdits++;
    }
    return { total, hadir, late, unlocked, frequentEdits };
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

  const handleUnlock = async () => {
    if (!selected) return;
    const isConfirmed = await showConfirm(
      "Buka kunci pertemuan ini? FASILITATOR akan bisa edit attendance walau di luar window.",
      "Unlock Pertemuan"
    );
    if (!isConfirmed) return;
    try {
      const res = await fetch("/api/admin/team-attendance/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: selected.team.id,
          scheduleId: selected.scheduleId,
          week: selected.week,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setDrawerFeedback({
          type: "err",
          text: body.error || "Gagal unlock",
        });
        return;
      }
      setDrawerFeedback({
        type: "ok",
        text: body.message || "Pertemuan di-unlock",
      });
      fetchRecords();
    } catch {
      setDrawerFeedback({ type: "err", text: "Gagal unlock" });
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Kehadiran Tim Relawan</h1>
        <p className={styles.subtitle}>
          Monitoring kehadiran anggota tim per pertemuan. Klik baris untuk
          lihat audit trail, edit, atau unlock pertemuan.
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
            <option value="">Semua semester</option>
            {availableSemesters.map((s) => (
              <option key={s} value={s}>
                {s}
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
          <label className={styles.fieldLabel}>Pekan</label>
          <input
            className={styles.input}
            type="number"
            min={1}
            placeholder="contoh: 3"
            value={filters.week}
            onChange={(e) =>
              setFilters({ ...filters, week: e.target.value })
            }
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
      </div>

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <div className={styles.statLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Users size={14} /> Total record
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
            <Clock size={14} /> Telat input ({">24h"})
          </div>
          <div
            className={`${styles.statValue} ${summary.late > 0 ? styles.statValueAlert : ""}`}
          >
            {summary.late}
          </div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Unlock size={14} /> Unlocked admin
          </div>
          <div
            className={`${styles.statValue} ${summary.unlocked > 0 ? styles.statValueAlert : ""}`}
          >
            {summary.unlocked}
          </div>
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
          <div className={styles.empty}>Memuat...</div>
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
                <th>ANOMALI</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRecords.map((r) => (
                <tr
                  key={r._id}
                  className={styles.row}
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
                        styles[`status${r.status}`] ?? ""
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
                  <td>
                    <div className={styles.anomalyGroup}>
                      {r.anomaly.lateInput && (
                        <span className={styles.anomalyBadge}>
                          <Clock size={10} /> Telat
                        </span>
                      )}
                      {r.anomaly.frequentEdits && (
                        <span
                          className={`${styles.anomalyBadge} ${styles.warn}`}
                        >
                          <Pencil size={10} /> Sering edit
                        </span>
                      )}
                      {r.anomaly.unlocked && (
                        <span
                          className={`${styles.anomalyBadge} ${styles.info}`}
                        >
                          <Unlock size={10} /> Unlocked
                        </span>
                      )}
                      {!r.anomaly.lateInput &&
                        !r.anomaly.frequentEdits &&
                        !r.anomaly.unlocked && (
                          <span
                            style={{ fontSize: 11, color: "#94a3b8" }}
                          >
                            —
                          </span>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {(() => {
        const pages = [];
        if (totalPages <= 7) {
          for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
          if (page <= 4) {
            pages.push(1, 2, 3, 4, 5, 'jump-next', totalPages);
          } else if (page >= totalPages - 3) {
            pages.push(1, 'jump-prev', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
          } else {
            pages.push(1, 'jump-prev', page - 1, page, page + 1, 'jump-next', totalPages);
          }
        }
        
        return (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0px", padding: "16px 24px", borderTop: "1px solid #f1f5f9", background: "#f8fafc", borderRadius: "0 0 12px 12px" }}>
            <span style={{ fontSize: "13px", fontWeight: "500", color: "#64748b" }}>
              Menampilkan data <strong style={{ color: "#0f172a" }}>{(page - 1) * itemsPerPage + 1}</strong> - <strong style={{ color: "#0f172a" }}>{Math.min(page * itemsPerPage, records.length)}</strong> dari <strong style={{ color: "#0f172a" }}>{records.length}</strong>
            </span>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ padding: "6px 12px", fontSize: "13px", fontWeight: "600", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === 1 ? "#f1f5f9" : "#fff", color: page === 1 ? "#94a3b8" : "#334155", cursor: page === 1 ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              >
                ‹ Prev
              </button>
              
              {pages.map((p, idx) => {
                if (p === 'jump-prev' || p === 'jump-next') {
                  return (
                    <span
                      key={idx}
                      style={{ padding: "6px 4px", fontSize: "13px", color: "#94a3b8", letterSpacing: "2px" }}
                    >
                      •••
                    </span>
                  );
                }
                return (
                  <button
                    key={idx}
                    onClick={() => typeof p === 'number' && setPage(p)}
                    style={{ 
                      padding: "6px 12px", minWidth: "32px", fontSize: "13px", 
                      fontWeight: p === page ? "600" : "500", 
                      borderRadius: "6px", 
                      border: "1px solid", 
                      borderColor: p === page ? "#F58220" : "#e2e8f0", 
                      background: p === page ? "#F58220" : "#fff", 
                      color: p === page ? "#fff" : "#334155", 
                      cursor: "pointer",
                      transition: "all 0.2s"
                    }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ padding: "6px 12px", fontSize: "13px", fontWeight: "600", borderRadius: "6px", border: "1px solid #e2e8f0", background: page === totalPages ? "#f1f5f9" : "#fff", color: page === totalPages ? "#94a3b8" : "#334155", cursor: page === totalPages ? "not-allowed" : "pointer", transition: "all 0.2s" }}
              >
                Next ›
              </button>

              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "12px", paddingLeft: "12px", borderLeft: "1px solid #cbd5e1" }}>
                <span style={{ fontSize: "13px", color: "#64748b" }}>Ke hal:</span>
                <select 
                  value={page} 
                  onChange={(e) => setPage(Number(e.target.value))}
                  style={{ padding: "4px 24px 4px 8px", fontSize: "13px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "#fff", cursor: "pointer", appearance: "auto" }}
                >
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        );
      })()}

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
                <Unlock size={13} /> Unlock Pertemuan
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 8 }}>
                Buka kunci untuk seluruh pertemuan ini (tim {selected.team.teamName}
                , Pekan {selected.week}). FASILITATOR bisa edit walau di luar
                window.
              </div>
              <button className={styles.unlockBtn} onClick={handleUnlock}>
                <Unlock size={12} />
                Unlock Pertemuan
              </button>

              {selected.anomaly.unlocked && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 11,
                    color: "#1d4ed8",
                  }}
                >
                  ✓ Pertemuan ini sudah di-unlock sebelumnya.
                </div>
              )}

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
