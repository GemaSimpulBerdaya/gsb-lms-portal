"use client";

import styles from "./VolunteerTable.module.css";
import { useState, useEffect } from "react";
import { Users, Pencil, Trash2, Calendar, UserCog } from "lucide-react";
import DeleteConfirmModal from "../DeleteConfirmModal/DeleteConfirmModal";
import VolunteerScheduleModal from "../VolunteerScheduleModal/VolunteerScheduleModal";
import TeamMembersModal from "../TeamMembersModal";

export type MemberDetail = {
  volunteerId: string;
  name: string;
  isActive: boolean;
  role: "FACILITATOR" | "PENGAJAR" | "DOKUMENTASI";
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
  onMembersChange?: () => void;
}

const ROLE_DOT: Record<MemberDetail["role"], string> = {
  FACILITATOR: "#F58220",
  PENGAJAR: "#0ea5e9",
  DOKUMENTASI: "#10b981",
};

export default function VolunteerTable({
  volunteers,
  onDelete,
  onAdd,
  onEdit,
  onMembersChange,
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
  const [membersModal, setMembersModal] = useState<{
    isOpen: boolean;
    id: string;
    name: string;
  }>({ isOpen: false, id: "", name: "" });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

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

  const handleCloseMembers = () => {
    setMembersModal({ ...membersModal, isOpen: false });
    onMembersChange?.();
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
              <th>WILAYAH</th>
              <th>ANGGOTA</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.map((v, i) => {
              const memberCount = v.memberDetails?.length ?? 0;
              return (
                <tr
                  key={v._id}
                  className={mounted ? styles.rowAnim : styles.rowHidden}
                  style={{ animationDelay: `${0.05 * (i + 1)}s` }}
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
                  <td className={styles.regionCell}>{v.region || "-"}</td>
                  <td>
                    {memberCount === 0 ? (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>
                        Belum ada anggota
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
                        className={styles.scheduleBtn}
                        onClick={() =>
                          setMembersModal({
                            isOpen: true,
                            id: v._id,
                            name: v.teamName || v.name || v.email,
                          })
                        }
                        title="Kelola anggota tim"
                        style={{
                          background: "#fffbeb",
                          color: "#92400e",
                          borderColor: "#fcd34d",
                        }}
                      >
                        <UserCog size={13} />
                        Anggota
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
                  colSpan={4}
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

      <TeamMembersModal
        isOpen={membersModal.isOpen}
        teamId={membersModal.id}
        teamName={membersModal.name}
        onClose={handleCloseMembers}
      />
    </div>
  );
}
