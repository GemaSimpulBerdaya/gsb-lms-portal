"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCog, Users } from "lucide-react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import TeamMembersModal from "@/components/admin/TeamMembersModal";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import Spinner from "@/components/ui/Spinner/Spinner";
import { getTeamAccountRoleLabel } from "@/lib/roles";
import styles from "./team-members.module.css";

type MemberDetail = {
  volunteerId: string;
  name: string;
  isActive: boolean;
  role: "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI" | "AKADEMIK";
};

type TeamRow = {
  _id: string;
  email: string;
  teamName?: string;
  region?: string;
  role: string;
  name?: string;
  memberDetails?: MemberDetail[];
};

const ROLE_DOT: Record<MemberDetail["role"], string> = {
  FASILITATOR: "#F58220",
  PENGAJAR: "#0ea5e9",
  DOKUMENTASI: "#10b981",
  AKADEMIK: "#7c3aed",
};

export default function AdminTeamMembersPage() {
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("ALL");
  const [memberFilter, setMemberFilter] = useState<"ALL" | "WITH_MEMBERS" | "EMPTY">("ALL");
  const [page, setPage] = useState(1);
  const itemsPerPage = 10;
  const [membersModal, setMembersModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
    role: string;
  }>({ isOpen: false, id: "", name: "", role: "" });

  const fetchTeams = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/volunteers");
      if (res.ok) {
        const data = await res.json();
        setTeams(data.teamAccounts || data.volunteers || []);
      }
    } catch (err) {
      console.error("Gagal memuat akun tim", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(fetchTeams, 0);
    return () => clearTimeout(t);
  }, [fetchTeams]);

  const regionOptions = useMemo(
    () =>
      Array.from(
        new Set(
          teams
            .map((t) => t.region?.trim())
            .filter((region): region is string => Boolean(region)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [teams],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      const memberCount = t.memberDetails?.length ?? 0;
      const matchesSearch =
        !q ||
        [
          t.name,
          t.teamName,
          t.email,
          t.region,
          getTeamAccountRoleLabel(t.role),
          ...(t.memberDetails ?? []).map((m) => m.name),
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));
      const matchesRegion = regionFilter === "ALL" || t.region === regionFilter;
      const matchesMembers =
        memberFilter === "ALL" ||
        (memberFilter === "WITH_MEMBERS" ? memberCount > 0 : memberCount === 0);
      return matchesSearch && matchesRegion && matchesMembers;
    });
  }, [memberFilter, regionFilter, search, teams]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [filtered.length]);

  const pageRows = filtered.slice((page - 1) * itemsPerPage, page * itemsPerPage);
  const hasActiveFilter =
    search.trim() || regionFilter !== "ALL" || memberFilter !== "ALL";

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat anggota tim...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Anggota Tim</h1>
        <p className={styles.subtitle}>
          Masukkan relawan dari{" "}
          <a href="/admin/volunteer-registry" className={styles.inlineLink}>
            Daftar Relawan
          </a>{" "}
          ke akun tim per wilayah. Peran registry dipakai default saat tambah; bisa diganti di sini.
          Akun login tetap di{" "}
          <a href="/admin/volunteers" className={styles.inlineLink}>
            Akun Tim
          </a>
          .
        </p>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.searchWrap}>
          <input
            type="text"
            placeholder="Cari tim, lokasi, atau nama anggota..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <AdminFilterSelect
          width="lg"
          value={regionFilter === "ALL" ? "" : regionFilter}
          onChange={(v) => setRegionFilter(v || "ALL")}
          placeholder="Semua Lokasi Belajar"
          clearable
          clearLabel="Semua Lokasi Belajar"
          options={regionOptions.map((r) => ({ value: r, label: r }))}
        />

        <AdminFilterSelect
          value={memberFilter === "ALL" ? "" : memberFilter}
          onChange={(v) => setMemberFilter((v || "ALL") as typeof memberFilter)}
          placeholder="Semua status anggota"
          clearable
          clearLabel="Semua status anggota"
          options={[
            { value: "WITH_MEMBERS", label: "Sudah ada relawan" },
            { value: "EMPTY", label: "Belum ada relawan" },
          ]}
        />

        {hasActiveFilter && (
          <button
            type="button"
            className={styles.resetBtn}
            onClick={() => {
              setSearch("");
              setRegionFilter("ALL");
              setMemberFilter("ALL");
            }}
          >
            Reset
          </button>
        )}

        <div className={styles.resultCount}>
          {filtered.length} dari {teams.length} tim
        </div>
      </div>

      <div className={styles.tableSection}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Daftar Tim per Wilayah</h3>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>TIM</th>
                <th>JENIS</th>
                <th>LOKASI</th>
                <th>ANGGOTA</th>
                <th>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((t) => {
                const memberCount = t.memberDetails?.length ?? 0;
                const label =
                  t.teamName ||
                  (t.name && t.name !== "No Name" ? t.name : t.email.split("@")[0]);
                return (
                  <tr key={t._id}>
                    <td>
                      <div className={styles.teamCell}>
                        <div className={styles.avatar}>{label.charAt(0).toUpperCase()}</div>
                        <div>
                          <div className={styles.teamName}>{label}</div>
                          <div className={styles.teamEmail}>{t.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{getTeamAccountRoleLabel(t.role)}</td>
                    <td>{t.region || "—"}</td>
                    <td>
                      {memberCount === 0 ? (
                        <span className={styles.emptyMembers}>Belum ada anggota</span>
                      ) : (
                        <div className={styles.memberStack}>
                          <div className={styles.memberCount}>{memberCount} anggota</div>
                          <div className={styles.memberChips}>
                            {(t.memberDetails ?? []).slice(0, 4).map((m) => (
                              <span
                                key={m.volunteerId}
                                className={styles.memberChip}
                                title={`${m.name} · ${m.role}`}
                              >
                                <span
                                  className={styles.roleDot}
                                  style={{ background: ROLE_DOT[m.role] }}
                                />
                                {m.name}
                              </span>
                            ))}
                            {memberCount > 4 && (
                              <span className={styles.moreChip}>+{memberCount - 4}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className={styles.manageBtn}
                        onClick={() =>
                          setMembersModal({
                            isOpen: true,
                            id: t._id,
                            name: label,
                            role: t.role,
                          })
                        }
                      >
                        <UserCog size={13} />
                        Kelola Anggota
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className={styles.emptyRow}>
                    <Users size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div>Belum ada akun tim. Buat dulu di menu Akun Tim.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <AdminPagination
          page={page}
          totalItems={filtered.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setPage}
        />
      </div>

      <TeamMembersModal
        isOpen={membersModal.isOpen}
        teamId={membersModal.id}
        teamName={membersModal.name}
        teamRole={membersModal.role}
        onClose={() => {
          setMembersModal({ ...membersModal, isOpen: false });
          fetchTeams();
        }}
      />
    </div>
  );
}
