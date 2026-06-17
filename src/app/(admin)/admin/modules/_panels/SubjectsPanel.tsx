"use client";

import { useCallback, useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Pencil, Trash2, Plus } from "lucide-react";
import { useDialog } from "@/components/ui/DialogProvider";
import styles from "../modules.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import SubjectModal from "@/components/admin/SubjectModal/SubjectModal";

export default function SubjectsPanel() {
  const { showConfirm } = useDialog();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Modal state: null = closed; "" = open in CREATE mode; string = open in EDIT mode
  const [modalState, setModalState] = useState<{
    open: boolean;
    initial: string | null;
  }>({ open: false, initial: null });

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
      setModalState({ open: false, initial: null });
    } catch (err) {
      showMessage("error", err instanceof Error ? err.message : "Gagal menyimpan mata pelajaran");
    } finally {
      setSubmitting(false);
    }
  };

  const handleModalSubmit = async (name: string) => {
    if (modalState.initial != null) {
      // EDIT mode
      const oldName = modalState.initial;
      if (name === oldName) {
        // Tidak ada perubahan
        setModalState({ open: false, initial: null });
        return;
      }
      const next = Array.from(
        new Set(subjects.map((s) => (s === oldName ? name : s))),
      );
      await saveSubjects(next, "Mata pelajaran diperbarui");
    } else {
      // CREATE mode
      if (subjects.includes(name)) {
        showMessage("error", `Mata pelajaran "${name}" sudah ada.`);
        return;
      }
      const next = Array.from(new Set([...subjects, name]));
      await saveSubjects(next, "Mata pelajaran ditambahkan");
    }
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
      {/* Toolbar / Action bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div style={{ fontSize: 13, color: "#64748b" }}>
          Total: <strong style={{ color: "#0f172a" }}>{subjects.length}</strong> mata pelajaran
        </div>
        <button
          type="button"
          onClick={() => setModalState({ open: true, initial: null })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            border: "none",
            borderRadius: 10,
            background: "#1a1a1a",
            color: "#fff",
            padding: "9px 16px",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Plus size={16} />
          Tambah Mata Pelajaran
        </button>
      </div>

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
                      onClick={() => setModalState({ open: true, initial: subject })}
                      title="Edit mata pelajaran"
                      style={iconButtonStyle("#f3f4f6", "#1f2937")}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(subject)}
                      title="Hapus mata pelajaran"
                      style={iconButtonStyle("#fff1f0", "#cf1322")}
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
                  Belum ada mata pelajaran. Klik <strong>Tambah Mata Pelajaran</strong> untuk
                  mulai.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <SubjectModal
        isOpen={modalState.open}
        onClose={() => setModalState({ open: false, initial: null })}
        onSubmit={handleModalSubmit}
        initialValue={modalState.initial}
        submitting={submitting}
      />
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
