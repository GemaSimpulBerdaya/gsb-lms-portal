"use client";

import { useState, useMemo, useEffect } from "react";

export interface KbmDate {
  week: number;
  date: string; // ISO yyyy-mm-dd
  topic?: string;
}

interface Props {
  initial?: KbmDate[];
  onChange: (kbm: KbmDate[]) => void;
}

const DAYS_ID = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const DAYS_FULL_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

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
 *  3. List bisa di-edit per-baris (tanggal, topik) atau dihapus / ditambah
 *  4. Setiap perubahan → onChange callback ke parent
 */
export default function MeetingsGenerator({ initial = [], onChange }: Props) {
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
        list.push({ week, date: iso, topic: "" });
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

  const removeMeeting = (idx: number) => {
    const next = meetings.filter((_, i) => i !== idx);
    next.forEach((m, i) => (m.week = i + 1));
    setMeetings(next);
  };

  const addMeeting = () => {
    const lastIso = meetings.length > 0 ? meetings[meetings.length - 1].date : startDate;
    const next = new Date(lastIso);
    next.setDate(next.getDate() + intervalDays);
    const newIso = toIsoDate(next);
    setMeetings([...meetings, { week: meetings.length + 1, date: newIso, topic: "" }]);
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
              maxHeight: "260px",
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
                  <th style={thStyle}>Topik (opsional)</th>
                  <th style={{ ...thStyle, width: "40px" }}></th>
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
                      <input
                        type="text"
                        value={m.topic || ""}
                        onChange={(e) => updateMeeting(i, { topic: e.target.value })}
                        placeholder="—"
                        style={{
                          ...inputStyle,
                          padding: "4px 8px",
                          fontSize: "12.5px",
                        }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <button
                        type="button"
                        onClick={() => removeMeeting(i)}
                        title="Hapus"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#dc2626",
                          cursor: "pointer",
                          padding: "4px",
                          fontSize: "14px",
                        }}
                      >
                        ✕
                      </button>
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
