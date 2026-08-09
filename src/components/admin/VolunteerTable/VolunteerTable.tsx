"use client";

import styles from "./VolunteerTable.module.css";
import { useState, useEffect } from "react";
import { Users, Pencil, Trash2, Calendar } from "lucide-react";
import DeleteConfirmModal from "../DeleteConfirmModal/DeleteConfirmModal";
import VolunteerScheduleModal from "../VolunteerScheduleModal/VolunteerScheduleModal";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import { getTeamAccountRoleLabel } from "@/lib/roles";

export type MemberDetail = {
  volunteerId: string;
  name: string;
  isActive: boolean;
  role: "FASILITATOR" | "PENGAJAR" | "DOKUMENTASI" | "AKADEMIK";
  joinedAt?: string;
};

export interface Volunteer {
  _id: string;
  email: string;
  teamName?: string;
  region?: string;
  role: string;
  name?: string;
  memberDetails?: MemberDetail[];
}

interface VolunteerTableProps {
  volunteers: Volunteer[];
  onDelete: (id: string) => void;
  onAdd: () => void;
  onEdit?: (v: Volunteer) => void;
}

const ROLE_DOT: Record<MemberDetail["role"], string> = {
  FASILITATOR: "#F58220",
  PENGAJAR: "#0ea5e9",
  DOKUMENTASI: "#10b981",
  AKADEMIK: "#7c3aed",
};

export default function VolunteerTable({
  volunteers,
  onDelete,
  onAdd,
  onEdit,
}: VolunteerTableProps) {
  const [mounted, setMounted] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: "", name: "" });
  const [scheduleModal, setScheduleModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: "", name: "" });

  const [page, setPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPage(1));
    return () => window.cancelAnimationFrame(frame);
  }, [volunteers]);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const paginatedVolunteers = volunteers.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  const getRandomColor = (str: string) => {
    const colors = [
      "#F58220",
      "#0ea5e9",
      "#27ae60",
      "#8e44ad",
      "#c0392b",
      "#16a085",
    ];
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const handleConfirmDelete = () => {
    onDelete(deleteModal.id);
    setDeleteModal({ ...deleteModal, isOpen: false });
  };

  return (
    <div
      className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}
    >
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Akun Tim Relawan</h3>
        <button className={styles.addBtn} onClick={onAdd}>
          <span>+</span> Tambah Akun Tim
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>AKUN TIM</th>
              <th>JENIS AKUN</th>
              <th>LOKASI BELAJAR</th>
              <th>ANGGOTA</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {paginatedVolunteers.map((v) => {
              const memberCount = v.memberDetails?.length ?? 0;
              return (
                <tr
                  key={`${page}-${v._id}`}
                  className={mounted ? "admin-page-row" : styles.rowHidden}
                >
                  <td>
                    <div className={styles.volunteerCell}>
                      <div
                        className={styles.avatar}
                        style={{ background: getRandomColor(v.email) }}
                      >
                        {(v.teamName ?? v.name ?? v.email)
                          .charAt(0)
                          .toUpperCase()}
                      </div>
                      <div>
                        <div className={styles.volunteerName}>
                          {v.teamName ||
                            (v.name && v.name !== "No Name"
                              ? v.name
                              : v.email.split("@")[0])}
                        </div>
                        <div className={styles.volunteerEmail}>{v.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>{getTeamAccountRoleLabel(v.role)}</td>
                  <td className={styles.regionCell}>{v.region || "-"}</td>
                  <td>
                    {memberCount === 0 ? (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>
                        Belum ada — kelola di{" "}
                        <a
                          href="/admin/team-members"
                          style={{ color: "#F58220", fontWeight: 600 }}
                        >
                          Anggota Tim
                        </a>
                      </span>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 4,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            color: "#0f172a",
                          }}
                        >
                          {memberCount} anggota
                        </div>
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 4,
                          }}
                        >
                          {(v.memberDetails ?? []).slice(0, 3).map((m) => (
                            <span
                              key={m.volunteerId}
                              style={{
                                fontSize: 11,
                                color: m.isActive ? "#475569" : "#94a3b8",
                                background: "#f1f5f9",
                                padding: "2px 8px",
                                borderRadius: 999,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                              title={`${m.name} · ${m.role}`}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: ROLE_DOT[m.role],
                                  display: "inline-block",
                                }}
                              />
                              {m.name}
                            </span>
                          ))}
                          {memberCount > 3 && (
                            <span
                              style={{
                                fontSize: 11,
                                color: "#64748b",
                                fontWeight: 600,
                              }}
                            >
                              +{memberCount - 3}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button
                        className={styles.scheduleBtn}
                        onClick={() =>
                          setScheduleModal({
                            isOpen: true,
                            id: v._id,
                            name: v.teamName || v.name || v.email,
                          })
                        }
                        title="Lihat jadwal mengajar"
                      >
                        <Calendar size={13} />
                        Jadwal
                      </button>
                      <button
                        className={styles.editBtn}
                        onClick={() => onEdit?.(v)}
                      >
                        <Pencil size={13} /> Edit
                      </button>
                      <button
                        className={styles.deleteBtn}
                        onClick={() =>
                          setDeleteModal({
                            isOpen: true,
                            id: v._id,
                            name: v.teamName || v.name || v.email,
                          })
                        }
                        style={{
                          background: "#fee2e2",
                          color: "#991b1b",
                          borderColor: "#f87171",
                          fontWeight: 600,
                        }}
                      >
                        <Trash2 size={13} /> Hapus
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {volunteers.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    textAlign: "center",
                    padding: "40px",
                    color: "#888",
                  }}
                >
                  <Users
                    size={32}
                    style={{ opacity: 0.3, marginBottom: 8 }}
                  />
                  <div>Belum ada akun tim relawan.</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AdminPagination
        page={page}
        totalItems={volunteers.length}
        itemsPerPage={itemsPerPage}
        onPageChange={setPage}
      />

      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        title="Hapus Akun Tim?"
        message={`Yakin ingin hapus akun tim "${deleteModal.name}"? Akses login akan dicabut. Anggota tetap ada di registry, riwayat kehadiran tetap utuh.`}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
      />

      <VolunteerScheduleModal
        isOpen={scheduleModal.isOpen}
        volunteerId={scheduleModal.id}
        volunteerName={scheduleModal.name}
        onClose={() =>
          setScheduleModal({ ...scheduleModal, isOpen: false })
        }
      />
    </div>
  );
}
