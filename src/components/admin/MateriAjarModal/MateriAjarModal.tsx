"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  BookOpen,
  Calendar,
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
import { formatSemester } from "@/utils/formatters";
import FileOrLinkField, { type MaterialSourceMode } from "@/components/admin/FileOrLinkField/FileOrLinkField";
import { uploadFiles } from "@/lib/uploadthing";

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
    semester: "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sourceMode, setSourceMode] = useState<MaterialSourceMode>("upload");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [semesterLabels, setSemesterLabels] = useState<Record<string, string>>({});
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
        if (data.semesterLabels) setSemesterLabels(data.semesterLabels);
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
        if (data.availableSubjects) setAvailableSubjects(data.availableSubjects);
      })
      .catch((err) => console.error("Gagal load settings", err));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (itemToEdit) {
        setSourceMode(itemToEdit.fileUrl?.includes("ufs.sh/") ? "upload" : "link");
        setSelectedFile(null);
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
            "",
        });
      } else {
        setSourceMode("upload");
        setSelectedFile(null);
        setFormData({
          title: "",
          description: "",
          fileUrl: "",
          fase: "",
          subject: "",
          month: 0,
          semester:
            (typeof window !== "undefined" ? localStorage.getItem("activeSemester") : "") ||
            "",
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
      let fileUrl = formData.fileUrl.trim();
      if (sourceMode === "upload" && selectedFile) {
        const uploaded = await uploadFiles("moduleFile", { files: [selectedFile] });
        fileUrl = uploaded?.[0]?.ufsUrl || "";
        if (!fileUrl) throw new Error("File gagal di-upload.");
      }
      if (!fileUrl) throw new Error(sourceMode === "upload" ? "Pilih file materi." : "Link materi wajib diisi.");

      const url = itemToEdit
        ? `/api/admin/materi-ajar/${itemToEdit._id}`
        : "/api/admin/materi-ajar";

      // Form gak ngirim programType / learningLocation:
      // - POST: API default programType = OFFLINE (legacy), learningLocation = ""
      // - PUT: API gak overwrite programType / learningLocation existing
      const payload: Record<string, unknown> = {
        title: formData.title,
        description: formData.description,
        fileUrl,
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan koneksi");
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
              options={availableSemesters.map(sem => ({
                value: sem,
                label: formatSemester(sem, semesterLabels),
              }))}
              placeholder="— Pilih Semester —"
            />
          </Field>
        </Row>
      </Section>

      <Section
        title="File Materi Ajar"
        description="Upload file langsung atau gunakan link Google Drive/Slides."
      >
        <Field label="Sumber Materi" required>
          <FileOrLinkField
            mode={sourceMode}
            url={formData.fileUrl}
            file={selectedFile}
            disabled={loading}
            onModeChange={(mode) => {
              setSourceMode(mode);
              setSelectedFile(null);
              if (
                (mode === "upload" && !formData.fileUrl.includes("ufs.sh/")) ||
                (mode === "link" && formData.fileUrl.includes("ufs.sh/"))
              ) {
                setFormData({ ...formData, fileUrl: "" });
              }
            }}
            onUrlChange={(fileUrl) => setFormData({ ...formData, fileUrl })}
            onFileChange={setSelectedFile}
            onError={setError}
          />
        </Field>
      </Section>
    </AdminModal>
  );
}
