"use client";

import styles from "./VolunteerTable.module.css";
import { useState, useEffect } from "react";
import DeleteConfirmModal from "../DeleteConfirmModal/DeleteConfirmModal";
import VolunteerScheduleModal from "../VolunteerScheduleModal/VolunteerScheduleModal";

export interface Volunteer {
  _id: string;
  email: string;
  teamName?: string;
  region?: string;
  role: string;
  name?: string;
}

interface VolunteerTableProps {
  volunteers: Volunteer[];
  onDelete: (id: string) => void;
  onAdd: () => void;
}

export default function VolunteerTable({ volunteers, onDelete, onAdd }: VolunteerTableProps) {
  const [mounted, setMounted] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: "",
    name: ""
  });
  const [scheduleModal, setScheduleModal] = useState<{ isOpen: boolean; id: string; name: string }>({
    isOpen: false,
    id: "",
    name: ""
  });

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(t);
  }, []);

  const getRandomColor = (str: string) => {
    const colors = ["#e67e22", "#27ae60", "#2980b9", "#8e44ad", "#c0392b", "#16a085"];
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
    <div className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}>
      <div className={styles.tableHeader}>
        <h3 className={styles.tableTitle}>Manajemen Relawan</h3>
        <button className={styles.addBtn} onClick={onAdd}>
          <span>+</span> Tambah Relawan
        </button>
      </div>

      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>RELAWAN</th>
              <th>TEAM</th>
              <th>WILAYAH</th>
              <th>STATUS</th>
              <th>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {volunteers.map((v, i) => (
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
                      {v.name ? v.name.charAt(0) : v.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className={styles.volunteerName}>
                        {v.name && v.name !== "No Name" ? v.name : v.email.split('@')[0]}
                      </div>
                      <div className={styles.volunteerEmail}>{v.email}</div>
                    </div>
                  </div>
                </td>
                <td className={styles.teamCell}>{v.teamName || "-"}</td>
                <td className={styles.regionCell}>{v.region || "-"}</td>
                <td>
                   <span style={{ 
                     fontSize: '11px', 
                     fontWeight: '700', 
                     padding: '4px 8px', 
                     borderRadius: '20px',
                     background: '#e8f5e9',
                     color: '#2e7d32'
                   }}>
                     Active
                   </span>
                </td>
                <td>
                  <div className={styles.actions}>
                    <button 
                      className={styles.scheduleBtn}
                      onClick={() => setScheduleModal({ isOpen: true, id: v._id, name: v.name || v.email })}
                    >
                      Cek Jadwal
                    </button>
                    <button className={styles.editBtn}>Edit</button>
                    <button 
                      className={styles.deleteBtn}
                      onClick={() => setDeleteModal({ isOpen: true, id: v._id, name: v.name || v.email })}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {volunteers.length === 0 && (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
                  Belum ada data relawan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <DeleteConfirmModal 
        isOpen={deleteModal.isOpen}
        title="Hapus Akun Relawan?"
        message={`Apakah Anda yakin ingin menghapus relawan "${deleteModal.name}"? Akses mereka ke portal akan segera dicabut.`}
        onClose={() => setDeleteModal({ ...deleteModal, isOpen: false })}
        onConfirm={handleConfirmDelete}
      />

      <VolunteerScheduleModal 
        isOpen={scheduleModal.isOpen}
        volunteerId={scheduleModal.id}
        volunteerName={scheduleModal.name}
        onClose={() => setScheduleModal({ ...scheduleModal, isOpen: false })}
      />
    </div>
  );
}
