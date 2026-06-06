"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./VolunteerScheduleModal.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";

interface Schedule {
  _id: string;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  updatedAt: string;
  kbmDates: {
    week: number;
    date: string;
    topic?: string;
    petugas?: { _id: string; name: string; role?: string }[];
  }[];
}

const ROLE_LABEL: Record<string, string> = {
  FASILITATOR: "Fasilitator",
  PENGAJAR: "Pengajar",
  DOKUMENTASI: "Dokumentasi",
};

interface VolunteerScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  volunteerName: string;
  volunteerId: string;
}

export default function VolunteerScheduleModal({ isOpen, onClose, volunteerName, volunteerId }: VolunteerScheduleModalProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/volunteers/${volunteerId}/schedules`);
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error("Gagal load jadwal relawan", err);
    } finally {
      setLoading(false);
    }
  }, [volunteerId]);

  useEffect(() => {
    if (isOpen && volunteerId) {
      const timer = setTimeout(() => {
        fetchSchedules();
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, volunteerId, fetchSchedules]);

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>Jadwal Mengajar</h2>
            <p className={styles.subtitle}>Relawan: <strong>{volunteerName}</strong></p>
          </div>
          <button className={styles.closeBtn} onClick={onClose}>&times;</button>
        </div>

        <div className={styles.content}>
          {loading ? (
            <div className={styles.loading}>
              <Spinner />
              <p>Memuat jadwal...</p>
            </div>
          ) : schedules.length === 0 ? (
            <div className={styles.empty}>Relawan ini belum memiliki jadwal mengajar.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Lokasi Belajar</th>
                    <th>Jenjang</th>
                    <th>Pekan</th>
                    <th>Mata Pelajaran (Minggu Ini)</th>
                    <th>Tim Bertugas</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => {
                    const currentKbm = s.kbmDates?.find(k => k.week === s.activeWeek);
                    const teamTitle = currentKbm?.petugas?.length
                      ? currentKbm.petugas
                          .map(p => `${p.name} - ${ROLE_LABEL[p.role ?? ""] ?? p.role ?? "Fasilitator"}`)
                          .join(", ")
                      : "Belum ditentukan";

                    return (
                      <tr key={s._id}>
                        <td>{s.region}</td>
                        <td>
                          <span className={`${styles.levelTag} ${styles[s.fase]}`}>
                            {s.fase}
                          </span>
                        </td>
                        <td>Pekan {s.activeWeek}</td>
                        <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={currentKbm?.topic}>
                          {currentKbm?.topic || "—"}
                        </td>
                        <td title={teamTitle}>
                          {currentKbm?.petugas?.length ? (
                            <div className={styles.teamChips}>
                              {currentKbm.petugas.map((member) => (
                                <span key={member._id} className={styles.teamChip}>
                                  <span className={styles.teamName}>{member.name}</span>
                                  <span className={styles.teamRole}>
                                    {ROLE_LABEL[member.role ?? ""] ?? member.role ?? "Fasilitator"}
                                  </span>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className={styles.teamEmpty}>Belum ditentukan</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className={styles.footer}>
          <button className={styles.doneBtn} onClick={onClose}>Selesai</button>
        </div>
      </div>
    </div>
  );
}
