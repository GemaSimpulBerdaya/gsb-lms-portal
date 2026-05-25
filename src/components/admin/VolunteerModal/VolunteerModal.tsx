"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
  User,
  Mail,
  Lock,
  Users,
  MapPin,
  Save,
} from "lucide-react";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import {
  Section,
  Row,
  Field,
  Input,
  Button,
  ErrorBox,
} from "@/components/admin/ui/FormField";

export interface VolunteerEditable {
  _id: string;
  name?: string;
  email: string;
  teamName?: string;
  region?: string;
}

interface VolunteerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  volunteerToEdit?: VolunteerEditable | null;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  teamName: "",
  region: "",
};

export default function VolunteerModal({
  isOpen,
  onClose,
  onSuccess,
  volunteerToEdit = null,
}: VolunteerModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!volunteerToEdit;

  useEffect(() => {
    if (isOpen) {
      if (volunteerToEdit) {
        setFormData({
          name: volunteerToEdit.name || "",
          email: volunteerToEdit.email || "",
          password: "",
          teamName: volunteerToEdit.teamName || "",
          region: volunteerToEdit.region || "",
        });
      } else {
        setFormData(EMPTY_FORM);
      }
      setError("");
    }
  }, [isOpen, volunteerToEdit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = isEdit
        ? `/api/admin/volunteers/${volunteerToEdit!._id}`
        : "/api/admin/volunteers";

      // Saat edit, jangan kirim password kalau kosong
      const payload: Record<string, unknown> = { ...formData };
      if (isEdit && !payload.password) delete payload.password;

      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
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
      title={isEdit ? "Edit Akun Relawan" : "Tambah Relawan Baru"}
      subtitle={
        isEdit
          ? "Perbarui data akun relawan"
          : "Buatkan akun login untuk relawan baru"
      }
      icon={UserPlus}
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
                {isEdit ? "Simpan Perubahan" : "Simpan Relawan"}
              </>
            )}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <Section
        title="Akun Login"
        description="Email dan password digunakan untuk masuk ke portal relawan"
      >
        <Field label="Nama Lengkap" required>
          <Input
            icon={User}
            type="text"
            placeholder="Contoh: Ahmad Fauzi"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </Field>

        <Field label="Email" required>
          <Input
            icon={Mail}
            type="email"
            placeholder="email@gsb.com"
            value={formData.email}
            onChange={(e) =>
              setFormData({ ...formData, email: e.target.value })
            }
            required
            disabled={isEdit}
          />
        </Field>

        <Field
          label={isEdit ? "Password Baru (opsional)" : "Password"}
          required={!isEdit}
          hint={
            isEdit
              ? "Kosongkan jika tidak ingin mengubah password"
              : "Minimal 6 karakter"
          }
        >
          <Input
            icon={Lock}
            type="password"
            placeholder={isEdit ? "Biarkan kosong jika tidak diubah" : "Minimal 6 karakter"}
            value={formData.password}
            onChange={(e) =>
              setFormData({ ...formData, password: e.target.value })
            }
            required={!isEdit}
            minLength={isEdit ? undefined : 6}
          />
        </Field>
      </Section>

      <Section title="Penugasan">
        <Row>
          <Field label="Nama Tim">
            <Input
              icon={Users}
              type="text"
              placeholder="Misal: Tim Jakarta"
              value={formData.teamName}
              onChange={(e) =>
                setFormData({ ...formData, teamName: e.target.value })
              }
            />
          </Field>
          <Field label="Wilayah">
            <Input
              icon={MapPin}
              type="text"
              placeholder="Misal: Depok"
              value={formData.region}
              onChange={(e) =>
                setFormData({ ...formData, region: e.target.value })
              }
            />
          </Field>
        </Row>
      </Section>
    </AdminModal>
  );
}
