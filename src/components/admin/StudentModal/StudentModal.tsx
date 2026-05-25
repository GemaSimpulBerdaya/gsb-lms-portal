"use client";

import { useState, useEffect } from "react";
import {
  GraduationCap,
  User,
  Users,
  MapPin,
  Tag,
  Hash,
  KeyRound,
  UserCog,
  Cake,
  School,
  Phone,
  Home,
  Save,
} from "lucide-react";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import {
  Section,
  Row,
  Row3,
  Field,
  Input,
  Select,
  Textarea,
  Button,
  ErrorBox,
} from "@/components/admin/ui/FormField";
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
  parentName: string;
  // Excel
  studentCode: string;
  kodeKelas: string;
  pic: string;
  // Raport
  gender: "" | "Laki-laki" | "Perempuan";
  birthPlace: string;
  birthDate: string;
  schoolOrigin: string;
  phone: string;
  address: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  region: "",
  fase: "FASE A",
  parentName: "",
  studentCode: "",
  kodeKelas: "",
  pic: "",
  gender: "",
  birthPlace: "",
  birthDate: "",
  schoolOrigin: "",
  phone: "",
  address: "",
};

const KODE_KELAS_OPTIONS = [
  { value: "", label: "— Pilih Kode —" },
  { value: "S-0FD", label: "S-0FD (Offline Depok)" },
  { value: "S-OFB", label: "S-OFB (Offline Bogor)" },
  { value: "S-ONR", label: "S-ONR (Online Reguler)" },
  { value: "S-ONS", label: "S-ONS (Online SNBT)" },
];

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
          parentName: studentToEdit.parentName || "",
          studentCode: studentToEdit.studentCode || "",
          kodeKelas: studentToEdit.kodeKelas || "",
          pic: studentToEdit.pic || "",
          gender: (studentToEdit.gender as FormState["gender"]) || "",
          birthPlace: studentToEdit.birthPlace || "",
          birthDate: studentToEdit.birthDate
            ? new Date(studentToEdit.birthDate).toISOString().slice(0, 10)
            : "",
          schoolOrigin: studentToEdit.schoolOrigin || "",
          phone: studentToEdit.phone || "",
          address: studentToEdit.address || "",
        });
      } else {
        setFormData(EMPTY_FORM);
      }
    }, 0);
    return () => clearTimeout(timer);
  }, [studentToEdit, isOpen]);

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setFormData((prev) => ({ ...prev, [k]: v }));

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
      title={studentToEdit ? "Edit Data Anak Didik" : "Tambah Anak Didik Baru"}
      subtitle="Lengkapi profil siswa untuk keperluan KBM dan raport"
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
          <Field label="Nama Lengkap" required>
            <Input
              icon={User}
              type="text"
              placeholder="Contoh: Budi Santoso"
              value={formData.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </Field>
          <Field label="Nama Orang Tua / Wali" required>
            <Input
              icon={Users}
              type="text"
              placeholder="Contoh: Bpk. Joko"
              value={formData.parentName}
              onChange={(e) => set("parentName", e.target.value)}
              required
            />
          </Field>
        </Row>

        <Row>
          <Field label="Kategori / Fase" required>
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

          <Field label="Wilayah / Kelas Belajar" required>
            <Select
              icon={MapPin}
              value={formData.region}
              onChange={(e) => set("region", e.target.value)}
              required
            >
              <option value="" disabled>
                Pilih Wilayah...
              </option>
              {availableRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </Select>
          </Field>
        </Row>
      </Section>

      <Section title="Data Administratif (Excel)">
        <Row3>
          <Field label="No. Induk">
            <Input
              icon={Hash}
              type="text"
              placeholder="Contoh: 2526001"
              value={formData.studentCode}
              onChange={(e) => set("studentCode", e.target.value)}
            />
          </Field>
          <Field label="Kode Kelas">
            <Select
              icon={KeyRound}
              value={formData.kodeKelas}
              onChange={(e) => set("kodeKelas", e.target.value)}
            >
              {KODE_KELAS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="PIC Relawan">
            <Input
              icon={UserCog}
              type="text"
              placeholder="Nama PIC"
              value={formData.pic}
              onChange={(e) => set("pic", e.target.value)}
            />
          </Field>
        </Row3>
      </Section>

      <Section
        title="Data Profil Raport"
        description="Opsional — diperlukan untuk cetak raport siswa"
      >
        <Row3>
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
          <Field label="Tempat Lahir">
            <Input
              icon={MapPin}
              type="text"
              placeholder="Contoh: Depok"
              value={formData.birthPlace}
              onChange={(e) => set("birthPlace", e.target.value)}
            />
          </Field>
          <Field label="Tanggal Lahir">
            <Input
              icon={Cake}
              type="date"
              value={formData.birthDate}
              onChange={(e) => set("birthDate", e.target.value)}
            />
          </Field>
        </Row3>

        <Row>
          <Field label="Asal Sekolah">
            <Input
              icon={School}
              type="text"
              placeholder="Contoh: SD Master"
              value={formData.schoolOrigin}
              onChange={(e) => set("schoolOrigin", e.target.value)}
            />
          </Field>
          <Field label="No. WhatsApp">
            <Input
              icon={Phone}
              type="text"
              placeholder="Contoh: 0895 xxxx xxxx"
              value={formData.phone}
              onChange={(e) => set("phone", e.target.value)}
            />
          </Field>
        </Row>

        <Field label="Alamat Domisili">
          <Textarea
            icon={Home}
            placeholder="Alamat lengkap..."
            value={formData.address}
            onChange={(e) => set("address", e.target.value)}
            rows={3}
          />
        </Field>
      </Section>
    </AdminModal>
  );
}
