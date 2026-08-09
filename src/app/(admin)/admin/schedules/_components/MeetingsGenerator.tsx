"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useMounted } from "@/hooks/useMounted";
import styles from "../schedules.module.css";

export interface KbmDate {
  week: number;
  date: string; // ISO yyyy-mm-dd
  meetingType?: string;
  topic?: string; // agenda / mata pelajaran (field tetap `topic` untuk backward-compat raport)
  requiresGrades?: boolean;
  petugas?: string[]; // volunteerId (registry) yang bertugas
}

export interface TeamMemberOption {
  volunteerId: string;
  name: string;
  role: string;
}

interface Props {
  initial?: KbmDate[];
  onChange: (kbm: KbmDate[]) => void;
  /** Master data mata pelajaran (dari Settings.availableSubjects). */
  subjects?: string[];
  /** Anggota tim untuk pilihan petugas tiap pertemuan. */
  teamMembers?: TeamMemberOption[];
  /** Apakah form sudah valid untuk generate (lokasi & fase sudah dipilih). */
  canGenerate?: boolean;
}

const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_FULL_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ROLE_LABEL: Record<string, string> = {
  KETUA_DIVISI: "Ketua Divisi",
  FASILITATOR: "Fasilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
};

const MEETING_TYPES = [
  { value: "KBM", label: "KBM", helper: "Pilih mata pelajaran", requiresGrades: true },
  { value: "OTHER", label: "Lainnya", helper: "Isi agenda manual", requiresGrades: false },
];

const MEETING_TYPE_MAP = new Map(MEETING_TYPES.map((type) => [type.value, type]));

function getMeetingType(value?: string) {
  const normalized = (value || "KBM").toUpperCase();
  return MEETING_TYPE_MAP.get(normalized) ?? MEETING_TYPE_MAP.get("OTHER")!;
}

function TeamPickerModal({
  open,
  meetingLabel,
  teamMembers,
  selectedIds,
  onToggle,
  onSelectAll,
  onClear,
  onClose,
}: {
  open: boolean;
  meetingLabel: string;
  teamMembers: TeamMemberOption[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const mounted = useMounted();
  if (!open || !mounted) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Atur tim bertugas ${meetingLabel}`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100000,
        background: "rgba(59, 32, 20, 0.58)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "max(12px, env(safe-area-inset-top)) max(12px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(12px, env(safe-area-inset-left))",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "min(760px, 100%)",
          boxSizing: "border-box",
          background: "#fff",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 24px 54px rgba(117, 35, 0, 0.24)",
          border: "1px solid var(--admin-border)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "18px 20px",
            background: "var(--admin-hero)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800 }}>
              Relawan
            </h3>
            <p style={{ margin: "4px 0 0", color: "rgba(255, 250, 245, 0.78)", fontSize: "12.5px", fontWeight: 600 }}>
              {meetingLabel} · {selectedIds.length} orang terpilih
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal relawan"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "50%",
              border: "1px solid rgba(255,255,255,0.24)",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              cursor: "pointer",
              fontSize: "18px",
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>

        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--admin-border)", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" onClick={onSelectAll} style={secondaryButtonStyle}>
            Pilih Semua
          </button>
          <button type="button" onClick={onClear} style={secondaryButtonStyle}>
            Kosongkan
          </button>
        </div>

        <div style={{ padding: "16px 18px", overflowY: "auto", minHeight: 0, flex: "1 1 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "10px" }}>
          {teamMembers.map((member) => {
            const active = selectedIds.includes(member.volunteerId);
            const roleLabel = ROLE_LABEL[member.role] ?? member.role;
            return (
              <label
                key={member.volunteerId}
                style={{
                  display: "flex",
                  gap: "12px",
                  alignItems: "center",
                  padding: "12px",
                  borderRadius: "12px",
                  border: active ? "1.5px solid var(--admin-primary)" : "1px solid var(--admin-border)",
                  background: active ? "#fff7ed" : "#fff",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onToggle(member.volunteerId)}
                  style={{ cursor: "pointer", width: "16px", height: "16px", accentColor: "#F58220" }}
                />
                <span style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                  <span style={{ fontSize: "13.5px", fontWeight: 800, color: "var(--admin-ink)" }}>
                    {member.name}
                  </span>
                  <span style={{ fontSize: "11.5px", fontWeight: 700, color: active ? "var(--admin-primary-dark)" : "var(--admin-muted)" }}>
                    {roleLabel}
                  </span>
                </span>
              </label>
            );
          })}

          {teamMembers.length === 0 && (
            <div style={{ gridColumn: "1 / -1", padding: "28px", textAlign: "center", color: "var(--admin-muted)", fontSize: "13px", fontWeight: 700 }}>
              Belum ada anggota tim di lokasi ini.
            </div>
          )}
        </div>

        <div style={{ padding: "14px 18px", borderTop: "1px solid var(--admin-border)", display: "flex", justifyContent: "flex-end", flexShrink: 0, background: "#fff" }}>
          <button type="button" onClick={onClose} style={primaryButtonStyle}>
            Selesai
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

function getDayName(iso: string): string {
  return DAYS_ID[new Date(iso).getDay()];
}

/**
 * Komponen generator + editor list pertemuan KBM untuk modal Tambah/Edit Jadwal.
 *
 * Flow:
 *  1. User isi config (startDate, count, intervalDays, skipDates)
 *  2. Klik "Generate" → preview list
 *  3. List bisa di-edit per-baris (tanggal, topik) atau ditambah
 *  4. Setiap perubahan → onChange callback ke parent
 */
export default function MeetingsGenerator({
  initial = [],
  onChange,
  subjects,
  teamMembers = [],
  canGenerate = true,
}: Props) {

  // Default values: hari Minggu, 15 pertemuan (sesuai pola Excel Edukasi),
  // mulai dari Minggu depan
  const defaultStart = useMemo(() => {
    const d = new Date();
    const daysUntilSunday = (7 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilSunday);
    return toIsoDate(d);
  }, []);

  const [startDate, setStartDate] = useState(defaultStart);
  const [count, setCount] = useState(15);
  const [intervalDays, setIntervalDays] = useState(7);
  const [skipDates, setSkipDates] = useState<string[]>([]);
  const [skipInput, setSkipInput] = useState("");
  const [meetings, setMeetings] = useState<KbmDate[]>(initial);
  const [isGenerating, setIsGenerating] = useState(false);
  const [teamModalIndex, setTeamModalIndex] = useState<number | null>(null);

  // Sync ke parent setiap meetings berubah
  useEffect(() => {
    onChange(meetings);
  }, [meetings, onChange]);

    const handleGenerate = () => {
      if (!startDate) return;
      if (count < 1 || count > 30) return;
  
      setIsGenerating(true);

      const skipSet = new Set(skipDates);
      const list: KbmDate[] = [];
      const cursor = new Date(startDate);
      let week = 1;
      let safety = count + skipDates.length + 5;
  
      while (list.length < count && safety-- > 0) {
        const iso = toIsoDate(cursor);
        if (!skipSet.has(iso)) {
          const existing = initial.find(m => m.week === week);
          list.push({ 
            week, 
            date: iso, 
            meetingType: existing ? existing.meetingType || "KBM" : "KBM",
            topic: existing ? existing.topic : "", 
            requiresGrades: existing ? existing.requiresGrades ?? true : true,
            petugas: existing ? existing.petugas : [] 
          });
          week += 1;
        }
        cursor.setDate(cursor.getDate() + intervalDays);
      }
  
      // Delay biar animasi keliatan
      setTimeout(() => {
        setMeetings(list);
        setIsGenerating(false);
      }, 400);
    };

  const handleAddSkip = () => {
    if (!skipInput) return;
    if (skipDates.includes(skipInput)) {
      setSkipInput("");
      return;
    }
    setSkipDates([...skipDates, skipInput].sort());
    setSkipInput("");
  };

  const handleRemoveSkip = (iso: string) => {
    setSkipDates(skipDates.filter((d) => d !== iso));
  };

  const updateMeeting = (idx: number, patch: Partial<KbmDate>) => {
    const next = meetings.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    // Re-sort & re-week kalau tanggal berubah
    next.sort((a, b) => a.date.localeCompare(b.date));
    next.forEach((m, i) => (m.week = i + 1));
    setMeetings([...next]);
  };

  /** Toggle satu petugas (volunteerId) di pertemuan idx. */
  const togglePetugas = (idx: number, volunteerId: string) => {
    setMeetings((prev) =>
      prev.map((m, i) => {
        if (i !== idx) return m;
        const current = m.petugas ?? [];
        const exists = current.includes(volunteerId);
        return {
          ...m,
          petugas: exists
            ? current.filter((id) => id !== volunteerId)
            : [...current, volunteerId],
        };
      })
    );
  };

  const addMeeting = () => {
    const lastIso = meetings.length > 0 ? meetings[meetings.length - 1].date : startDate;
    const next = new Date(lastIso);
    next.setDate(next.getDate() + intervalDays);
    const newIso = toIsoDate(next);
    setMeetings([...meetings, { week: meetings.length + 1, date: newIso, meetingType: "KBM", topic: "", requiresGrades: true, petugas: [] }]);
  };

  const dayHint = startDate ? DAYS_FULL_ID[new Date(startDate).getDay()] : "";
  const teamModalMeeting = teamModalIndex === null ? null : meetings[teamModalIndex] ?? null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div
        style={{
          padding: "14px",
          background: "#f8fafc",
          borderRadius: "10px",
          border: "1px solid #e2e8f0",
        }}
      >
        <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569", marginBottom: "10px" }}>
          GENERATOR TANGGAL
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 0.8fr 1fr",
            gap: "10px",
            marginBottom: "10px",
          }}
        >
          <div>
            <label style={labelStyle}>Mulai dari</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={inputStyle}
            />
            {dayHint && (
              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                Hari {dayHint}
              </span>
            )}
          </div>
          <div>
            <label style={labelStyle}>Jumlah</label>
            <input
              type="number"
              min={1}
              max={30}
              value={count}
              onChange={(e) => setCount(parseInt(e.target.value) || 1)}
              style={inputStyle}
            />
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
              pertemuan
            </span>
          </div>
          <div>
            <label style={labelStyle}>Interval</label>
            <select
              value={intervalDays}
              onChange={(e) => setIntervalDays(parseInt(e.target.value))}
              style={inputStyle}
            >
              <option value={7}>Mingguan</option>
              <option value={14}>2 minggu sekali</option>
              <option value={3}>3 hari sekali</option>
              <option value={1}>Harian</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: "10px" }}>
          <label style={labelStyle}>Skip Tanggal Libur (opsional)</label>
          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
            <input
              type="date"
              value={skipInput}
              onChange={(e) => setSkipInput(e.target.value)}
              style={{ ...inputStyle, flex: 1 }}
            />
            <button
              type="button"
              onClick={handleAddSkip}
              style={{
                padding: "8px 14px",
                background: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              + Skip
            </button>
          </div>
          {skipDates.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              {skipDates.map((iso) => (
                <span
                  key={iso}
                  style={{
                    padding: "4px 10px",
                    background: "#fef3c7",
                    color: "#92400e",
                    borderRadius: "6px",
                    fontSize: "11.5px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {fmtDate(iso)}
                  <button
                    type="button"
                    onClick={() => handleRemoveSkip(iso)}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#92400e",
                      cursor: "pointer",
                      padding: 0,
                      fontSize: "14px",
                    }}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || !canGenerate}
          style={{
            width: "100%",
            padding: "10px",
            background: (isGenerating || !canGenerate) ? "#94a3b8" : "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: (isGenerating || !canGenerate) ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            transition: "all 0.2s ease",
            opacity: (isGenerating || !canGenerate) ? 0.6 : 1,
          }}
        >
          {isGenerating && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "spin 1s linear infinite" }}>
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {isGenerating ? "Generating..." : meetings.length > 0 ? "Generate Ulang" : "Generate Tanggal Pertemuan"}
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </button>
      </div>

      {meetings.length > 0 && (
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <div style={{ fontSize: "12px", fontWeight: 700, color: "#475569" }}>
              {meetings.length} PERTEMUAN
            </div>
            <button
              type="button"
              onClick={addMeeting}
              style={{
                padding: "4px 10px",
                background: "#fff",
                border: "1px solid #cbd5e1",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "11.5px",
                fontWeight: 600,
                color: "#334155",
              }}
            >
              + Tambah
            </button>
          </div>
          <div
            className={styles.meetingsTableWrap}
            style={{
              maxHeight: "55vh",
              overflow: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <table className={styles.meetingsTable} style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Tanggal</th>
                  <th style={thStyle}>Hari</th>
                  <th style={thStyle}>Jenis Pertemuan</th>
                  <th style={thStyle}>Agenda / Mata Pelajaran</th>
                  <th style={thStyle}>Relawan</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m, i) => {
                  const meetingType = getMeetingType(m.meetingType);
                  const isKbm = meetingType.value === "KBM";
                  const selectedTeam = teamMembers.filter((member) => (m.petugas ?? []).includes(member.volunteerId));
                  const selectedTeamTitle = selectedTeam
                    .map((member) => `${member.name} - ${ROLE_LABEL[member.role] ?? member.role}`)
                    .join(", ");
                  return (
                    <tr key={`${m.date}-${i}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                      <td data-label="Pekan" style={{ ...tdStyle, fontWeight: 700, color: "#475569" }}>
                        {m.week}
                      </td>
                      <td data-label="Tanggal" style={tdStyle}>
                        <input
                          type="date"
                          value={m.date}
                          onChange={(e) => updateMeeting(i, { date: e.target.value })}
                          style={{
                            ...inputStyle,
                            padding: "4px 8px",
                            fontSize: "12.5px",
                          }}
                        />
                      </td>
                      <td data-label="Hari" style={{ ...tdStyle, color: "#64748b" }}>{getDayName(m.date)}</td>
                      <td data-label="Jenis" style={tdStyle}>
                        <select
                          value={meetingType.value}
                          onChange={(e) => {
                            const nextType = getMeetingType(e.target.value);
                            updateMeeting(i, {
                              meetingType: nextType.value,
                              requiresGrades: nextType.requiresGrades,
                            });
                          }}
                          style={{
                            ...inputStyle,
                            padding: "4px 8px",
                            fontSize: "12.5px",
                            cursor: "pointer",
                            minWidth: "180px",
                          }}
                        >
                          {MEETING_TYPES.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                        <span style={{ display: "block", marginTop: "4px", fontSize: "10.5px", color: meetingType.requiresGrades ? "#9a3412" : "#64748b", fontWeight: 700 }}>
                          {meetingType.helper}
                        </span>
                      </td>
                      <td data-label="Agenda" style={tdStyle}>
                        {isKbm && subjects && subjects.length > 0 ? (
                          <select
                            value={m.topic || ""}
                            onChange={(e) => updateMeeting(i, { topic: e.target.value })}
                            style={{
                              ...inputStyle,
                              padding: "4px 8px",
                              fontSize: "12.5px",
                              cursor: "pointer",
                              minWidth: "260px",
                            }}
                          >
                            <option value="">— Pilih Mata Pelajaran —</option>
                            {subjects.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                            {/* Pertahankan nilai lama yang tidak ada di master data */}
                            {m.topic && (!subjects || !subjects.includes(m.topic)) && (
                              <option value={m.topic}>{m.topic} (lama)</option>
                            )}
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={m.topic || ""}
                            onChange={(e) => updateMeeting(i, { topic: e.target.value })}
                            placeholder={isKbm ? "Tulis mata pelajaran..." : "Tulis agenda kegiatan..."}
                            style={{
                              ...inputStyle,
                              padding: "4px 8px",
                              fontSize: "12.5px",
                              minWidth: "260px",
                            }}
                          />
                        )}
                      </td>
                      <td data-label="Relawan" style={{ ...tdStyle, minWidth: "260px", verticalAlign: "top" }}>
                        <button
                          type="button"
                          onClick={() => setTeamModalIndex(i)}
                          disabled={teamMembers.length === 0}
                          title={selectedTeam.length > 0 ? selectedTeamTitle : undefined}
                          style={{
                            ...inputStyle,
                            width: "100%",
                            minWidth: "190px",
                            padding: "6px 10px",
                            cursor: teamMembers.length === 0 ? "not-allowed" : "pointer",
                            background: selectedTeam.length > 0 ? "#fff7ed" : "#fff",
                            borderColor: selectedTeam.length > 0 ? "#fed7aa" : "#cbd5e1",
                            color: selectedTeam.length > 0 ? "var(--admin-primary-dark)" : "#334155",
                            fontWeight: 700,
                          }}
                        >
                          {teamMembers.length === 0
                            ? "Belum ada tim"
                            : selectedTeam.length === 0
                              ? "Atur Relawan"
                              : `${selectedTeam.length} Relawan Terpilih`}
                        </button>
                        {selectedTeam.length > 0 && (
                          <div
                            title={selectedTeamTitle}
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "5px",
                              maxHeight: "66px",
                              overflowY: "auto",
                              paddingTop: "6px",
                              paddingRight: "2px",
                            }}
                          >
                            {selectedTeam.map((member) => (
                              <span
                                key={member.volunteerId}
                                style={{
                                  maxWidth: "100%",
                                  padding: "3px 7px",
                                  borderRadius: "999px",
                                  background: "#f8fafc",
                                  border: "1px solid #e2e8f0",
                                  color: "#475569",
                                  fontSize: "10.5px",
                                  fontWeight: 700,
                                  lineHeight: 1.25,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {member.name}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <TeamPickerModal
        open={teamModalMeeting !== null}
        meetingLabel={teamModalMeeting ? `Pekan ${teamModalMeeting.week} · ${fmtDate(teamModalMeeting.date)}` : "Pertemuan"}
        teamMembers={teamMembers}
        selectedIds={teamModalMeeting?.petugas ?? []}
        onToggle={(id) => {
          if (teamModalIndex !== null) togglePetugas(teamModalIndex, id);
        }}
        onSelectAll={() => {
          if (teamModalIndex === null) return;
          updateMeeting(teamModalIndex, { petugas: teamMembers.map((member) => member.volunteerId) });
        }}
        onClear={() => {
          if (teamModalIndex === null) return;
          updateMeeting(teamModalIndex, { petugas: [] });
        }}
        onClose={() => setTeamModalIndex(null)}
      />
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11.5px",
  fontWeight: 600,
  color: "#475569",
  marginBottom: "4px",
};

const secondaryButtonStyle: React.CSSProperties = {
  height: "34px",
  padding: "0 12px",
  border: "1px solid var(--admin-border)",
  borderRadius: "9px",
  background: "#fff",
  color: "var(--admin-ink)",
  fontSize: "12px",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  height: "38px",
  padding: "0 18px",
  border: "none",
  borderRadius: "10px",
  background: "linear-gradient(135deg, var(--admin-primary), var(--admin-danger))",
  color: "#fff",
  fontSize: "13px",
  fontWeight: 800,
  cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "13px",
  background: "#fff",
  color: "#0f172a",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: "11.5px",
  fontWeight: 700,
  color: "#475569",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 10px",
  verticalAlign: "middle",
};
