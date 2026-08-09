"use client";

import { useState, useEffect } from "react";
import {
  UserPlus,
  Mail,
  Lock,
  Users,
  MapPin,
  Save,
  AlertTriangle,
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
  LOCATION_TEAM_ROLE,
} from "@/lib/roles";
import styles from "./VolunteerModal.module.css";

export interface VolunteerEditable {
  _id: string;
  name?: string;
  email: string;
  teamName?: string;
  region?: string;
  role?: string;
  memberDetails?: {
    volunteerId: string;
    name: string;
    isActive: boolean;
    role: "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI" | "AKADEMIK";
    joinedAt?: string;
  }[];
}

interface VolunteerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  volunteerToEdit?: VolunteerEditable | null;
}

const EMPTY_FORM = {
  name: "",
  email: "",
  password: "",
  teamName: "",
  region: "",
  accountType: LOCATION_TEAM_ROLE as string,
};

function parseAccountRole(role?: string) {
  if (role === ACADEMIC_ROLE) {
    return { accountType: "TIM_AKADEMIK" };
  }

  return { accountType: LOCATION_TEAM_ROLE };
}

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
  const [showEmailConfirm, setShowEmailConfirm] = useState(false);

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
        const roleConfig = parseAccountRole(volunteerToEdit.role);
        setFormData({
          name: volunteerToEdit.name || "",
          email: volunteerToEdit.email || "",
          password: "",
          teamName: volunteerToEdit.teamName || "",
          region: volunteerToEdit.region || "",
          accountType: roleConfig.accountType,
        });
      } else {
        setFormData({
          ...EMPTY_FORM,
          region: availableLocations[0] || "",
        });
      }
      setError("");
      setShowEmailConfirm(false);
    }
  }, [isOpen, volunteerToEdit, availableLocations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && formData.email !== volunteerToEdit?.email && !showEmailConfirm) {
      setShowEmailConfirm(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const url = isEdit
        ? `/api/admin/volunteers/${volunteerToEdit!._id}`
        : "/api/admin/volunteers";

      const role =
        formData.accountType === "TIM_AKADEMIK"
          ? ACADEMIC_ROLE
          : LOCATION_TEAM_ROLE;
      const payload: Record<string, unknown> = {
        email: formData.email,
        password: formData.password,
        teamName: formData.teamName,
        region:
          formData.accountType === "TIM_AKADEMIK" ? "" : formData.region,
        name: formData.teamName,
        role,
      };
      if (isEdit && !payload.password) delete payload.password;

      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        onSuccess(isEdit ? "Akun tim berhasil diperbarui" : "Akun tim berhasil ditambahkan");
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
      size="lg"
      footer={
        showEmailConfirm ? (
          <div className={styles.confirmFooter}>
            <span className={styles.confirmMessage}>
              <AlertTriangle size={16} /> Yakin mengubah email tim? Tim harus login dengan email baru ini.
            </span>
            <Button type="button" variant="cancel" onClick={() => setShowEmailConfirm(false)}>
              Batal Ubah
            </Button>
            <Button type="button" disabled={loading} onClick={handleSubmit}>
              {loading ? "Menyimpan..." : "Ya, Ubah Email"}
            </Button>
          </div>
        ) : (
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
        )
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
              value={formData.accountType}
              onChange={(e) =>
                setFormData({ ...formData, accountType: e.target.value })
              }
              required
            >
              <option value={LOCATION_TEAM_ROLE}>Tim Kelas</option>
              <option value="TIM_AKADEMIK">Tim Akademik</option>
            </Select>
          </Field>
          <Field label="Nama Tim" required>
            <Input
              icon={Users}
              type="text"
              placeholder="Misal: Tim Offline Depok"
              value={formData.teamName}
              onChange={(e) =>
                setFormData({ ...formData, teamName: e.target.value })
              }
              onInvalid={(e) =>
                e.currentTarget.setCustomValidity("Nama tim wajib diisi.")
              }
              onInput={(e) => e.currentTarget.setCustomValidity("")}
              required
            />
          </Field>
          {formData.accountType === LOCATION_TEAM_ROLE ? (
            <Field label="Lokasi Belajar" required>
              <Select
                icon={MapPin}
                value={formData.region}
                onChange={(e) =>
                  setFormData({ ...formData, region: e.target.value })
                }
                required
              >
                <option value="">Pilih Lokasi Belajar</option>
                {locationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Scope">
              <Input
                icon={MapPin}
                type="text"
                value="Global - semua lokasi belajar"
                disabled
              />
            </Field>
          )}
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

      <Section
        title="Anggota Tim"
        description="Kelola orang di menu Anggota Tim setelah akun dibuat."
      >
        <p style={{ margin: 0, fontSize: 13, color: "#64748b", lineHeight: 1.5 }}>
          {isEdit
            ? "Anggota tidak diubah dari sini. Buka "
            : "Setelah simpan, isi relawan di "}
          <a
            href="/admin/team-members"
            style={{ color: "#F58220", fontWeight: 600, textDecoration: "underline" }}
          >
            Anggota Tim
          </a>
          {isEdit ? "." : " (peran dari Daftar Relawan dipakai default)."}
        </p>
      </Section>
    </AdminModal>
  );
}
