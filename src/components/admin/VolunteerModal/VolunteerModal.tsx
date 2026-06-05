"use client";

import { useState, useEffect, useMemo } from "react";
import {
  UserPlus,
  Mail,
  Lock,
  Users,
  MapPin,
  Save,
  Search,
  AlertTriangle,
  CheckCircle2,
  X,
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
} from "@/lib/roles";
import styles from "./VolunteerModal.module.css";

type MemberRole = "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI" | "AKADEMIK";

const FIELD_MEMBER_ROLES: MemberRole[] = ["FASILITATOR", "PENGAJAR", "DOKUMENTASI"];
const ACADEMIC_MEMBER_ROLES: MemberRole[] = ["AKADEMIK"];
const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  FASILITATOR: "Fasilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
  AKADEMIK: "Akademik",
};

type MemberDraft = {
  volunteerId: string;
  name: string;
  role: MemberRole;
  currentTeam?: {
    id: string;
    teamName?: string;
    region?: string;
  } | null;
};

type RegistryEntry = {
  _id: string;
  name: string;
  phone?: string;
  email?: string;
  isActive: boolean;
  currentTeam: {
    id: string;
    teamName?: string;
    region?: string;
    role: string;
  } | null;
};

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
    role: MemberRole;
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
  accountType: "TIM_PEKAN",
  week: "1",
};

function parseAccountRole(role?: string) {
  if (role === ACADEMIC_ROLE) {
    return { accountType: "TIM_AKADEMIK", week: "1" };
  }

  const match = role?.match(/^TIM_PEKAN_([1-4])$/);
  return {
    accountType: "TIM_PEKAN",
    week: match?.[1] || "1",
  };
}

export default function VolunteerModal({
  isOpen,
  onClose,
  onSuccess,
  volunteerToEdit = null,
}: VolunteerModalProps) {
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [registryEntries, setRegistryEntries] = useState<RegistryEntry[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [candidateFilter, setCandidateFilter] = useState<"AVAILABLE" | "OTHER_TEAM" | "ALL">("AVAILABLE");
  const [selectedMembers, setSelectedMembers] = useState<MemberDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isEdit = !!volunteerToEdit;
  const memberRoleOptions =
    formData.accountType === "TIM_AKADEMIK"
      ? ACADEMIC_MEMBER_ROLES
      : FIELD_MEMBER_ROLES;
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

    setRegistryLoading(true);
    fetch("/api/admin/volunteer-registry?active=true")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.volunteers)) {
          setRegistryEntries(data.volunteers);
        }
      })
      .catch((err) => console.error("Gagal load registry relawan", err))
      .finally(() => setRegistryLoading(false));
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
          week: roleConfig.week,
        });
        setSelectedMembers(
          (volunteerToEdit.memberDetails ?? []).map((member) => ({
            volunteerId: member.volunteerId,
            name: member.name,
            role: member.role,
            currentTeam: null,
          }))
        );
      } else {
        setFormData({
          ...EMPTY_FORM,
          region: availableLocations[0] || "",
        });
        setSelectedMembers([]);
      }
      setMemberSearch("");
      setCandidateFilter("AVAILABLE");
      setError("");
    }
  }, [isOpen, volunteerToEdit, availableLocations]);

  useEffect(() => {
    setSelectedMembers((prev) =>
      prev.map((member) => {
        if (formData.accountType === "TIM_AKADEMIK") {
          return { ...member, role: "AKADEMIK" };
        }
        return member.role === "AKADEMIK"
          ? { ...member, role: "PENGAJAR" }
          : member;
      })
    );
  }, [formData.accountType]);

  const candidateStats = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map((member) => member.volunteerId));
    let available = 0;
    let otherTeam = 0;
    let all = 0;
    for (const entry of registryEntries) {
      if (selectedIds.has(entry._id)) continue;
      all += 1;
      if (entry.currentTeam && entry.currentTeam.id !== volunteerToEdit?._id) otherTeam += 1;
      else available += 1;
    }
    return { available, otherTeam, all };
  }, [registryEntries, selectedMembers, volunteerToEdit?._id]);

  const filteredCandidates = useMemo(() => {
    const selectedIds = new Set(selectedMembers.map((member) => member.volunteerId));
    const q = memberSearch.trim().toLowerCase();
    return registryEntries
      .filter((entry) => !selectedIds.has(entry._id))
      .filter((entry) => {
        if (candidateFilter === "AVAILABLE") {
          return !entry.currentTeam || entry.currentTeam.id === volunteerToEdit?._id;
        }
        if (candidateFilter === "OTHER_TEAM") {
          return !!entry.currentTeam && entry.currentTeam.id !== volunteerToEdit?._id;
        }
        return true;
      })
      .filter((entry) => {
        if (!q) return true;
        return [
          entry.name,
          entry.phone,
          entry.email,
          entry.currentTeam?.teamName,
          entry.currentTeam?.region,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      })
      .slice(0, 40);
  }, [candidateFilter, memberSearch, registryEntries, selectedMembers, volunteerToEdit?._id]);

  const addMemberDraft = (entry: RegistryEntry) => {
    setSelectedMembers((prev) => [
      ...prev,
      {
        volunteerId: entry._id,
        name: entry.name,
        role: formData.accountType === "TIM_AKADEMIK" ? "AKADEMIK" : "PENGAJAR",
        currentTeam: entry.currentTeam,
      },
    ]);
  };

  const updateMemberRole = (volunteerId: string, role: MemberRole) => {
    setSelectedMembers((prev) =>
      prev.map((member) =>
        member.volunteerId === volunteerId ? { ...member, role } : member
      )
    );
  };

  const removeMemberDraft = (volunteerId: string) => {
    setSelectedMembers((prev) =>
      prev.filter((member) => member.volunteerId !== volunteerId)
    );
  };

  const syncMembers = async (teamId: string) => {
    const originalById = new Map(
      (volunteerToEdit?.memberDetails ?? []).map((member) => [
        member.volunteerId,
        member,
      ])
    );
    const selectedById = new Map(
      selectedMembers.map((member) => [member.volunteerId, member])
    );

    if (isEdit) {
      for (const original of originalById.values()) {
        if (!selectedById.has(original.volunteerId)) {
          const res = await fetch(
            `/api/admin/volunteers/${teamId}/members?volunteerId=${original.volunteerId}`,
            { method: "DELETE" }
          );
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || `Gagal menghapus ${original.name}`);
          }
        }
      }
    }

    for (const member of selectedMembers) {
      const original = originalById.get(member.volunteerId);
      if (original) {
        if (original.role !== member.role) {
          const res = await fetch(`/api/admin/volunteers/${teamId}/members`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              volunteerId: member.volunteerId,
              role: member.role,
            }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || `Gagal update role ${member.name}`);
          }
        }
        continue;
      }

      const body: Record<string, unknown> = {
        volunteerId: member.volunteerId,
        role: member.role,
      };
      if (member.currentTeam?.id && member.currentTeam.id !== teamId) {
        body.transferFromTeamId = member.currentTeam.id;
      }

      const res = await fetch(`/api/admin/volunteers/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || data.error || `Gagal menambahkan ${member.name}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const url = isEdit
        ? `/api/admin/volunteers/${volunteerToEdit!._id}`
        : "/api/admin/volunteers";

      const role =
        formData.accountType === "TIM_AKADEMIK"
          ? ACADEMIC_ROLE
          : `TIM_PEKAN_${formData.week}`;
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
        const teamId = isEdit ? volunteerToEdit!._id : data.volunteer?._id;
        if (teamId) {
          await syncMembers(String(teamId));
        }
        onSuccess(isEdit ? "Akun tim berhasil diperbarui" : "Akun tim berhasil ditambahkan");
        onClose();
        setFormData(EMPTY_FORM);
        setSelectedMembers([]);
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
              value={formData.accountType}
              onChange={(e) =>
                setFormData({ ...formData, accountType: e.target.value })
              }
              required
            >
              <option value="TIM_PEKAN">Tim Pekan</option>
              <option value="TIM_AKADEMIK">Tim Akademik</option>
            </Select>
          </Field>
          {formData.accountType === "TIM_PEKAN" && (
            <Field label="Pekan" required>
              <Select
                icon={Users}
                value={formData.week}
                onChange={(e) =>
                  setFormData({ ...formData, week: e.target.value })
                }
                required
              >
                <option value="1">Pekan 1</option>
                <option value="2">Pekan 2</option>
                <option value="3">Pekan 3</option>
                <option value="4">Pekan 4</option>
              </Select>
            </Field>
          )}
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
          {formData.accountType === "TIM_PEKAN" ? (
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

      <Section
        title="Anggota Tim"
        description="Opsional, tapi disarankan diisi sekarang agar akun tim tidak dibuat kosong."
      >
        <div className={styles.memberBuilder}>
          <div className={styles.memberToolbar}>
            <div className={styles.filterTabs}>
              <button
                type="button"
                className={`${styles.filterTab} ${candidateFilter === "AVAILABLE" ? styles.filterTabActive : ""}`}
                onClick={() => setCandidateFilter("AVAILABLE")}
              >
                Belum punya tim <span>{candidateStats.available}</span>
              </button>
              <button
                type="button"
                className={`${styles.filterTab} ${candidateFilter === "OTHER_TEAM" ? styles.filterTabActive : ""}`}
                onClick={() => setCandidateFilter("OTHER_TEAM")}
              >
                Di tim lain <span>{candidateStats.otherTeam}</span>
              </button>
              <button
                type="button"
                className={`${styles.filterTab} ${candidateFilter === "ALL" ? styles.filterTabActive : ""}`}
                onClick={() => setCandidateFilter("ALL")}
              >
                Semua <span>{candidateStats.all}</span>
              </button>
            </div>
            <div className={styles.memberSearch}>
              <Search size={15} className={styles.memberSearchIcon} />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Filter nama, kontak, atau tim..."
              />
            </div>
          </div>

          <div className={styles.memberGrid}>
            <div className={styles.candidatePanel}>
              <div className={styles.panelTitle}>Pilih Relawan</div>
              <div className={styles.candidateList}>
                {registryLoading ? (
                  <div className={styles.emptyBox}>Memuat daftar relawan...</div>
                ) : filteredCandidates.length === 0 ? (
                  <div className={styles.emptyBox}>Tidak ada kandidat sesuai filter.</div>
                ) : (
                  filteredCandidates.map((entry) => {
                    const inOtherTeam =
                      !!entry.currentTeam && entry.currentTeam.id !== volunteerToEdit?._id;
                    return (
                      <button
                        key={entry._id}
                        type="button"
                        className={styles.candidateCard}
                        onClick={() => addMemberDraft(entry)}
                      >
                        <span className={styles.candidateAvatar}>
                          {entry.name.charAt(0).toUpperCase()}
                        </span>
                        <span className={styles.candidateBody}>
                          <span className={styles.candidateName}>{entry.name}</span>
                          <span className={styles.candidateMeta}>
                            {entry.phone || entry.email || "Kontak belum diisi"}
                          </span>
                          {inOtherTeam ? (
                            <span className={styles.candidateWarn}>
                              <AlertTriangle size={11} />
                              {entry.currentTeam?.teamName ?? "Tim lain"}
                            </span>
                          ) : (
                            <span className={styles.candidateFree}>Belum punya tim</span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className={styles.selectedPanel}>
              <div className={styles.panelTitle}>
                Anggota Dipilih ({selectedMembers.length})
              </div>
              {selectedMembers.length === 0 ? (
                <div className={styles.emptyBox}>
                  Belum ada anggota. Pilih dari daftar relawan di kiri.
                </div>
              ) : (
                <div className={styles.selectedList}>
                  {selectedMembers.map((member) => {
                    const transferring =
                      !!member.currentTeam &&
                      member.currentTeam.id !== volunteerToEdit?._id;
                    return (
                      <div key={member.volunteerId} className={styles.selectedCard}>
                        <div className={styles.selectedTop}>
                          <div className={styles.selectedIdentity}>
                            <span className={styles.selectedAvatar}>
                              {member.name.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <div className={styles.selectedName}>
                                {member.name}
                                <CheckCircle2 size={13} />
                              </div>
                              {transferring && (
                                <div className={styles.selectedTransfer}>
                                  Pindah dari {member.currentTeam?.teamName ?? "tim lain"}
                                </div>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className={styles.removeMemberBtn}
                            onClick={() => removeMemberDraft(member.volunteerId)}
                            aria-label={`Hapus ${member.name}`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                        <div className={styles.roleChips}>
                          {memberRoleOptions.map((role) => (
                            <button
                              key={role}
                              type="button"
                              className={`${styles.roleChip} ${member.role === role ? styles.roleChipActive : ""}`}
                              onClick={() => updateMemberRole(member.volunteerId, role)}
                            >
                              {MEMBER_ROLE_LABEL[role]}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>
    </AdminModal>
  );
}
