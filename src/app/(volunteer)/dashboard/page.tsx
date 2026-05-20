"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./dashboard.module.css";
import StatCard from "@/components/StatCard/StatCard";
import StudentTable, { Student } from "@/components/StudentTable/StudentTable";

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("Relawan");
  const [greeting, setGreeting] = useState("Selamat datang");
  const [stats, setStats] = useState({ totalStudents: 0, totalSchedules: 0, totalReports: 0 });
  const [students, setStudents] = useState<Student[]>([]);
  
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
        const mappedStudents: Student[] = (data.students || []).map((s: { _id: string; name: string; region: string; level: string }, i: number) => ({
          id: s._id,
          name: s.name,
          course: s.level,
          region: s.region,
          progress: Math.floor(Math.random() * 30) + 70, // Mock progress 70-100%
          lastActive: "Hari ini",
          avatar: s.name.charAt(0).toUpperCase(),
          color: ["#4f6ef7", "#e06c3a", "#3a9e6e", "#9b5de5"][i % 4],
        }));
        setStudents(mappedStudents);
      }
    } catch (err) {
      console.error("Gagal memuat data dashboard", err);
    }
  }, [selectedSemester]);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        const data = await res.json();
        if (data.user?.name) {
          setUserName(data.user.name);
        }
      }
    } catch (err) {
      console.error("Gagal memuat data user", err);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
      fetchUser();
      
      const hrs = new Date().getHours();
      if (hrs >= 5 && hrs < 11) setGreeting("Selamat pagi");
      else if (hrs >= 11 && hrs < 15) setGreeting("Selamat siang");
      else if (hrs >= 15 && hrs < 18) setGreeting("Selamat sore");
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
          <p className={styles.subtitle}>Selamat datang kembali di GSB Portal. Berikut adalah ringkasan perkembangan belajar anak didik Anda.</p>
        </div>
        <div className={styles.semesterFilter}>
          <label>Semester Aktif</label>
          <div className={styles.semesterBadge}>
             {selectedSemester}
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard 
          title="Total Anak Didik" 
          value={stats.totalStudents.toString()} 
          icon="👥"
          animationDelay={0.1}
          badge={<span style={{background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase'}}>Aktif</span>}
        />
        <StatCard 
          title="Jadwal Mengajar" 
          value={stats.totalSchedules.toString()} 
          icon="📅"
          animationDelay={0.2}
          badge={<span style={{background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase'}}>Pekan Ini</span>}
        />
        <StatCard 
          title="Laporan Terkirim" 
          value={stats.totalReports.toString()} 
          icon="📝"
          animationDelay={0.3}
          progress={stats.totalReports > 0 ? 100 : 0}
        />
      </div>

      <div className={styles.contentGrid}>
        <StudentTable students={students} />
      </div>
    </div>
  );
}
