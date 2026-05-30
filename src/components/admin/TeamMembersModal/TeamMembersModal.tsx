"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Trash2,
  Search,
  AlertTriangle,
  ChevronDown,
} from "lucide-react";
import { AdminModal } from "@/components/admin/ui/AdminModal";
import { Section, Button, ErrorBox } from "@/components/admin/ui/FormField";
import { useDialog } from "@/components/ui/DialogProvider";
import styles from "./TeamMembersModal.module.css";

type Role = "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI";
const ROLES: Role[] = ["FASILITATOR", "PENGAJAR", "DOKUMENTASI"];
const ROLE_LABEL: Record<Role, string> = {
  FASILITATOR: "Fasilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
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
}

export default function TeamMembersModal({
  isOpen,
  onClose,
  teamId,
  teamName,
}: Props) {
  const { showConfirm, showAlert } = useDialog();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add form state
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RegistryEntry[]>([]);
  const [selectedVolunteer, setSelectedVolunteer] = useState<RegistryEntry | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedRole, setPickedRole] = useState<Role>("PENGAJAR");
  const [adding, setAdding] = useState(false);
  const [transferConfirm, setTransferConfirm] = useState<{
    fromTeamId: string;
    fromTeamName?: string;
  } | null>(null);

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

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      setSelectedVolunteer(null);
      setSearchQuery("");
      setSearchResults([]);
      setPickedRole("PENGAJAR");
      setTransferConfirm(null);
    }
  }, [isOpen, fetchMembers]);

  // Live search registry — debounced
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/volunteer-registry?q=${encodeURIComponent(searchQuery.trim())}&active=true`,
        );
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.volunteers || []);
        }
      } catch (err) {
        console.error(err);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [searchQuery]);

  const handlePickVolunteer = (v: RegistryEntry) => {
    setSelectedVolunteer(v);
    setSearchQuery(v.name);
    setPickerOpen(false);
    // Kalau orang ini sudah anggota tim ini, blokir di FE.
    if (members.some((m) => m.volunteerId === v._id)) {
      setError(`${v.name} sudah jadi anggota tim ini.`);
      return;
    }
    setError("");
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
      setPickedRole("PENGAJAR");
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
        description="Cari nama dari registry. Kalau orang sudah di tim lain, sistem akan minta konfirmasi pindah."
      >
        <div className={styles.addRow}>
          <div className={styles.searchBox}>
            <Search size={16} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Ketik nama relawan..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedVolunteer(null);
                setTransferConfirm(null);
                setPickerOpen(true);
              }}
              onFocus={() => setPickerOpen(true)}
              className={styles.searchInput}
            />
            {pickerOpen && searchQuery.trim() && searchResults.length > 0 && (
              <div className={styles.picker}>
                {searchResults.map((v) => {
                  const alreadyMember = members.some(
                    (m) => m.volunteerId === v._id,
                  );
                  const inOtherTeam =
                    v.currentTeam && v.currentTeam.id !== teamId;
                  return (
                    <button
                      key={v._id}
                      type="button"
                      className={styles.pickerItem}
                      disabled={alreadyMember}
                      onClick={() => handlePickVolunteer(v)}
                    >
                      <div className={styles.pickerName}>{v.name}</div>
                      <div className={styles.pickerMeta}>
                        {alreadyMember ? (
                          <span className={styles.metaWarn}>
                            sudah anggota tim ini
                          </span>
                        ) : inOtherTeam ? (
                          <span className={styles.metaWarn}>
                            <AlertTriangle size={11} /> di tim &quot;
                            {v.currentTeam?.teamName ?? "lain"}&quot;
                          </span>
                        ) : (
                          <span>belum di tim manapun</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            {pickerOpen &&
              searchQuery.trim() &&
              searchResults.length === 0 && (
                <div className={styles.picker}>
                  <div className={styles.pickerEmpty}>
                    Tidak ada yang cocok. Tambah orang dulu di{" "}
                    <a href="/admin/volunteer-registry" className={styles.link}>
                      Daftar Relawan
                    </a>
                    .
                  </div>
                </div>
              )}
          </div>

          <div className={styles.roleSelectWrap}>
            <select
              className={styles.roleSelect}
              value={pickedRole}
              onChange={(e) => setPickedRole(e.target.value as Role)}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className={styles.chevronIcon} />
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
          <div className={styles.empty}>Memuat...</div>
        ) : members.length === 0 ? (
          <div className={styles.empty}>
            Belum ada anggota. Tambahkan dari form di atas.
          </div>
        ) : (
          <div className={styles.memberList}>
            {members.map((m) => (
              <div key={m.memberId} className={styles.memberRow}>
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
                    {ROLES.map((r) => (
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
