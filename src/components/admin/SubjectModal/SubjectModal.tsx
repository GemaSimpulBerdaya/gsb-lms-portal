"use client";

import { useEffect, useState } from "react";
import { Tag, Save, BookOpen, Calendar } from "lucide-react";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import {
  Section,
  Row,
  Field,
  Input,
  Select,
  Button,
  ErrorBox,
} from "@/components/admin/ui/FormField";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Dipanggil dgn nama final ter-format: "Pekan {pekan}: {judul}" */
  onSubmit: (combined: string) => Promise<void> | void;
  /** Kalau diisi → mode EDIT, modal pre-fill dgn nilai ini. Kosong → mode TAMBAH. */
  initialValue?: string | null;
  submitting?: boolean;
}

const PEKAN_OPTIONS = [1, 2, 3, 4] as const;

/**
 * Parse string format "Pekan {N}: {judul}" jadi { pekan, judul }.
 * Return null kalau format gak match (mis. data lama yg gak pake convention).
 */
function parseSubjectName(value: string): { pekan: number; judul: string } | null {
  const match = value.match(/^Pekan\s+(\d+)\s*[:\-]\s*(.+)$/i);
  if (!match) return null;
  const pekan = parseInt(match[1], 10);
  const judul = match[2].trim();
  if (!Number.isFinite(pekan) || pekan < 1 || pekan > 99) return null;
  return { pekan, judul };
}

export default function SubjectModal({
  isOpen,
  onClose,
  onSubmit,
  initialValue = null,
  submitting = false,
}: Props) {
  const isEdit = Boolean(initialValue);
  const [pekan, setPekan] = useState<number>(1);
  const [judul, setJudul] = useState("");
  const [error, setError] = useState("");
  // Kalau data lama gak match format → tampilin warning + biarin user pilih
  // pekan + retype judul. Original string ditampilin sebagai hint.
  const [legacyValue, setLegacyValue] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setError("");
      if (initialValue) {
        const parsed = parseSubjectName(initialValue);
        if (parsed) {
          setPekan(parsed.pekan);
          setJudul(parsed.judul);
          setLegacyValue(null);
        } else {
          // Data lama gak ke-format. Suruh user pilih pekan & retype judul.
          setPekan(1);
          setJudul(initialValue);
          setLegacyValue(initialValue);
        }
      } else {
        setPekan(1);
        setJudul("");
        setLegacyValue(null);
      }
    });
  }, [initialValue, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedJudul = judul.trim();
    if (!trimmedJudul) {
      setError("Judul materi wajib diisi.");
      return;
    }
    if (pekan < 1) {
      setError("Pekan harus dipilih.");
      return;
    }
    setError("");
    const combined = `Pekan ${pekan}: ${trimmedJudul}`;
    await onSubmit(combined);
  };

  const previewName = `Pekan ${pekan}: ${judul.trim() || "..."}`;

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? "Edit Mata Pelajaran" : "Tambah Mata Pelajaran"}
      subtitle="Pilih pekan ke berapa & masukkan judul materinya"
      icon={Tag}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="cancel" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={submitting || !judul.trim()}>
            {submitting ? (
              "Menyimpan..."
            ) : (
              <>
                <Save size={16} />
                {isEdit ? "Simpan Perubahan" : "Simpan Mata Pelajaran"}
              </>
            )}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      {legacyValue && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 12,
            background: "#fef3c7",
            color: "#92400e",
            border: "1px solid #fde68a",
            lineHeight: 1.5,
          }}
        >
          Mata pelajaran lama (<strong>{legacyValue}</strong>) belum pakai format{" "}
          <em>&ldquo;Pekan X: Judul&rdquo;</em>. Pilih pekan-nya & sesuaikan judul,
          lalu simpan untuk menerapkan format baru.
        </div>
      )}

      <Section title="Detail Materi">
        <Row>
          <Field label="Pekan" required>
            <Select
              icon={Calendar}
              value={pekan}
              onChange={(e) => setPekan(parseInt(e.target.value, 10) || 1)}
              required
            >
              {PEKAN_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  Pekan {p}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Judul Materi" required>
            <Input
              icon={BookOpen}
              type="text"
              placeholder="Contoh: Pengenalan Aljabar"
              value={judul}
              onChange={(e) => setJudul(e.target.value)}
              required
              autoFocus
            />
          </Field>
        </Row>

        <div
          style={{
            marginTop: 12,
            padding: "10px 14px",
            borderRadius: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: 13,
            color: "#475569",
          }}
        >
          Akan tersimpan sebagai:{" "}
          <strong style={{ color: "#0f172a" }}>{previewName}</strong>
        </div>
      </Section>
    </AdminModal>
  );
}
