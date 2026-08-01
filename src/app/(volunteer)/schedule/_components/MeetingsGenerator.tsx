"use client";

import { useState, useMemo, useEffect, useRef } from "react";

export interface KbmDate {
  week: number;
  date: string; // ISO yyyy-mm-dd
  topic?: string; // dipakai sebagai "mata pelajaran" (field tetap `topic` untuk backward-compat raport)
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
}

const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_FULL_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const ROLE_LABEL: Record<string, string> = {
  FASILITATOR: "Fasilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
};

function TeamDropdown({ teamMembers, selectedIds, onToggle }: { teamMembers: TeamMemberOption[], selectedIds: string[], onToggle: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <button 
        type="button" 
        onClick={() => setOpen(!open)} 
        style={{ width: "100%", padding: "6px 10px", border: "1px solid #cbd5e1", borderRadius: "8px", fontSize: "12.5px", background: "#fff", color: "#0f172a", textAlign: "left", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", minWidth: "160px" }}
      >
        <span>{selectedIds.length === 0 ? "— Pilih Tim —" : `${selectedIds.length} Terpilih`}</span>
        <span style={{ fontSize: "10px", color: "#64748b" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, marginTop: "4px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1)", zIndex: 99, maxHeight: "220px", overflowY: "auto", padding: "6px", display: "flex", flexDirection: "column", gap: "2px" }}>
          {teamMembers.map(tm => {
            const active = selectedIds.includes(tm.volunteerId);
            const roleLabel = ROLE_LABEL[tm.role] ?? tm.role;
            return (
              <label key={tm.volunteerId} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 8px", cursor: "pointer", borderRadius: "6px", background: active ? "#f0fdf4" : "transparent" }}>
                <input type="checkbox" checked={active} onChange={() => onToggle(tm.volunteerId)} style={{ cursor: "pointer", width: "14px", height: "14px", accentColor: "#16a34a" }} />
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: active ? "#14532d" : "#334155" }}>{tm.name}</span>
                  <span style={{ fontSize: "10px", color: active ? "#166534" : "#64748b" }}>{roleLabel}</span>
                </div>
              </label>
            );
          })}
        </div>
      )}
    </div>
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
  subjects = [],
  teamMembers = [],
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

  // Sync ke parent setiap meetings berubah
  useEffect(() => {
    onChange(meetings);
  }, [meetings, onChange]);

  const handleGenerate = () => {
    if (!startDate) return;
    if (count < 1 || count > 30) return;

    const skipSet = new Set(skipDates);
    const list: KbmDate[] = [];
    const cursor = new Date(startDate);
    let week = 1;
    let safety = count + skipDates.length + 5;

    while (list.length < count && safety-- > 0) {
      const iso = toIsoDate(cursor);
      if (!skipSet.has(iso)) {
        list.push({ week, date: iso, topic: "", petugas: [] });
        week += 1;
      }
      cursor.setDate(cursor.getDate() + intervalDays);
    }

    setMeetings(list);
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
    setMeetings([...meetings, { week: meetings.length + 1, date: newIso, topic: "", petugas: [] }]);
  };

  const dayHint = startDate ? DAYS_FULL_ID[new Date(startDate).getDay()] : "";

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
          style={{
            width: "100%",
            padding: "10px",
            background: "#0f172a",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {meetings.length > 0 ? "Generate Ulang" : "Generate Tanggal"}
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
            style={{
              maxHeight: "55vh",
              overflowY: "auto",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
              <thead>
                <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                  <th style={thStyle}>#</th>
                  <th style={thStyle}>Tanggal</th>
                  <th style={thStyle}>Hari</th>
                  <th style={thStyle}>Mata Pelajaran</th>
                  <th style={thStyle}>Relawan</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m, i) => (
                  <tr key={`${m.date}-${i}`} style={{ borderTop: "1px solid #e2e8f0" }}>
                    <td style={{ ...tdStyle, fontWeight: 700, color: "#475569" }}>
                      {m.week}
                    </td>
                    <td style={tdStyle}>
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
                    <td style={{ ...tdStyle, color: "#64748b" }}>{getDayName(m.date)}</td>
                    <td style={tdStyle}>
                      {subjects.length > 0 ? (
                        <select
                          value={m.topic || ""}
                          onChange={(e) => updateMeeting(i, { topic: e.target.value })}
                          style={{
                            ...inputStyle,
                            padding: "4px 8px",
                            fontSize: "12.5px",
                            cursor: "pointer",
                            minWidth: "280px",
                          }}
                        >
                          <option value="">— Pilih —</option>
                          {subjects.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                          {/* Pertahankan nilai lama yang tidak ada di master data */}
                          {m.topic && !subjects.includes(m.topic) && (
                            <option value={m.topic}>{m.topic} (lama)</option>
                          )}
                        </select>
                      ) : (
                        <input
                          type="text"
                          value={m.topic || ""}
                          onChange={(e) => updateMeeting(i, { topic: e.target.value })}
                          placeholder="—"
                          style={{
                            ...inputStyle,
                            padding: "4px 8px",
                            fontSize: "12.5px",
                            minWidth: "280px",
                          }}
                        />
                      )}
                    </td>
                    <td style={tdStyle}>
                      {teamMembers.length === 0 ? (
                        <span style={{ fontSize: "11.5px", color: "#94a3b8" }}>
                          Belum ada anggota tim
                        </span>
                      ) : (
                        <TeamDropdown 
                          teamMembers={teamMembers} 
                          selectedIds={m.petugas ?? []} 
                          onToggle={(id) => togglePetugas(i, id)} 
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
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
