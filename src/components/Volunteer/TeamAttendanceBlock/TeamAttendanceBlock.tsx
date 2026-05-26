"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Save,
  Lock,
  Unlock,
  AlertTriangle,
  Camera,
  Info,
  CheckCircle2,
} from "lucide-react";
import styles from "./TeamAttendanceBlock.module.css";

type Status = "HADIR" | "IZIN" | "SAKIT" | "ALFA";
type Role = "FACILITATOR" | "PENGAJAR" | "DOKUMENTASI";

const STATUSES: Status[] = ["HADIR", "IZIN", "SAKIT", "ALFA"];
const ROLE_LABEL: Record<Role, string> = {
  FACILITATOR: "Facilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
};
const ROLE_CLASS: Record<Role, string> = {
  FACILITATOR: styles.roleFAC,
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
    reason: "OK" | "TOO_EARLY" | "TOO_LATE";
    earliest: string;
    latest: string;
    message: string;
  };
  photoUploaded: boolean;
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
        `/api/volunteer/team-attendance?scheduleId=${scheduleId}&week=${week}`,
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
  const anyUnlocked =
    data?.records?.some((r) => r.unlockedByAdmin) ?? false;
  const canSubmit =
    !loading &&
    !saving &&
    members.length > 0 &&
    !!data &&
    (data.window.inWindow || anyUnlocked) &&
    data.photoUploaded;

  const handleSave = async () => {
    if (!data) return;
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/volunteer/team-attendance", {
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
        setFeedback({
          type: "error",
          text: body.message || body.error || "Gagal menyimpan",
        });
        return;
      }
      setFeedback({ type: "success", text: body.message || "Tersimpan" });
      // Refresh records biar UI sinkron dengan server (e.g. unlocked flag).
      fetchPreview();
    } catch {
      setFeedback({ type: "error", text: "Terjadi kesalahan koneksi" });
    } finally {
      setSaving(false);
    }
  };

  // ── Render helpers ──────────────────────────────────────
  const statusPill = () => {
    if (!data) return null;
    if (anyUnlocked) {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillOpen}`}>
          <Unlock size={11} /> Diunlock admin
        </span>
      );
    }
    if (data.window.inWindow) {
      return (
        <span className={`${styles.statusPill} ${styles.statusPillOpen}`}>
          <CheckCircle2 size={11} /> Window terbuka
        </span>
      );
    }
    return (
      <span className={`${styles.statusPill} ${styles.statusPillLocked}`}>
        <Lock size={11} />{" "}
        {data.window.reason === "TOO_EARLY" ? "Belum dibuka" : "Terkunci"}
      </span>
    );
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
            <span className={styles.title}>Kehadiran Tim Pengajar</span>
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
          <div className={styles.empty}>Memuat...</div>
        ) : !data ? (
          <div className={styles.empty}>
            {feedback?.text ?? "Tidak ada data."}
          </div>
        ) : members.length === 0 ? (
          <div className={styles.empty}>
            <p>Tim ini belum punya anggota.</p>
            <p style={{ fontSize: 11, marginTop: 6 }}>
              Hubungi admin untuk daftarkan anggota tim di Registry.
            </p>
          </div>
        ) : (
          <>
            {/* L1: time window notice */}
            {!data.window.inWindow && !anyUnlocked && (
              <div className={`${styles.notice} ${styles.noticeError}`}>
                <Lock size={14} />
                <span>
                  <strong>Window tertutup.</strong> {data.window.message}
                </span>
              </div>
            )}
            {anyUnlocked && (
              <div className={`${styles.notice} ${styles.noticeInfo}`}>
                <Unlock size={14} />
                <span>
                  <strong>Admin sudah unlock pertemuan ini.</strong> Kamu bisa
                  edit walau di luar window.
                </span>
              </div>
            )}

            {/* L2: foto wajib notice */}
            {!data.photoUploaded && (
              <div className={`${styles.notice} ${styles.noticeWarn}`}>
                <Camera size={14} />
                <span>
                  <strong>Foto KBM belum diupload.</strong> Upload dokumentasi
                  KBM di halaman{" "}
                  <a href="/reporting">Dokumentasi KBM</a> dulu sebelum simpan.
                </span>
              </div>
            )}
            {data.photoUploaded &&
              data.window.inWindow &&
              !recordsExist && (
                <div className={`${styles.notice} ${styles.noticeOk}`}>
                  <Info size={14} />
                  <span>
                    Centang status tiap anggota lalu simpan. Default semua
                    HADIR — ubah yang absen saja.
                  </span>
                </div>
              )}

            <div className={styles.list}>
              {members.map((m) => {
                const disabled = !data.window.inWindow && !anyUnlocked;
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
                        const extraClass =
                          s === "HADIR"
                            ? styles.statusBtnHadir
                            : s === "ALFA"
                              ? styles.statusBtnAlfa
                              : "";
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
                      placeholder="Catatan (opsional)"
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
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                }}
              >
                {feedback?.type === "success" && (
                  <span className={styles.savedNote}>
                    ✓ {feedback.text}
                  </span>
                )}
                {feedback?.type === "error" && (
                  <span
                    style={{
                      fontSize: 11,
                      color: "#dc2626",
                      fontWeight: 600,
                    }}
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
