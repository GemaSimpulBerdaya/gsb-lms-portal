"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Save,
  Lock,
  AlertTriangle,
  Info,
  CheckCircle2,
} from "lucide-react";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useToast } from "@/components/toast/ToastProvider";
import styles from "./TeamAttendanceBlock.module.css";

type Status = "HADIR" | "IZIN" | "SAKIT" | "ALFA";
type Role = "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI";

const STATUSES: Status[] = ["HADIR", "IZIN", "SAKIT", "ALFA"];
const STATUS_CLASS: Partial<Record<Status, string>> = {
  HADIR: styles.statusBtnHadir,
  IZIN: styles.statusBtnIzin,
  SAKIT: styles.statusBtnSakit,
  ALFA: styles.statusBtnAlfa,
};
const ROLE_LABEL: Record<Role, string> = {
  FASILITATOR: "Fasilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
};
const ROLE_CLASS: Record<Role, string> = {
  FASILITATOR: styles.roleFAC,
  PENGAJAR: styles.rolePNG,
  DOKUMENTASI: styles.roleDOK,
};

interface MemberWithRecord {
  volunteerId: string;
  role: Role;
  name: string;
  status: Status;
  notes: string;
}

interface PreviewResponse {
  schedule: { id: string; semester: string; kbmDate: string; week: number };
  window: {
    inWindow: boolean;
    reason: "OK" | "TOO_EARLY";
    earliest: string;
    message: string;
  };
  members: { volunteerId: string; role: Role; joinedAt?: string; name: string }[];
  records: {
    _id: string;
    volunteerId: string;
    status: Status;
    notes?: string;
    unlockedByAdmin?: boolean;
  }[];
}

interface Props {
  scheduleId: string;
  week: number;
}

export default function TeamAttendanceBlock({ scheduleId, week }: Props) {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PreviewResponse | null>(null);
  const [members, setMembers] = useState<MemberWithRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchPreview = useCallback(async () => {
    if (!scheduleId || !week) return;
    setLoading(true);
    setFeedback(null);
    try {
      const res = await fetch(
        `/api/admin/team-attendance/input?scheduleId=${scheduleId}&week=${week}`,
      );
      const body = (await res.json()) as PreviewResponse | { error?: string };
      if (!res.ok) {
        setData(null);
        setMembers([]);
        setFeedback({
          type: "error",
          text:
            (body as { error?: string }).error ??
            "Gagal memuat data kehadiran tim",
        });
        return;
      }
      const preview = body as PreviewResponse;
      setData(preview);

      // Compose members + records. Nama sudah disertakan di payload server.
      const recordMap = new Map(
        preview.records.map((r) => [r.volunteerId, r]),
      );
      setMembers(
        preview.members.map((m) => {
          const rec = recordMap.get(m.volunteerId);
          return {
            volunteerId: m.volunteerId,
            role: m.role,
            name: m.name || "(tanpa nama)",
            status: (rec?.status as Status) ?? "HADIR",
            notes: rec?.notes ?? "",
          };
        }),
      );
    } catch {
      setFeedback({ type: "error", text: "Gagal memuat data kehadiran tim" });
    } finally {
      setLoading(false);
    }
  }, [scheduleId, week]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  const handleStatus = (volunteerId: string, status: Status) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.volunteerId === volunteerId ? { ...m, status } : m,
      ),
    );
  };
  const handleNotes = (volunteerId: string, notes: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.volunteerId === volunteerId ? { ...m, notes } : m,
      ),
    );
  };

  const recordsExist = (data?.records?.length ?? 0) > 0;
  const canSubmit =
    !loading &&
    !saving &&
    members.length > 0 &&
    !!data &&
    data.window.inWindow;

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/admin/team-attendance/input", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          week,
          members: members.map((m) => ({
            volunteerId: m.volunteerId,
            role: m.role,
            status: m.status,
            notes: m.notes,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const message = body.message || body.error || "Gagal menyimpan";
        setFeedback({ type: "error", text: message });
        showToast(message, "error");
        return;
      }
      const message = body.message || (recordsExist ? "Kehadiran tim berhasil diperbarui" : "Kehadiran tim berhasil disimpan");
      setFeedback({ type: "success", text: message });
      showToast(message, "success");
      // Refresh records biar UI sinkron dengan server (e.g. unlocked flag).
      fetchPreview();
    } catch {
      const message = "Terjadi kesalahan koneksi";
      setFeedback({ type: "error", text: message });
      showToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────
  const statusPill = () => {
    if (!data) return null;
    if (data.window.inWindow) {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillOpen}`}>
          <CheckCircle2 size={11} /> Window terbuka
        </span>
      );
    }
    if (data.window.reason === "TOO_EARLY") {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillLocked}`}>
          <Lock size={11} /> Belum dibuka
        </span>
      );
    }
    return null;
  };

  const summary = () => {
    if (members.length === 0) return null;
    const c: Record<Status, number> = {
      HADIR: 0,
      IZIN: 0,
      SAKIT: 0,
      ALFA: 0,
    };
    for (const m of members) c[m.status]++;
    return (
      <div className={styles.summary}>
        <span>
          <strong>{c.HADIR}</strong> Hadir
        </span>
        <span>
          <strong>{c.IZIN}</strong> Izin
        </span>
        <span>
          <strong>{c.SAKIT}</strong> Sakit
        </span>
        <span>
          <strong>{c.ALFA}</strong> Alfa
        </span>
      </div>
    );
  };

  return (
    <div className={styles.block}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.iconCircle}>
            <Users size={18} />
          </div>
          <div className={styles.titleWrap}>
            <span className={styles.title}>Input Presensi Relawan</span>
            <span className={styles.subtitle}>
              {data
                ? `Pekan ${data.schedule.week} · ${new Date(data.schedule.kbmDate).toLocaleDateString(
                    "id-ID",
                    { dateStyle: "long" },
                  )}`
                : "Memuat..."}
            </span>
          </div>
        </div>
        {statusPill()}
      </div>

      <div className={styles.body}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat data kehadiran tim...</p>
          </div>
        ) : !data ? (
          <div className={styles.empty}>
            {feedback?.text ?? "Tidak ada data."}
          </div>
        ) : members.length === 0 ? (
          <div className={styles.empty}>
            <p>Tim ini belum punya anggota.</p>
            <p style={{ fontSize: 11, marginTop: 6 }}>
              Daftarkan anggota tim melalui menu Anggota Tim.
            </p>
          </div>
        ) : (
          <>
            {/* L1: time window notice (soft) */}
            {!data.window.inWindow && data.window.reason === "TOO_EARLY" && (
              <div className={`${styles.notice} ${styles.noticeError}`}>
                <Lock size={14} />
                <span>
                  <strong>Belum bisa diisi.</strong> {data.window.message}
                </span>
              </div>
            )}
            {data.window.inWindow && !recordsExist && (
              <div className={`${styles.notice} ${styles.noticeOk}`}>
                <Info size={14} />
                <span>
                  Pilih tombol status tiap anggota lalu simpan. Default semua HADIR
                  — ubah status anggota yang tidak hadir saja.
                </span>
              </div>
            )}

            <div className={styles.list}>
              {members.map((m) => {
                const disabled =
                  !data.window.inWindow && data.window.reason === "TOO_EARLY";
                return (
                  <div
                    key={m.volunteerId}
                    className={`${styles.row} ${disabled ? styles.rowDisabled : ""}`}
                  >
                    <div className={styles.memberInfo}>
                      <div className={styles.avatar}>
                        {(m.name || "?").charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className={styles.memberName} title={m.name}>
                          {m.name}
                        </div>
                        <span
                          className={`${styles.memberRole} ${ROLE_CLASS[m.role]}`}
                        >
                          {ROLE_LABEL[m.role]}
                        </span>
                      </div>
                    </div>

                    <div className={styles.statusGroup}>
                      {STATUSES.map((s) => {
                        const active = m.status === s;
                        const extraClass = STATUS_CLASS[s] ?? "";
                        return (
                          <button
                            key={s}
                            type="button"
                            className={`${styles.statusBtn} ${extraClass} ${active ? styles.statusBtnActive : ""}`}
                            onClick={() => handleStatus(m.volunteerId, s)}
                            disabled={disabled}
                          >
                            {s}
                          </button>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      className={styles.notesInput}
                      placeholder="Catatan"
                      value={m.notes}
                      onChange={(e) =>
                        handleNotes(m.volunteerId, e.target.value)
                      }
                      disabled={disabled}
                    />
                  </div>
                );
              })}
            </div>

            <div className={styles.footer}>
              {summary()}
              <div
                className={styles.footerActions}
              >
                {feedback?.type === "success" && (
                  <span className={styles.savedNote}>
                    ✓ {feedback.text}
                  </span>
                )}
                {feedback?.type === "error" && (
                  <span
                    className={styles.savedError}
                  >
                    <AlertTriangle
                      size={11}
                      style={{ display: "inline", marginRight: 3 }}
                    />
                    {feedback.text}
                  </span>
                )}
                <button
                  type="button"
                  className={styles.saveBtn}
                  onClick={handleSave}
                  disabled={!canSubmit}
                >
                  <Save size={14} />
                  {saving
                    ? "Menyimpan..."
                    : recordsExist
                      ? "Update Kehadiran Tim"
                      : "Simpan Kehadiran Tim"}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
