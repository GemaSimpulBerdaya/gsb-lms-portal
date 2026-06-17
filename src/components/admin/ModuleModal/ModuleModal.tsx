"use client";

import { useState, useEffect } from "react";
import { ModuleItem } from "@/components/admin/ModuleTable/ModuleTable";
import {
  BookOpen,
  FileText,
  Calendar,
  Link as LinkIcon,
  Tag,
  Save,
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

interface ModuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  moduleToEdit?: ModuleItem | null;
}

export default function ModuleModal({
  isOpen,
  onClose,
  onSuccess,
  moduleToEdit = null,
}: ModuleModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    description: "",
    fase: "",
    subject: "",
    month: 0, // 1-12, 0 = belum dipilih
    order: 0,
    fileUrl: "",
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
      if (moduleToEdit) {
        setFormData({
          title: moduleToEdit.title,
          slug: moduleToEdit.slug,
          description: moduleToEdit.description || "",
          fase: (moduleToEdit.fase || "").toString(),
          subject: moduleToEdit.subject || "",
          // pakai month kalau ada, fallback ke week (legacy data lama)
          month:
            (typeof moduleToEdit.month === "number" ? moduleToEdit.month : 0) ||
            (typeof moduleToEdit.week === "number" && moduleToEdit.week >= 1 && moduleToEdit.week <= 12
              ? moduleToEdit.week
              : 0),
          order: moduleToEdit.order || 0,
          fileUrl: moduleToEdit.fileUrl || "",
          semester:
            moduleToEdit.semester ||
            (typeof window !== "undefined" ? localStorage.getItem("activeSemester") : "") ||
            "2025-1",
        });
      } else {
        setFormData({
          title: "",
          slug: "",
          description: "",
          fase: "",
          subject: "",
          month: 0,
          order: 0,
          fileUrl: "",
          semester:
            (typeof window !== "undefined" ? localStorage.getItem("activeSemester") : "") ||
            "2025-1",
        });
      }
    });
  }, [moduleToEdit, isOpen]);

  // Auto-pilih default fase jika kosong (cuma untuk form NEW, bukan edit)
  useEffect(() => {
    queueMicrotask(() => {
      if (!moduleToEdit && !formData.fase && availableLevels.length > 0) {
        setFormData((prev) => ({ ...prev, fase: availableLevels[0] }));
      }
    });
  }, [availableLevels, formData.fase, moduleToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = moduleToEdit
        ? `/api/admin/modules/${moduleToEdit._id}`
        : "/api/admin/modules";

      // Form gak ngirim programType / learningLocation:
      // - POST: API default programType = OFFLINE (legacy), learningLocation = ""
      // - PUT: API gak overwrite programType / learningLocation existing
      const payload: Record<string, unknown> = {
        title: formData.title,
        slug: formData.slug,
        description: formData.description,
        fase: formData.fase,
        subject: formData.subject,
        order: formData.order,
        fileUrl: formData.fileUrl,
        semester: formData.semester,
        month: formData.month > 0 ? formData.month : null,
        // week legacy: clear-kan untuk modul baru (form ini gak pakai konsep pekan)
        week: null,
      };

      const res = await fetch(url, {
        method: moduleToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
      } else {
        setError(data.error || "Gagal menyimpan data");
      }
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setLoading(false);
    }
  };

  const generateSlug = (title: string) => {
    const suffix = formData.subject ? formData.subject : formData.fase;
    const combined = `${title} ${suffix}`;
    const slug = combined
      .toLowerCase()
      .trim()
      .replace(/ /g, "-")
      .replace(/[^\w-]+/g, "");
    setFormData({ ...formData, title, slug });
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title={moduleToEdit ? "Edit Modul" : "Tambah Modul Baru"}
      subtitle="Lengkapi detail modul pembelajaran di bawah ini"
      icon={BookOpen}
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
                {moduleToEdit ? "Simpan Perubahan" : "Simpan Modul"}
              </>
            )}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <Section title="Informasi Dasar">
        <Field label="Judul Modul" required>
          <Input
            icon={BookOpen}
            type="text"
            placeholder="Contoh: Logika Matematika"
            value={formData.title}
            onChange={(e) => generateSlug(e.target.value)}
            required
          />
        </Field>

        <Field label="Slug URL" required>
          <Input
            icon={LinkIcon}
            type="text"
            placeholder="logika-matematika"
            value={formData.slug}
            onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
            required
          />
        </Field>

        <Field label="Deskripsi Singkat">
          <Textarea
            icon={FileText}
            placeholder="Apa yang dipelajari di modul ini?"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            rows={3}
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
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
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

          <Field label="Semester Target">
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
        title="Link Materi Pembelajaran"
        description="Masukkan tautan Google Drive atau Google Slides untuk materi modul."
      >
        <Field label="Link Materi" required>
          <Input
            icon={LinkIcon}
            type="url"
            placeholder="https://drive.google.com/... atau https://docs.google.com/..."
            value={formData.fileUrl}
            onChange={(e) =>
              setFormData({ ...formData, fileUrl: e.target.value })
            }
            required
          />
        </Field>
      </Section>
    </AdminModal>
  );
}
