"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./VolunteerScheduleModal.module.css";

interface Schedule {
  _id: string;
  region: string;
  level: string;
  semester: string;
  activeWeek: number;
  updatedAt: string;
}

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
      // We'll create a new admin API for this or use an existing one if possible
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
            <div className={styles.loading}>Memuat jadwal...</div>
          ) : schedules.length === 0 ? (
            <div className={styles.empty}>Relawan ini belum memiliki jadwal mengajar.</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Wilayah</th>
                    <th>Jenjang</th>
                    <th>Semester</th>
                    <th>Pekan</th>
                  </tr>
                </thead>
                <tbody>
                  {schedules.map(s => (
                    <tr key={s._id}>
                      <td>{s.region}</td>
                      <td>
                        <span className={`${styles.levelTag} ${styles[s.level]}`}>
                          {s.level}
                        </span>
                      </td>
                      <td>{s.semester}</td>
                      <td>Minggu {s.activeWeek}</td>
                    </tr>
                  ))}
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
