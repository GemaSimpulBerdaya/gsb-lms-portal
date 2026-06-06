"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import styles from "../modules.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";

export default function SubjectsPanel() {
  const { showConfirm } = useDialog();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ oldName: string; newName: string } | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showMessage = useCallback((type: "success" | "error", text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat mata pelajaran");
      setSubjects(data.availableSubjects || []);
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Gagal memuat mata pelajaran");
    } finally {
      setLoading(false);
    }
  }, [showMessage]);

  useEffect(() => {
    fetchSubjects();
  }, [fetchSubjects]);

  const saveSubjects = async (next: string[], successMessage: string) => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availableSubjects: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan mata pelajaran");
      setSubjects(next);
      showMessage("success", successMessage);
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Gagal menyimpan mata pelajaran");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdd = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    const next = Array.from(new Set([...subjects, name]));
    await saveSubjects(next, "Mata pelajaran ditambahkan");
    setDraft("");
  };

  const handleEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editing) return;
    const name = editing.newName.trim();
    if (!name) return;
    const next = Array.from(
      new Set(subjects.map((subject) => (subject === editing.oldName ? name : subject))),
    );
    await saveSubjects(next, "Mata pelajaran diperbarui");
    setEditing(null);
  };

  const handleDelete = async (name: string) => {
    const confirmed = await showConfirm(
      `Hapus mata pelajaran "${name}" dari master data?`,
      "Hapus Mata Pelajaran",
    );
    if (!confirmed) return;
    await saveSubjects(
      subjects.filter((subject) => subject !== name),
      "Mata pelajaran dihapus",
    );
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat mata pelajaran...</p>
      </div>
    );
  }

  return (
    <div>
      <form onSubmit={handleAdd} className={styles.toolbar}>
        <div className={styles.leftTools}>
          <input
            className={styles.searchInput}
            placeholder="Tambah mata pelajaran baru..."
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={submitting}
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !draft.trim()}
          style={{
            border: "none",
            borderRadius: 12,
            background: "#1a1a1a",
            color: "#fff",
            padding: "10px 16px",
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting || !draft.trim() ? 0.55 : 1,
          }}
        >
          Tambah Mata Pelajaran
        </button>
      </form>

      {message && (
        <div
          style={{
            marginBottom: 16,
            padding: "10px 14px",
            borderRadius: 12,
            fontSize: 13,
            fontWeight: 700,
            color: message.type === "error" ? "#991b1b" : "#166534",
            background: message.type === "error" ? "#fee2e2" : "#dcfce7",
          }}
        >
          {message.text}
        </div>
      )}

      <div
        style={{
          background: "#fff",
          border: "1px solid #e5e7eb",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              <th style={{ padding: 16, textAlign: "left", fontSize: 12, color: "#64748b" }}>
                MATA PELAJARAN
              </th>
              <th style={{ padding: 16, textAlign: "right", fontSize: 12, color: "#64748b" }}>
                AKSI
              </th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subject) => (
              <tr key={subject} style={{ borderTop: "1px solid #e5e7eb" }}>
                <td style={{ padding: 16, fontSize: 14, fontWeight: 700, color: "#0f172a" }}>
                  {subject}
                </td>
                <td style={{ padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => setEditing({ oldName: subject, newName: subject })}
                      title="Edit mata pelajaran"
                      style={iconButtonStyle("#eff6ff", "#1d4ed8")}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(subject)}
                      title="Hapus mata pelajaran"
                      style={iconButtonStyle("#fee2e2", "#991b1b")}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {subjects.length === 0 && (
              <tr>
                <td colSpan={2} style={{ padding: 32, textAlign: "center", color: "#64748b" }}>
                  Belum ada mata pelajaran.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.45)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setEditing(null)}
        >
          <form
            onSubmit={handleEdit}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#fff",
              borderRadius: 16,
              padding: 24,
              boxShadow: "0 24px 60px rgba(15,23,42,0.24)",
            }}
          >
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: "#0f172a" }}>
              Edit Mata Pelajaran
            </h2>
            <input
              autoFocus
              className={styles.searchInput}
              style={{ marginTop: 18, paddingLeft: 16 }}
              value={editing.newName}
              onChange={(event) =>
                setEditing({ ...editing, newName: event.target.value })
              }
              required
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button
                type="button"
                onClick={() => setEditing(null)}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 10,
                  background: "#fff",
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: "none",
                  borderRadius: 10,
                  background: "#1a1a1a",
                  color: "#fff",
                  padding: "10px 14px",
                  fontWeight: 700,
                  cursor: submitting ? "not-allowed" : "pointer",
                }}
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function iconButtonStyle(background: string, color: string): CSSProperties {
  return {
    width: 34,
    height: 34,
    border: "1px solid transparent",
    borderRadius: 10,
    background,
    color,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
  };
}
