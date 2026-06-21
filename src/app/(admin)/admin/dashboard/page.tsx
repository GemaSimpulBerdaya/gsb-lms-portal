"use client";

import { useEffect, useState } from "react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import Spinner from "@/components/ui/Spinner/Spinner";
import styles from "./adminDashboard.module.css";
import StatCard from "@/components/stat-card/StatCard";
import { DashboardFeed } from "./DashboardFeed";

function getGreeting() {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 11) return "Selamat Pagi";
  if (hour >= 11 && hour < 15) return "Selamat Siang";
  if (hour >= 15 && hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    totalVolunteers: 0,
    totalStudents: 0,
    totalSchedules: 0,
    totalModules: 0,
    totalPpts: 0,
    reportTrend: [] as { name: string; value: number }[]
  });
  const [loading, setLoading] = useState(true);

  const [adminName, setAdminName] = useState("Admin GSB");
  const [greeting, setGreeting] = useState(() => getGreeting());

  const fetchAdminStats = async () => {
    try {
      const res = await fetch("/api/admin/dashboard/stats");
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
      }
    } catch (err) {
      console.error("Gagal mengambil data admin", err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        // Just for data sync
      }
    } catch (err) {
      console.error("Gagal mengambil settings", err);
    }
  };

  const fetchSessionUser = async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      setAdminName(data.user?.name || data.user?.teamName || "Admin GSB");
    } catch (err) {
      console.error("Gagal mengambil sesi admin", err);
    }
  };

  useEffect(() => {
    const greetingTimer = setInterval(() => {
      setGreeting(getGreeting());
    }, 60_000);

    // queueMicrotask supaya setLoading(true) yang dipanggil oleh init()
    // tidak dianggap sync setState dalam effect body (React 19 warning).
    queueMicrotask(() => {
      const init = async () => {
        setLoading(true);
        await Promise.all([fetchAdminStats(), fetchSettings(), fetchSessionUser()]);
        setLoading(false);
      };
      init();
    });

    return () => clearInterval(greetingTimer);
  }, []);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <Spinner />
        <p>Menyiapkan data dashboard...</p>
      </div>
    );
  }

  const COLORS = ['#F58220', '#2D5A27', '#F6C343', '#B93517'];

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{greeting}, {adminName}!</h1>
        <p className={styles.subtitle}>Pantau segala pembelajaran GSB di sini.</p>
      </header>

      <div className={styles.statsGrid}>
        <StatCard
          title="Jumlah Relawan "
          value={stats.totalVolunteers.toString()}
          animationDelay={0.05}
          badge={<span className={styles.badgePrimary}>Aktif</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#752300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <StatCard
          title="Jumlah Data Siswa "
          value={stats.totalStudents.toString()}
          animationDelay={0.1}
          badge={<span className={styles.badgeSuccess}>Aktif</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2D5A27" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          }
        />
        <StatCard
          title="Kelas Belajar "
          value={stats.totalSchedules.toString()}
          animationDelay={0.15}
          badge={<span className={styles.badgeWarning}>Aktif</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#CC6A16" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
        <StatCard
          title="Jumlah Modul"
          value={stats.totalModules.toString()}
          animationDelay={0.2}
          badge={<span className={styles.badgeDanger}>Kurikulum</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B93517" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          }
        />
        <StatCard
          title="Jumlah PPT Ajar"
          value={stats.totalPpts.toString()}
          animationDelay={0.25}
          badge={<span className={styles.badgeDanger}>Kurikulum</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#752300" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="9" y1="21" x2="9" y2="9" />
            </svg>
          }
        />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Dinamika Partisipasi Laporan</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <AreaChart data={stats.reportTrend}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F58220" stopOpacity={0.24}/>
                    <stop offset="95%" stopColor="#2D5A27" stopOpacity={0.02}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#7a6658' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 12, fill: '#7a6658' }}
                />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#F58220"
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Proporsi Ekosistem GSB</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Relawan', value: stats.totalVolunteers },
                    { name: 'Siswa', value: stats.totalStudents },
                    { name: 'Modul', value: stats.totalModules },
                  ]}
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      <DashboardFeed />
    </div>
  );
}
