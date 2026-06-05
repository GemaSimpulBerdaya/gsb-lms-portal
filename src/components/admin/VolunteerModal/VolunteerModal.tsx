"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
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
  Select,
  Button,
  ErrorBox,
} from "@/components/admin/ui/FormField";
import {
  ACADEMIC_ROLE,
  TIM_PEKAN_ROLES,
  TEAM_ACCOUNT_ROLE_LABELS,
  type TeamAccountRole,
} from "@/lib/roles";

export interface VolunteerEditable {
  _id: string;
  name?: string;
  email: string;
  teamName?: string;
  region?: string;
  role?: string;
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
  role: "TIM_PEKAN_1",
};

const ROLE_OPTIONS: TeamAccountRole[] = [...TIM_PEKAN_ROLES, ACADEMIC_ROLE];

export default function VolunteerModal({
  isOpen,
  onClose,
  onSuccess,
  volunteerToEdit = null,
}: VolunteerModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!volunteerToEdit;
  const locationOptions = Array.from(
    new Set([
      ...availableLocations,
      ...(formData.region && !availableLocations.includes(formData.region)
        ? [formData.region]
        : []),
    ])
  );

  useEffect(() => {
    if (!isOpen) return;

    fetch("/api/admin/settings")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.availableRegions)) {
          setAvailableLocations(data.availableRegions);
        }
      })
      .catch((err) => console.error("Gagal load lokasi belajar", err));
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (volunteerToEdit) {
        setFormData({
          name: volunteerToEdit.name || "",
          email: volunteerToEdit.email || "",
          password: "",
          teamName: volunteerToEdit.teamName || "",
          region: volunteerToEdit.region || "",
          role: ROLE_OPTIONS.includes(volunteerToEdit.role as TeamAccountRole)
            ? volunteerToEdit.role!
            : "TIM_PEKAN_1",
        });
      } else {
        setFormData({
          ...EMPTY_FORM,
          region: availableLocations[0] || "",
        });
      }
      setError("");
    }
  }, [isOpen, volunteerToEdit, availableLocations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = isEdit
        ? `/api/admin/volunteers/${volunteerToEdit!._id}`
        : "/api/admin/volunteers";

      const payload: Record<string, unknown> = {
        ...formData,
        name: formData.teamName,
      };
      if (isEdit && !payload.password) delete payload.password;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
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
      title={isEdit ? "Edit Akun Tim" : "Tambah Akun Tim"}
      subtitle={
        isEdit
          ? "Perbarui identitas dan akses login tim relawan"
          : "Buat akun login untuk satu tim relawan"
      }
      icon={UserPlus}
      onSubmit={handleSubmit}
      size="md"
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
                {isEdit ? "Simpan Perubahan" : "Simpan Akun Tim"}
              </>
            )}
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <Section
        title="Identitas Tim"
        description="Data ini tampil di daftar akun tim, jadwal, dan laporan relawan."
      >
        <Row>
          <Field label="Jenis Akun" required>
            <Select
              icon={UserPlus}
              value={formData.role}
              onChange={(e) =>
                setFormData({ ...formData, role: e.target.value })
              }
              required
            >
              {ROLE_OPTIONS.map((role) => (
                <option key={role} value={role}>
                  {TEAM_ACCOUNT_ROLE_LABELS[role]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Nama Tim" required>
            <Input
              icon={Users}
              type="text"
              placeholder="Misal: Tim Offline Depok 1"
              value={formData.teamName}
              onChange={(e) =>
                setFormData({ ...formData, teamName: e.target.value })
              }
              required
            />
          </Field>
          <Field label="Lokasi Belajar">
            <Select
              icon={MapPin}
              value={formData.region}
              onChange={(e) =>
                setFormData({ ...formData, region: e.target.value })
              }
            >
              <option value="">Pilih Lokasi Belajar</option>
              {locationOptions.map((location) => (
                <option key={location} value={location}>
                  {location}
                </option>
              ))}
            </Select>
          </Field>
        </Row>
      </Section>

      <Section
        title="Akses Login"
        description="Email dan password dipakai fasilitator tim untuk masuk ke portal relawan."
      >
        <Field label="Email Login" required>
          <Input
            icon={Mail}
            type="email"
            placeholder="tim.depok1@gsb.com"
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
              : "Minimal 6 karakter untuk akun login tim"
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
    </AdminModal>
  );
}
