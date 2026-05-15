"use client";

import { useState, useEffect } from "react";
import styles from "./dashboard.module.css";
import StatCard from "@/components/StatCard/StatCard";
import StudentTable from "@/components/StudentTable/StudentTable";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("User");
  const [greeting, setGreeting] = useState("Selamat pagi");
  const [stats, setStats] = useState({ totalStudents: 0, totalSchedules: 0, totalReports: 0 });
  const [students, setStudents] = useState<any[]>([]);
  const [, setLoading] = useState(true);
  
  const getCurrentSemester = () => {
    const d = new Date();
    return `${d.getFullYear()}-1`;
  };

  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });

  // Watch for changes from other pages/tabs
  useEffect(() => {
    const handleStorage = () => {
      const active = localStorage.getItem("activeSemester");
      if (active && active !== selectedSemester) {
        setSelectedSemester(active);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [selectedSemester]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/volunteer/dashboard/stats?semester=${selectedSemester}`);
        const data = await res.json();
        if (res.ok) {
          setStats(data.stats);
          
          // Map DB students to Table format
          const mappedStudents = (data.students || []).map((s: any) => ({
            id: s._id,
            name: s.name,
            course: s.category, // Level
            region: s.region,
            progress: 0, // Placeholder for now
            lastActive: "Active",
            avatar: s.name.charAt(0),
            color: ["#e67e22", "#27ae60", "#2980b9", "#8e44ad"][Math.floor(Math.random() * 4)]
          }));
          setStudents(mappedStudents);
        }
      } catch (err) {
        console.error("Gagal memuat stats dashboard", err);
      } finally {
        setLoading(false);
        setMounted(true);
      }
    };

    fetchData();
  }, [selectedSemester]);

  useEffect(() => {
    // ambil user dari localStorage (hasil login)
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");
    if (storedUser?.name) {
      setUserName(storedUser.name);
    }

    // greeting berdasarkan waktu
    const hour = new Date().getHours();
    if (hour < 11) setGreeting("Selamat pagi");
    else if (hour < 15) setGreeting("Selamat siang");
    else if (hour < 19) setGreeting("Selamat sore");
    else setGreeting("Selamat malam");
  }, []);

  return (
    <div className={`${styles.mainEnter} ${mounted ? styles.mounted : ""}`}>
      {/* Hero Header */}
      <div className={styles.hero}>
        <div className={styles.heroLeft}>
          <h1 className={styles.heroTitle}>
            {greeting}, {userName}.
          </h1>

          <p className={styles.heroDesc}>
            Selamat datang kembali! Anda saat ini mengelola {stats.totalSchedules} jadwal aktif 
            dengan total {stats.totalStudents} anak didik di wilayah tugas Anda.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={styles.cards}>
        <StatCard
          title="TOTAL ANAK DIDIK"
          value={stats.totalStudents.toString()}
          animationDelay={0.05}
          badge={<span className={styles.badgeGreen}>Aktif</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          title="JADWAL MENGAJAR"
          value={stats.totalSchedules.toString()}
          animationDelay={0.1}
          badge={<span className={styles.badgeBlue}>Sesi</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          title="LAPORAN TERKIRIM"
          value={stats.totalReports.toString()}
          animationDelay={0.15}
          badge={<span className={styles.badgeGold}>Selesai</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
      </div>

      {/* Active Students Table */}
      <StudentTable students={students} /> 
    </div>
  );
}
