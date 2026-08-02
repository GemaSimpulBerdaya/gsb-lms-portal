"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  User,
  MapPin,
  Tag,
  Hash,
  School,
  Phone,
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
import { LOCATION_PROFILE_KEYS, STUDENT_PROFILE_KEYS } from "@/lib/studentImportMapping";
import { Student } from "../AdminStudentTable/AdminStudentTable";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  availableRegions?: string[];
  availableLevels?: string[];
  studentToEdit?: Student | null;
}

type FormState = {
  name: string;
  region: string;
  fase: string;
  studentCode: string;
  gender: "" | "Laki-laki" | "Perempuan";
  schoolOrigin: string;
  phone: string;
  parentPhone: string;
  program: string;
  profil: Record<string, unknown>;
};

const EMPTY_FORM: FormState = {
  name: "",
  region: "",
  fase: "FASE A",
  studentCode: "",
  gender: "",
  schoolOrigin: "",
  phone: "",
  parentPhone: "",
  program: "",
  profil: {},
};

export default function StudentModal({
  isOpen,
  onClose,
  onSuccess,
  availableRegions = [],
  availableLevels = [],
  studentToEdit = null,
}: StudentModalProps) {
  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      if (studentToEdit) {
        setFormData({
          name: studentToEdit.name || "",
          region: studentToEdit.region || "",
          fase: studentToEdit.fase || "FASE A",
          studentCode: studentToEdit.studentCode || "",
          gender: (studentToEdit.gender as FormState["gender"]) || "",
          schoolOrigin: studentToEdit.schoolOrigin || "",
          phone: studentToEdit.phone || "",
          parentPhone: studentToEdit.parentPhone || "",
          program: studentToEdit.program || "",
          profil: studentToEdit.profil || {},
        });
      } else {
        setFormData(EMPTY_FORM);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [studentToEdit, isOpen]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [k]: v }));

  const setProfile = (key: string, value: string) =>
    setFormData((prev) => ({
      ...prev,
      profil: { ...prev.profil, [key]: value },
    }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = studentToEdit
        ? `/api/admin/students/${studentToEdit._id}`
        : "/api/admin/students";

      const payload: Record<string, unknown> = { ...formData };
      Object.keys(payload).forEach((k) => {
        if (payload[k] === "" || payload[k] === null) delete payload[k];
      });
      payload.name = formData.name;
      payload.fase = formData.fase;

      const res = await fetch(url, {
        method: studentToEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess();
        onClose();
        setFormData(EMPTY_FORM);
      } else {
        setError(data.error || "Gagal menyimpan data");
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
      title={studentToEdit ? "Edit Data Siswa" : "Tambah Siswa Baru"}
      subtitle="Data siswa mengikuti format sheet kelas per lokasi"
      icon={GraduationCap}
      size="lg"
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
                Simpan Data Siswa
              </>
            )}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <Section title="Data Utama">
        <Row>
          <Field label="No. Induk" required>
            <Input
              icon={Hash}
              type="text"
              placeholder="Contoh: S-DPK-001"
              value={formData.studentCode}
              onChange={(e) => set("studentCode", e.target.value)}
              required
            />
          </Field>
          <Field label="Nama Lengkap Siswa" required>
            <Input
              icon={User}
              type="text"
              placeholder="Contoh: Budi Santoso"
              value={formData.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </Field>
        </Row>

        <Row>
          <Field label="Fase" required>
            <Select
              icon={Tag}
              value={formData.fase}
              onChange={(e) => set("fase", e.target.value)}
              required
            >
              {availableLevels.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {lvl}
                </option>
              ))}
              <option value="TK">TK (Old)</option>
              <option value="SD">SD (Old)</option>
              <option value="SMP">SMP (Old)</option>
            </Select>
          </Field>

          <Field label="Lokasi Belajar" required>
            <Select
              icon={MapPin}
              value={formData.region}
              onChange={(e) => set("region", e.target.value)}
              required
            >
              <option value="" disabled>
                Pilih Lokasi Belajar...
              </option>
              {availableRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </Select>
          </Field>
        </Row>

        <Row>
          <Field label="Kelas" required>
            <Input
              icon={GraduationCap}
              type="text"
              placeholder="Contoh: 3 SD/MI"
              value={String(formData.profil.kelas || "")}
              onChange={(e) => setProfile("kelas", e.target.value)}
              required
            />
          </Field>
          <Field label="Kelas Pilihan" required>
            <Input
              icon={GraduationCap}
              type="text"
              placeholder="Contoh: Kelas Offline Depok (PAUD - SMA)"
              value={formData.program}
              onChange={(e) => set("program", e.target.value)}
              required
            />
          </Field>
        </Row>
      </Section>

      <Section title="Data Pendukung">
        <Row>
          <Field label="Jenis Kelamin">
            <Select
              icon={User}
              value={formData.gender}
              onChange={(e) => set("gender", e.target.value as FormState["gender"])}
            >
              <option value="">— Pilih —</option>
              <option value="Laki-laki">Laki-laki</option>
              <option value="Perempuan">Perempuan</option>
            </Select>
          </Field>
          <Field label="Asal Sekolah">
            <Input
              icon={School}
              type="text"
              placeholder="Contoh: SD Master"
              value={formData.schoolOrigin}
              onChange={(e) => set("schoolOrigin", e.target.value)}
            />
          </Field>
        </Row>

        <Row>
          <Field label="No. WhatsApp">
            <Input
              icon={Phone}
              type="text"
              placeholder="Contoh: 0895 xxxx xxxx"
              value={formData.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
          <Field label="No. WhatsApp Orang Tua/Wali">
            <Input
              icon={Phone}
              type="text"
              placeholder="Contoh: 0895 xxxx xxxx"
              value={formData.parentPhone}
              onChange={(e) => set("parentPhone", e.target.value)}
            />
          </Field>
        </Row>
      </Section>

      <Section title="Profil Pembelajaran">
        {STUDENT_PROFILE_KEYS
          .filter(({ key }) => (LOCATION_PROFILE_KEYS as readonly string[]).includes(key))
          .map(({ key, label }) => (
            <Field key={key} label={label}>
              <Textarea
                placeholder={label}
                value={String(formData.profil[key] || "")}
                onChange={(e) => setProfile(key, e.target.value)}
                rows={2}
              />
            </Field>
          ))}
      </Section>
    </AdminModal>
  );
}
