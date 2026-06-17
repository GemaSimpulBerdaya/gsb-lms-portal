"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  BookOpen,
  Calendar,
  Link as LinkIcon,
  Tag,
  Save,
  Presentation,
} from "lucide-react";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import {
  Section,
  Row,
  Field,
  Input,
  Select,
  Textarea,
  Button,
  ErrorBox,
} from "@/components/admin/ui/FormField";
import SearchableSelect from "@/components/admin/ui/SearchableSelect/SearchableSelect";

const MONTH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Januari" },
  { value: 2, label: "Februari" },
  { value: 3, label: "Maret" },
  { value: 4, label: "April" },
  { value: 5, label: "Mei" },
  { value: 6, label: "Juni" },
  { value: 7, label: "Juli" },
  { value: 8, label: "Agustus" },
  { value: 9, label: "September" },
  { value: 10, label: "Oktober" },
  { value: 11, label: "November" },
  { value: 12, label: "Desember" },
];

export interface MateriAjarItem {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  programType: "SNBT" | "OFFLINE";
  learningLocation?: string;
  fase?: string;
  subject?: string;
  week?: number | null;
  month?: number | null;
  semester?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  itemToEdit?: MateriAjarItem | null;
}

export default function MateriAjarModal({
  isOpen,
  onClose,
  onSuccess,
  itemToEdit = null,
}: Props) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    fileUrl: "",
    fase: "",
    subject: "",
    month: 0, // 1-12, 0 = belum dipilih
    semester: "2025-1",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
        if (data.availableSubjects) setAvailableSubjects(data.availableSubjects);
      })
      .catch((err) => console.error("Gagal load settings", err));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (itemToEdit) {
        setFormData({
          title: itemToEdit.title,
          description: itemToEdit.description || "",
          fileUrl: itemToEdit.fileUrl || "",
          fase: (itemToEdit.fase || "").toString(),
          subject: itemToEdit.subject || "",
          // pakai month kalau ada, fallback ke week (legacy data lama 1-12)
          month:
            (typeof itemToEdit.month === "number" ? itemToEdit.month : 0) ||
            (typeof itemToEdit.week === "number" && itemToEdit.week >= 1 && itemToEdit.week <= 12
              ? itemToEdit.week
              : 0),
          semester:
            itemToEdit.semester ||
            (typeof window !== "undefined" ? localStorage.getItem("activeSemester") : "") ||
            "2025-1",
        });
      } else {
        setFormData({
          title: "",
          description: "",
          fileUrl: "",
          fase: "",
          subject: "",
          month: 0,
          semester:
            (typeof window !== "undefined" ? localStorage.getItem("activeSemester") : "") ||
            "2025-1",
        });
      }
    });
  }, [itemToEdit, isOpen]);

  // Auto-pilih default fase jika kosong (cuma untuk form NEW, bukan edit)
  useEffect(() => {
    queueMicrotask(() => {
      if (!itemToEdit && !formData.fase && availableLevels.length > 0) {
        setFormData((prev) => ({ ...prev, fase: availableLevels[0] }));
      }
    });
  }, [availableLevels, formData.fase, itemToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const url = itemToEdit
        ? `/api/admin/materi-ajar/${itemToEdit._id}`
        : "/api/admin/materi-ajar";

      // Form gak ngirim programType / learningLocation:
      // - POST: API default programType = OFFLINE (legacy), learningLocation = ""
      // - PUT: API gak overwrite programType / learningLocation existing
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        fileUrl: formData.fileUrl,
        fase: formData.fase,
        subject: formData.subject,
        semester: formData.semester,
        month: formData.month > 0 ? formData.month : null,
        // week legacy: clear-kan untuk materi baru (form ini gak pakai konsep pekan)
        week: null,
      };

      const res = await fetch(url, {
        method: itemToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Gagal menyimpan materi ajar");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={itemToEdit ? "Edit Materi Ajar" : "Tambah Materi Ajar Baru"}
      subtitle="Bahan ajar (PPT/PDF) untuk relawan saat mengajar di kelas"
      icon={Presentation}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button type="button" variant="cancel" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              "Menyimpan..."
            ) : (
              <>
                <Save size={16} />
                {itemToEdit ? "Simpan Perubahan" : "Simpan Materi"}
              </>
            )}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <Section title="Informasi Materi">
        <Field label="Judul Materi" required>
          <Input
            icon={BookOpen}
            type="text"
            placeholder="Contoh: Slide Pengenalan Aljabar"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
          />
        </Field>

        <Field label="Deskripsi Singkat">
          <Textarea
            icon={FileText}
            placeholder="Catatan ringkas isi materi (opsional)"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
          />
        </Field>
      </Section>

      <Section title="Kategorisasi">
        <Row>
          <Field label="Fase" required>
            <SearchableSelect
              icon={Tag}
              value={formData.fase}
              onChange={(v) => setFormData({ ...formData, fase: v })}
              options={availableLevels}
              placeholder="— Pilih Fase —"
              required
            />
          </Field>

          <Field label="Mata Pelajaran" required>
            {availableSubjects.length > 0 ? (
              <SearchableSelect
                icon={Tag}
                value={formData.subject}
                onChange={(v) => setFormData({ ...formData, subject: v })}
                options={availableSubjects}
                placeholder="— Pilih Mata Pelajaran —"
                required
              />
            ) : (
              <Input
                icon={Tag}
                type="text"
                placeholder="Contoh: Matematika"
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                required
              />
            )}
          </Field>
        </Row>

        <Row>
          <Field label="Bulan">
            <Select
              icon={Calendar}
              value={formData.month}
              onChange={(e) =>
                setFormData({ ...formData, month: parseInt(e.target.value) || 0 })
              }
            >
              <option value={0}>— Pilih Bulan —</option>
              {MONTH_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Semester">
            <SearchableSelect
              icon={Calendar}
              value={formData.semester}
              onChange={(v) => setFormData({ ...formData, semester: v })}
              options={availableSemesters}
              placeholder="— Pilih Semester —"
            />
          </Field>
        </Row>
      </Section>

      <Section
        title="Link Materi Ajar"
        description="Masukkan tautan Google Drive atau Google Slides untuk bahan ajar."
      >
        <Field label="Link Materi" required>
          <Input
            icon={LinkIcon}
            type="url"
            placeholder="https://drive.google.com/... atau https://docs.google.com/..."
            value={formData.fileUrl}
            onChange={(e) => setFormData({ ...formData, fileUrl: e.target.value })}
            required
          />
        </Field>
      </Section>
    </AdminModal>
  );
}
