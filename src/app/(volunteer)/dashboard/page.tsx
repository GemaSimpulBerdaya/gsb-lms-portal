"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./dashboard.module.css";
import StatCard from "@/components/StatCard/StatCard";
import StudentTable, { Student } from "@/components/StudentTable/StudentTable";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("User");
  const [greeting, setGreeting] = useState("Selamat datang");
  const [stats, setStats] = useState({ totalStudents: 0, totalSchedules: 0, totalReports: 0 });
  const [students, setStudents] = useState<Student[]>([]);
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

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/volunteer/dashboard/stats?semester=${selectedSemester}`);
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        
        // Map DB students to Table format
        const mappedStudents: Student[] = (data.students || []).map((s: { _id: string; name: string; region: string; level: string }) => ({
          id: s._id,
          name: s.name,
          course: `${s.region} - ${s.level}`,
          progress: 0, // Fallback
          lastActive: "Active",
          avatar: "/logo-gsb.png",
          color: "#4f6ef7",
          region: s.region
        }));
        setStudents(mappedStudents);
      }
    } catch (err) {
      console.error("Gagal memuat data dashboard", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester]);

  const fetchUser = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      const data = await res.json();
      setUserName(data.user?.name || "User");
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
      fetchUser();
      
      const hrs = new Date().getHours();
      if (hrs < 12) setGreeting("Selamat pagi");
      else if (hrs < 16) setGreeting("Selamat siang");
      else if (hrs < 19) setGreeting("Selamat sore");
      else setGreeting("Selamat malam");

      setMounted(true);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [fetchData, fetchUser]);

  return (
    <div className={`${styles.dashboard} ${mounted ? styles.mounted : ""}`}>
      <div className={styles.header}>
        <div className={styles.welcome}>
          <h1 className={styles.title}>{greeting}, {userName}! 👋</h1>
          <p className={styles.subtitle}>Ringkasan aktivitas mengajar Anda hari ini.</p>
        </div>
        <div className={styles.semesterFilter}>
          <label>Semester Aktif:</label>
          <div className={styles.semesterBadge}>
             {selectedSemester}
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard 
          title="Total Siswa" 
          value={stats.totalStudents.toString()} 
          icon="👥"
          animationDelay={0.1}
        />
        <StatCard 
          title="Jadwal Mengajar" 
          value={stats.totalSchedules.toString()} 
          icon="📅"
          animationDelay={0.2}
        />
        <StatCard 
          title="Laporan Kegiatan" 
          value={stats.totalReports.toString()} 
          icon="📝"
          animationDelay={0.3}
        />
      </div>

      <div className={styles.contentGrid}>
        <StudentTable students={students} />
      </div>
    </div>
  );
}
