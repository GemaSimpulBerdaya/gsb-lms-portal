"use client";

import { useEffect, useState } from "react";
import styles from "./adminDashboard.module.css";
import Link from "next/link";

interface DashboardReport {
  _id: string;
  title: string;
  date: string;
  region?: string;
  teamAccountId: {
    name: string;
    teamName?: string;
  };
}

interface DashboardSchedule {
  _id: string;
  region: string;
  fase: string;
  date: string;
  meetingType: string;
  topic: string;
  petugasCount: number;
}

export function DashboardFeed() {
  const [reports, setReports] = useState<DashboardReport[]>([]);
  const [schedules, setSchedules] = useState<DashboardSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [reportsRes, schedulesRes] = await Promise.all([
          fetch("/api/admin/dashboard/reports"),
          fetch("/api/admin/dashboard/schedules")
        ]);

        if (reportsRes.ok) {
          const reportsData = await reportsRes.json();
          setReports(reportsData.reports || []);
        }

        if (schedulesRes.ok) {
          const schedulesData = await schedulesRes.json();
          setSchedules(schedulesData.schedules || []);
        }
      } catch (err) {
        console.error("Gagal mengambil data feed", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return <div className={styles.loadingContainer}>Memuat data feed...</div>;
  }

  return (
    <div className={styles.chartsGrid}>
      <div className={styles.chartCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 className={styles.chartTitle} style={{ margin: 0 }}>Jadwal 7 Hari Kedepan</h3>
          <Link href="/admin/schedules" style={{ fontSize: 12, color: "var(--admin-primary-dark)", fontWeight: 700, textDecoration: "none" }}>
            Lihat Semua →
          </Link>
        </div>
        
        {schedules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--admin-muted)", fontSize: 13, fontWeight: 600 }}>
            Tidak ada jadwal mengajar dalam 7 hari kedepan.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {schedules.map((schedule, idx) => {
              const dateObj = new Date(schedule.date);
              
              return (
                <div key={`${schedule._id}-${idx}`} style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--admin-border)", background: "#fffaf5" }}>
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: "var(--admin-hero)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1.1 }}>
                    <span style={{ fontSize: 18, fontWeight: 800 }}>{dateObj.getDate()}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "var(--admin-ink)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {schedule.region} • Fase {schedule.fase}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--admin-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ fontWeight: 600 }}>{schedule.meetingType || "KBM"}</span> — {schedule.topic || "Agenda belum diset"}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span className={schedule.petugasCount > 0 ? styles.badgeSuccess : styles.badgePurple}>
                      {schedule.petugasCount} Relawan
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className={styles.chartCard}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <h3 className={styles.chartTitle} style={{ margin: 0 }}>Laporan Terbaru</h3>
          <Link href="/admin/reports" style={{ fontSize: 12, color: "var(--admin-primary-dark)", fontWeight: 700, textDecoration: "none" }}>
            Semua →
          </Link>
        </div>

        {reports.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--admin-muted)", fontSize: 13, fontWeight: 600 }}>
            Belum ada laporan masuk.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {reports.map((report) => (
              <div key={report._id} style={{ display: "flex", gap: 12, paddingBottom: 12, borderBottom: "1px solid var(--admin-border)", alignItems: "flex-start" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "rgba(245, 130, 32, 0.12)", color: "var(--admin-primary-dark)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
                  {report.teamAccountId?.name?.charAt(0) || "U"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--admin-ink)", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {report.title}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--admin-muted)", display: "flex", gap: 6, alignItems: "center" }}>
                    <span style={{ fontWeight: 600 }}>{report.region || "Umum"}</span>
                    <span>•</span>
                    <span>{new Date(report.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
