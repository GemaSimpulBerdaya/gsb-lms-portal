"use client";

import { useState, useEffect } from "react";
import { ModuleItem } from "@/components/admin/ModuleTable/ModuleTable";
import { uploadFiles } from "@/lib/uploadthing";
import {
  BookOpen,
  FileText,
  Calendar,
  Link as LinkIcon,
  FolderTree,
  Tag,
  CheckCircle2,
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
  FileUpload,
  OrDivider,
} from "@/components/admin/ui/FormField";

interface SubProgramTypeItem {
  _id: string;
  name: string;
  type: string;
  parentLabel?: string;
}

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
    programType: "SNBT",
    fase: "",
    subCategoryId: "",
    week: 1,
    order: 0,
    fileUrl: "",
    semester: "2025-1",
  });

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);
  const [subCategories, setSubCategories] = useState<SubProgramTypeItem[]>([]);

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
        if (data.availableLevels) setAvailableLevels(data.availableLevels);
      })
      .catch((err) => console.error("Gagal load semesters", err));

    fetch("/api/admin/subcategories")
      .then((res) => res.json())
      .then((data) => {
        if (data.subCategories) setSubCategories(data.subCategories);
      })
      .catch((err) => console.error("Gagal load subcategories", err));
  }, []);

  useEffect(() => {
    queueMicrotask(() => {
      if (moduleToEdit) {
        setFormData({
          title: moduleToEdit.title,
          slug: moduleToEdit.slug,
          description: moduleToEdit.description || "",
          programType: moduleToEdit.programType,
          fase: (moduleToEdit.fase || "").toString(),
          subCategoryId: moduleToEdit.subCategoryId || "",
          week: moduleToEdit.week || 1,
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
          programType: "SNBT",
          fase: "",
          subCategoryId: "",
          week: 1,
          order: 0,
          fileUrl: "",
          semester:
            (typeof window !== "undefined" ? localStorage.getItem("activeSemester") : "") ||
            "2025-1",
        });
      }
    });
  }, [moduleToEdit, isOpen]);

  // Auto-pilih default ketika user ganti programType
  useEffect(() => {
    queueMicrotask(() => {
      if (formData.programType === "OFFLINE") {
        if (availableLevels.length > 0) {
          const isValid = availableLevels.some((l) => l === formData.fase);
          if (!isValid) {
            setFormData((prev) => ({ ...prev, fase: availableLevels[0], subCategoryId: "" }));
          }
        }
      } else {
        if (subCategories.length > 0) {
          const filtered = subCategories.filter((s) => s.type === "SNBT");
          if (filtered.length > 0) {
            const isValid = filtered.some((s) => s.name === formData.subCategoryId);
            if (!isValid) {
              setFormData((prev) => ({ ...prev, subCategoryId: filtered[0].name, fase: "" }));
            }
          }
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.programType, availableLevels, subCategories]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError("");

    try {
      const result = await uploadFiles("moduleFile", { files: [file] });
      const first = result?.[0];
      if (first?.ufsUrl) {
        setFormData({ ...formData, fileUrl: first.ufsUrl });
      } else {
        setError("Gagal mengunggah file");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kesalahan koneksi saat unggah");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = moduleToEdit
        ? `/api/admin/modules/${moduleToEdit._id}`
        : "/api/admin/modules";

      const res = await fetch(url, {
        method: moduleToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
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
    const suffix =
      formData.programType === "OFFLINE" ? formData.fase : formData.subCategoryId;
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
          <Button type="submit" disabled={loading || uploading}>
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
          <Field label="Kategori Utama">
            <Select
              icon={FolderTree}
              value={formData.programType}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  programType: e.target.value as "SNBT" | "OFFLINE",
                })
              }
            >
              <option value="SNBT">SNBT (Online)</option>
              <option value="OFFLINE">OFFLINE (Kelas)</option>
            </Select>
          </Field>

          {formData.programType === "OFFLINE" ? (
            <Field
              label="Pilih Fase"
              required
              hint="Daftar fase di-derive dari Konfigurasi Raport"
            >
              <Select
                icon={Tag}
                value={formData.fase}
                onChange={(e) =>
                  setFormData({ ...formData, fase: e.target.value })
                }
                required
              >
                {availableLevels.length === 0 && (
                  <option value="">— Belum ada fase —</option>
                )}
                {availableLevels.map((lvl) => (
                  <option key={lvl} value={lvl}>
                    {lvl}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Sub-Kategori SNBT" required>
              <Select
                icon={Tag}
                value={formData.subCategoryId}
                onChange={(e) =>
                  setFormData({ ...formData, subCategoryId: e.target.value })
                }
                required
              >
                {(() => {
                  const filtered = subCategories.filter((s) => s.type === "SNBT");
                  const groups = filtered.reduce<
                    Record<string, SubProgramTypeItem[]>
                  >((acc, s) => {
                    const label = s.parentLabel || "Lainnya";
                    if (!acc[label]) acc[label] = [];
                    acc[label].push(s);
                    return acc;
                  }, {});

                  if (Object.keys(groups).length === 0) {
                    return (
                      <option value="">— Belum ada sub-kategori SNBT —</option>
                    );
                  }
                  return Object.entries(groups).map(([label, items]) => (
                    <optgroup key={label} label={label}>
                      {items.map((item) => (
                        <option key={item._id} value={item.name}>
                          {item.name}
                        </option>
                      ))}
                    </optgroup>
                  ));
                })()}
              </Select>
            </Field>
          )}
        </Row>

        <Row>
          <Field label="Semester Target">
            <Select
              icon={Calendar}
              value={formData.semester}
              onChange={(e) =>
                setFormData({ ...formData, semester: e.target.value })
              }
            >
              {availableSemesters.map((sem) => (
                <option key={sem} value={sem}>
                  {sem}
                </option>
              ))}
            </Select>
          </Field>

          {formData.programType === "OFFLINE" && (
            <Field label="Pertemuan (Minggu Ke-)">
              <Input
                icon={Calendar}
                type="number"
                value={formData.week}
                min={1}
                onChange={(e) =>
                  setFormData({ ...formData, week: parseInt(e.target.value) || 1 })
                }
              />
            </Field>
          )}
        </Row>
      </Section>

      <Section
        title="Materi Pembelajaran"
        description="Format yang didukung: PDF, DOC, DOCX, PPT, PPTX"
      >
        <FileUpload
          accept=".pdf,.doc,.docx,.ppt,.pptx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          onChange={handleFileUpload}
          uploading={uploading}
          uploaded={!!formData.fileUrl && !uploading}
          uploadedLabel="File siap"
          heading="Pilih atau Tarik File Modul"
          hint="PDF / DOC / DOCX / PPT / PPTX (maks 16MB)"
        />
        <OrDivider />
        <Input
          icon={LinkIcon}
          type="text"
          placeholder="Tempel link URL file eksternal (Google Drive, dll)..."
          value={formData.fileUrl}
          onChange={(e) =>
            setFormData({ ...formData, fileUrl: e.target.value })
          }
        />
      </Section>
    </AdminModal>
  );
}
