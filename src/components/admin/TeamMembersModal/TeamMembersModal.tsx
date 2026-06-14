"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import { Section, Button, ErrorBox } from "@/components/admin/ui/FormField";
import { useDialog } from "@/components/ui/DialogProvider";
import Spinner from "@/components/ui/Spinner/Spinner";
import styles from "./TeamMembersModal.module.css";

type Role = "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI" | "AKADEMIK";
const FIELD_ROLES: Role[] = ["FASILITATOR", "PENGAJAR", "DOKUMENTASI"];
const ACADEMIC_ROLES: Role[] = ["AKADEMIK"];
const ROLE_LABEL: Record<Role, string> = {
  FASILITATOR: "Fasilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
  AKADEMIK: "Akademik",
};

interface Member {
  memberId: string;
  volunteerId: string;
  role: Role;
  joinedAt?: string;
  registry: {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    isActive?: boolean;
  } | null;
}

interface RegistryEntry {
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
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  teamId: string;
  teamName?: string;
  teamRole?: string;
}

export default function TeamMembersModal({
  isOpen,
  onClose,
  teamId,
  teamName,
  teamRole,
}: Props) {
  const { showConfirm } = useDialog();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form state
  const [searchQuery, setSearchQuery] = useState("");
  const [registryEntries, setRegistryEntries] = useState<RegistryEntry[]>([]);
  const [registryLoading, setRegistryLoading] = useState(false);
  const [selectedVolunteer, setSelectedVolunteer] = useState<RegistryEntry | null>(
    null,
  );
  const [candidateFilter, setCandidateFilter] = useState<"AVAILABLE" | "OTHER_TEAM" | "ALL">("AVAILABLE");
  const [pickedRole, setPickedRole] = useState<Role>("PENGAJAR");
  const [adding, setAdding] = useState(false);
  const [transferConfirm, setTransferConfirm] = useState<{
    fromTeamId: string;
    fromTeamName?: string;
  } | null>(null);
  const isAcademicTeam = teamRole === "TIM_AKADEMIK";
  const roleOptions = isAcademicTeam ? ACADEMIC_ROLES : FIELD_ROLES;

  const fetchMembers = useCallback(async () => {
    if (!teamId) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/volunteers/${teamId}/members`);
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
      } else {
        const data = await res.json();
        setError(data.error || "Gagal memuat anggota");
      }
    } catch {
      setError("Gagal memuat anggota");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  const fetchRegistry = useCallback(async () => {
    setRegistryLoading(true);
    try {
      const res = await fetch("/api/admin/volunteer-registry?active=true");
      if (res.ok) {
        const data = await res.json();
        setRegistryEntries(data.volunteers || []);
      }
    } catch (err) {
      console.error("Gagal memuat registry relawan", err);
    } finally {
      setRegistryLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      fetchRegistry();
      setSelectedVolunteer(null);
      setSearchQuery("");
      setCandidateFilter("AVAILABLE");
      setPickedRole(isAcademicTeam ? "AKADEMIK" : "PENGAJAR");
      setTransferConfirm(null);
    }
  }, [isOpen, fetchMembers, fetchRegistry, isAcademicTeam]);

  const candidateStats = useMemo(() => {
    const alreadyIds = new Set(members.map((m) => m.volunteerId));
    let available = 0;
    let otherTeam = 0;
    let all = 0;
    for (const entry of registryEntries) {
      if (alreadyIds.has(entry._id)) continue;
      all += 1;
      if (entry.currentTeam && entry.currentTeam.id !== teamId) otherTeam += 1;
      else available += 1;
    }
    return { available, otherTeam, all };
  }, [members, registryEntries, teamId]);

  const filteredCandidates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const alreadyIds = new Set(members.map((m) => m.volunteerId));
    return registryEntries
      .filter((entry) => !alreadyIds.has(entry._id))
      .filter((entry) => {
        if (candidateFilter === "AVAILABLE") {
          return !entry.currentTeam || entry.currentTeam.id === teamId;
        }
        if (candidateFilter === "OTHER_TEAM") {
          return !!entry.currentTeam && entry.currentTeam.id !== teamId;
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
      .slice(0, 60);
  }, [candidateFilter, members, registryEntries, searchQuery, teamId]);

  const handlePickVolunteer = (v: RegistryEntry) => {
    setSelectedVolunteer(v);
    // Kalau orang ini sudah anggota tim ini, blokir di FE.
    if (members.some((m) => m.volunteerId === v._id)) {
      setError(`${v.name} sudah jadi anggota tim ini.`);
      return;
    }
    setError("");
    setPickedRole(isAcademicTeam ? "AKADEMIK" : pickedRole);
    if (v.currentTeam && v.currentTeam.id !== teamId) {
      setTransferConfirm({
        fromTeamId: v.currentTeam.id,
        fromTeamName: v.currentTeam.teamName,
      });
    } else {
      setTransferConfirm(null);
    }
  };

  const handleAddMember = async () => {
    if (!selectedVolunteer) {
      setError("Pilih dulu relawan dari daftar.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const body: Record<string, unknown> = {
        volunteerId: selectedVolunteer._id,
        role: pickedRole,
      };
      if (transferConfirm) {
        body.transferFromTeamId = transferConfirm.fromTeamId;
      }
      const res = await fetch(`/api/admin/volunteers/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.error === "TRANSFER_REQUIRED" && data.currentTeam) {
          // Backend bilang butuh konfirmasi — tampilkan di UI.
          setTransferConfirm({
            fromTeamId: data.currentTeam.id,
            fromTeamName: data.currentTeam.teamName,
          });
          setError(
            `${selectedVolunteer.name} masih anggota tim "${data.currentTeam.teamName ?? "lain"}". Klik Pindahkan untuk konfirmasi.`,
          );
        } else {
          setError(data.error || "Gagal menambahkan anggota");
        }
        return;
      }
      // Reset form, refresh.
      setSelectedVolunteer(null);
      setSearchQuery("");
      setTransferConfirm(null);
      setPickedRole(isAcademicTeam ? "AKADEMIK" : "PENGAJAR");
      fetchMembers();
    } catch {
      setError("Terjadi kesalahan koneksi");
    } finally {
      setAdding(false);
    }
  };

  const handleChangeRole = async (volunteerId: string, role: Role) => {
    try {
      const res = await fetch(`/api/admin/volunteers/${teamId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volunteerId, role }),
      });
      if (res.ok) fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemove = async (m: Member) => {
    const isConfirmed = await showConfirm(
      `Hapus ${m.registry?.name ?? "anggota"} dari tim ini? Riwayat kehadiran tetap tersimpan.`,
      "Hapus Anggota Tim"
    );
    if (!isConfirmed) return;
    try {
      const res = await fetch(
        `/api/admin/volunteers/${teamId}/members?volunteerId=${m.volunteerId}`,
        { method: "DELETE" },
      );
      if (res.ok) fetchMembers();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <AdminModal
      isOpen={isOpen}
      onClose={onClose}
      title="Kelola Anggota Tim"
      subtitle={teamName ? `Tim: ${teamName}` : "Atur siapa saja anggota tim ini"}
      icon={Users}
      footer={
        <>
          <Button type="button" variant="cancel" onClick={onClose}>
            Tutup
          </Button>
        </>
      }
    >
      {error && <ErrorBox message={error} />}

      <Section
        title="Tambah Anggota"
        description="Pilih relawan aktif dari daftar. Kalau orang sudah di tim lain, sistem akan minta konfirmasi pindah."
      >
        <div className={styles.addPanel}>
          <div className={styles.pickerToolbar}>
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

            <div className={styles.searchBox}>
              <Search size={15} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Filter nama, kontak, atau tim..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>

          <div className={styles.candidateList}>
            {registryLoading ? (
              <div className={styles.loading}>
                <Spinner />
                <p>Memuat daftar relawan...</p>
              </div>
            ) : filteredCandidates.length === 0 ? (
              <div className={styles.pickerEmpty}>
                Tidak ada kandidat. Tambah orang dulu di{" "}
                <a href="/admin/volunteer-registry" className={styles.link}>
                  Daftar Relawan
                </a>
                .
              </div>
            ) : (
              filteredCandidates.map((v) => {
                const selected = selectedVolunteer?._id === v._id;
                const inOtherTeam = v.currentTeam && v.currentTeam.id !== teamId;
                return (
                  <button
                    key={v._id}
                    type="button"
                    className={`${styles.candidateCard} ${selected ? styles.candidateCardSelected : ""}`}
                    onClick={() => handlePickVolunteer(v)}
                  >
                    <span className={styles.candidateAvatar}>
                      {v.name.charAt(0).toUpperCase()}
                    </span>
                    <span className={styles.candidateBody}>
                      <span className={styles.candidateTop}>
                        <span className={styles.candidateName}>{v.name}</span>
                        {selected && <CheckCircle2 size={14} className={styles.selectedIcon} />}
                      </span>
                      <span className={styles.candidateMeta}>
                        {v.phone || v.email || "Kontak belum diisi"}
                      </span>
                      {inOtherTeam ? (
                        <span className={styles.candidateWarn}>
                          <AlertTriangle size={11} />
                          {v.currentTeam?.teamName ?? "Tim lain"}
                          {v.currentTeam?.region ? ` · ${v.currentTeam.region}` : ""}
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

          <div className={styles.addControls}>
            <div className={styles.selectedSummary}>
              <span className={styles.selectedLabel}>Dipilih</span>
              <strong>{selectedVolunteer?.name ?? "Belum ada"}</strong>
            </div>

            <div className={styles.roleChips} aria-label="Pilih role anggota">
              {roleOptions.map((r) => (
                <button
                  key={r}
                  type="button"
                  className={`${styles.roleChip} ${pickedRole === r ? styles.roleChipActive : ""}`}
                  onClick={() => setPickedRole(r)}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>

            <button
              type="button"
              className={styles.addBtn}
              onClick={handleAddMember}
              disabled={!selectedVolunteer || adding}
            >
              <UserPlus size={14} />
              {transferConfirm
                ? "Pindahkan ke Tim Ini"
                : adding
                  ? "Menambah..."
                  : "Tambahkan"}
            </button>
          </div>
        </div>

        {transferConfirm && (
          <div className={styles.transferNotice}>
            <AlertTriangle size={14} />
            <span>
              <strong>{selectedVolunteer?.name}</strong> saat ini di tim{" "}
              <strong>
                &quot;{transferConfirm.fromTeamName ?? "lain"}&quot;
              </strong>
              . Klik tombol di atas untuk pindahkan. Riwayat kehadiran lama
              tetap tersimpan.
            </span>
          </div>
        )}
      </Section>

      <Section title={`Daftar Anggota (${members.length})`}>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat...</p>
          </div>
        ) : members.length === 0 ? (
          <div className={styles.empty}>
            Belum ada anggota. Tambahkan dari form di atas.
          </div>
        ) : (
          <div className={styles.memberList}>
            {members.map((m) => (
              <div key={m.volunteerId} className={styles.memberRow}>
                <div className={styles.memberInfo}>
                  <div className={styles.memberAvatar}>
                    {m.registry?.name?.charAt(0).toUpperCase() ?? "?"}
                  </div>
                  <div>
                    <div className={styles.memberName}>
                      {m.registry?.name ?? "(tidak ditemukan)"}
                      {m.registry && !m.registry.isActive && (
                        <span className={styles.inactiveTag}>
                          non-aktif
                        </span>
                      )}
                    </div>
                    {m.registry?.phone || m.registry?.email ? (
                      <div className={styles.memberMeta}>
                        {m.registry.phone ?? ""}
                        {m.registry.phone && m.registry.email ? " · " : ""}
                        {m.registry.email ?? ""}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className={styles.memberActions}>
                  <select
                    value={m.role}
                    onChange={(e) =>
                      handleChangeRole(m.volunteerId, e.target.value as Role)
                    }
                    className={styles.memberRoleSelect}
                  >
                    {roleOptions.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className={styles.removeBtn}
                    onClick={() => handleRemove(m)}
                    title="Hapus dari tim"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>
    </AdminModal>
  );
}
