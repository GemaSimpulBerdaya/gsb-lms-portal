"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal/Modal";

interface Props {
  scheduleId: string;
  week: number;
  oldDate: string; // ISO
  topic?: string;
  onClose: () => void;
  onSaved: (newSchedule: { _id: string; kbmDates: { week: number; date: string; topic?: string }[]; activeWeek: number }) => void;
}

const REASON_PRESETS = [
  "Sakit",
  "Libur Nasional",
  "Libur Lebaran",
  "Acara internal",
  "Lainnya",
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/**
 * Modal kecil untuk geser tanggal satu pertemuan.
 * Memanggil PATCH /api/volunteer/schedule/reschedule.
 */
export default function RescheduleModal({
  scheduleId,
  week,
  oldDate,
  topic,
  onClose,
  onSaved,
}: Props) {
  const [newDate, setNewDate] = useState(oldDate.slice(0, 10));
  const [reasonPreset, setReasonPreset] = useState<string>("Sakit");
  const [reasonCustom, setReasonCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!newDate) {
      setError("Tanggal baru wajib diisi");
      return;
    }
    if (newDate === oldDate.slice(0, 10) && reasonPreset === "Sakit" && !reasonCustom) {
      setError("Tanggal belum berubah");
      return;
    }

    const reason =
      reasonPreset === "Lainnya" ? reasonCustom.trim() : reasonPreset;

    setSaving(true);
    try {
      const res = await fetch("/api/volunteer/schedule/reschedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleId,
          week,
          newDate,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menggeser tanggal");
      onSaved(data.schedule);
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Gagal menggeser tanggal";
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const footer = (
    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", width: "100%" }}>
      <button
        type="button"
        onClick={onClose}
        disabled={saving}
        style={{
          padding: "9px 16px",
          background: "#fff",
          border: "1px solid #cbd5e1",
          color: "#334155",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        Batal
      </button>
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        style={{
          padding: "9px 16px",
          background: "#0f172a",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: 600,
          cursor: saving ? "not-allowed" : "pointer",
          opacity: saving ? 0.7 : 1,
        }}
      >
        {saving ? "Menyimpan..." : "Simpan Perubahan"}
      </button>
    </div>
  );

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={`Geser Pertemuan Pekan ${week}`}
      maxWidth="440px"
      footer={footer}
    >
      {topic && (
        <p style={{ fontSize: "12.5px", color: "#64748b", marginBottom: "16px" }}>
          Topik: <strong>{topic}</strong>
        </p>
      )}

      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Tanggal lama</label>
        <div style={readonlyStyle}>{fmtDate(oldDate)}</div>
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Tanggal baru</label>
        <input
          type="date"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: "14px" }}>
        <label style={labelStyle}>Alasan</label>
        <select
          value={reasonPreset}
          onChange={(e) => setReasonPreset(e.target.value)}
          style={inputStyle}
        >
          {REASON_PRESETS.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {reasonPreset === "Lainnya" && (
        <div style={{ marginBottom: "14px" }}>
          <input
            type="text"
            placeholder="Tulis alasan..."
            value={reasonCustom}
            onChange={(e) => setReasonCustom(e.target.value)}
            style={inputStyle}
          />
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "8px 12px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: "8px",
            fontSize: "12.5px",
            marginBottom: "14px",
          }}
        >
          {error}
        </div>
      )}
    </Modal>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "11.5px",
  fontWeight: 700,
  color: "#475569",
  marginBottom: "6px",
  textTransform: "uppercase",
  letterSpacing: "0.4px",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "8px",
  fontSize: "13px",
  background: "#fff",
  color: "#0f172a",
};

const readonlyStyle: React.CSSProperties = {
  ...inputStyle,
  background: "#f8fafc",
  color: "#64748b",
};
