"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import SearchableSelect from "@/components/admin/ui/SearchableSelect/SearchableSelect";
import VolunteerTable, { Volunteer } from "@/components/admin/VolunteerTable/VolunteerTable";
import VolunteerModal from "@/components/admin/VolunteerModal/VolunteerModal";
import styles from "./volunteers.module.css";
import { useDialog } from "@/components/ui/DialogProvider";
import { useToast } from "@/components/toast/ToastProvider";
import { getTeamAccountRoleLabel } from "@/lib/roles";
import Spinner from "@/components/ui/Spinner/Spinner";

export default function AdminVolunteersPage() {
  const { showConfirm } = useDialog();
  const { showToast } = useToast();
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editing, setEditing] = useState<Volunteer | null>(null);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [memberFilter, setMemberFilter] = useState<"ALL" | "WITH_MEMBERS" | "EMPTY">("ALL");

  const fetchVolunteers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/volunteers");
      if (res.ok) {
        const data = await res.json();
        setVolunteers(data.volunteers || []);
      }
    } catch (err) {
      console.error("Gagal mengambil data relawan", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchVolunteers();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchVolunteers]);

  const handleDelete = async (id: string) => {
    const isConfirmed = await showConfirm("Hapus akun tim ini?", "Hapus Tim");
    if (!isConfirmed) return;
    try {
      const res = await fetch(`/api/admin/volunteers/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setVolunteers(volunteers.filter((v) => v._id !== id));
        showToast("Akun tim berhasil dihapus");
      } else {
        const data = await res.json();
        showToast(data.error || "Gagal menghapus akun tim", "error");
      }
    } catch {
      showToast("Terjadi kesalahan saat menghapus akun tim", "error");
    }
  };

  const handleAdd = () => {
    setEditing(null);
    setIsModalOpen(true);
  };

  const handleEdit = (v: Volunteer) => {
    setEditing(v);
    setIsModalOpen(true);
  };

  const regionOptions = useMemo(() => {
    return Array.from(
      new Set(
        volunteers
          .map((v) => v.region?.trim())
          .filter((region): region is string => Boolean(region))
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [volunteers]);

  const roleOptions = useMemo(() => {
    return Array.from(new Set(volunteers.map((v) => v.role))).sort((a, b) =>
      getTeamAccountRoleLabel(a).localeCompare(getTeamAccountRoleLabel(b))
    );
  }, [volunteers]);

  const filteredVolunteers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return volunteers.filter((v) => {
      const memberCount = v.memberDetails?.length ?? 0;
      const matchesSearch =
        !q ||
        [
          v.name,
          v.teamName,
          v.email,
          v.region,
          getTeamAccountRoleLabel(v.role),
          ...(v.memberDetails ?? []).map((m) => m.name),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      const matchesRegion = regionFilter === "ALL" || v.region === regionFilter;
      const matchesRole = roleFilter === "ALL" || v.role === roleFilter;
      const matchesMembers =
        memberFilter === "ALL" ||
        (memberFilter === "WITH_MEMBERS" ? memberCount > 0 : memberCount === 0);

      return matchesSearch && matchesRegion && matchesRole && matchesMembers;
    });
  }, [memberFilter, regionFilter, roleFilter, search, volunteers]);

  const hasActiveFilter =
    search.trim() || regionFilter !== "ALL" || roleFilter !== "ALL" || memberFilter !== "ALL";

  const resetFilters = () => {
    setSearch("");
    setRegionFilter("ALL");
    setRoleFilter("ALL");
    setMemberFilter("ALL");
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat data relawan...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Daftar Pengelolaan Tim</h1>
        <p className={styles.subtitle}>
          Akun login bersifat per tim. Satu akun mewakili satu tim dengan peran relawan berbeda sesuai pekannya. Silakan kelola tim di menu {" "}
          <a
            href="/admin/volunteer-registry"
            style={{
              color: "#F58220",
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: "2px"
            }}
          >
            Daftar Relawan
          </a>.
        </p>
      </div>
      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Cari tim, email, lokasi, atau anggota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <SearchableSelect
          value={regionFilter === "ALL" ? "" : regionFilter}
          onChange={(v) => setRegionFilter(v || "ALL")}
          placeholder="Semua Lokasi Bertugas"
          clearable
          clearLabel="Semua Lokasi Bertugas"
          options={regionOptions.map(r => ({ value: r, label: r }))}
        />

        <SearchableSelect
          value={roleFilter === "ALL" ? "" : roleFilter}
          onChange={(v) => setRoleFilter(v || "ALL")}
          placeholder="Semua jenis akun"
          clearable
          clearLabel="Semua jenis akun"
          options={roleOptions.map(r => ({ value: r, label: getTeamAccountRoleLabel(r) }))}
        />

        <SearchableSelect
          value={memberFilter === "ALL" ? "" : memberFilter}
          onChange={(v) => setMemberFilter((v || "ALL") as typeof memberFilter)}
          placeholder="Semua status anggota"
          clearable
          clearLabel="Semua status anggota"
          options={[
            { value: "WITH_MEMBERS", label: "Sudah ada relawan" },
            { value: "EMPTY", label: "Belum ada relawan" }
          ]}
        />

        {hasActiveFilter && (
          <button type="button" className={styles.resetBtn} onClick={resetFilters}>
            Reset
          </button>
        )}

        <div className={styles.resultCount}>
          {filteredVolunteers.length} dari {volunteers.length} akun
        </div>
      </div>

      <VolunteerTable
        volunteers={filteredVolunteers}
        onDelete={handleDelete}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onMembersChange={fetchVolunteers}
      />

      <VolunteerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={(message) => {
          fetchVolunteers();
          showToast(message);
        }}
        volunteerToEdit={editing}
      />
    </div>
  );
}
