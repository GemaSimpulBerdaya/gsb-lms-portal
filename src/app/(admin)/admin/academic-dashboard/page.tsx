"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from "recharts";
import styles from "./academicDashboard.module.css";
import StatCard from "@/components/stat-card/StatCard";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 11) return "Selamat Pagi";
  if (hour >= 11 && hour < 15) return "Selamat Siang";
  if (hour >= 15 && hour < 18) return "Selamat Sore";
  return "Selamat Malam";
}

interface NameValue {
  name: string;
  value: number;
}

interface RecentModule {
  id: string;
  title: string;
  programType: "SNBT" | "OFFLINE";
  learningLocation: string;
  fase: string;
  subject: string;
  week: number | null;
  hasQuiz: boolean;
  createdAt: string;
}

interface AcademicStats {
  totalModules: number;
  totalSNBT: number;
  totalOffline: number;
  withQuiz: number;
  withoutQuiz: number;
  withFile: number;
  byFase: NameValue[];
  bySubject: NameValue[];
  byLocation: NameValue[];
}

const EMPTY_STATS: AcademicStats = {
  totalModules: 0,
  totalSNBT: 0,
  totalOffline: 0,
  withQuiz: 0,
  withoutQuiz: 0,
  withFile: 0,
  byFase: [],
  bySubject: [],
  byLocation: [],
};

const PIE_COLORS = ["#2f855a", "#dd6b20", "#3182ce", "#805ad5", "#d69e2e", "#e53e3e", "#319795", "#718096"];

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  } catch {
    return "-";
  }
}

export default function AcademicDashboardPage() {
  const [stats, setStats] = useState<AcademicStats>(EMPTY_STATS);
  const [recent, setRecent] = useState<RecentModule[]>([]);
  const [semester, setSemester] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Tim Akademik");
  const [greeting, setGreeting] = useState(() => getGreeting());

  useEffect(() => {
    const greetingTimer = setInterval(() => setGreeting(getGreeting()), 60_000);

    queueMicrotask(() => {
      const init = async () => {
        setLoading(true);
        try {
          const [statsRes, meRes] = await Promise.all([
            fetch("/api/admin/academic/stats", { cache: "no-store" }),
            fetch("/api/auth/me", { cache: "no-store" }),
          ]);

          if (statsRes.ok) {
            const data = await statsRes.json();
            setStats({ ...EMPTY_STATS, ...data.stats });
            setRecent(data.recentModules || []);
            setSemester(data.semester || "");
          }

          if (meRes.ok) {
            const me = await meRes.json();
            setUserName(me.user?.name || me.user?.teamName || "Tim Akademik");
          }
        } catch (err) {
          console.error("Gagal mengambil data dashboard akademik", err);
        } finally {
          setLoading(false);
        }
      };
      init();
    });

    return () => clearInterval(greetingTimer);
  }, []);

  const quizCoverage = stats.totalModules > 0
    ? Math.round((stats.withQuiz / stats.totalModules) * 100)
    : 0;
  const fileCoverage = stats.totalModules > 0
    ? Math.round((stats.withFile / stats.totalModules) * 100)
    : 0;

  if (loading) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={`${styles.skeletonBlock} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeletonBlock} ${styles.skeletonSubtitle}`} />
        </header>
        <div className={styles.statsGrid}>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`${styles.skeletonCard}`} style={{ animationDelay: `${i * 0.07}s` }}>
              <div className={`${styles.skeletonBlock} ${styles.skeletonIcon}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonLineSm}`} />
              <div className={`${styles.skeletonBlock} ${styles.skeletonLine}`} />
            </div>
          ))}
        </div>
        <div className={styles.chartsGrid}>
          <div className={`${styles.skeletonChart}`} />
          <div className={`${styles.skeletonChart}`} />
        </div>
      </div>
    );
  }

  const distributionData = [
    { name: "Reguler (Offline)", value: stats.totalOffline },
    { name: "SNBT (Online)", value: stats.totalSNBT },
  ].filter((d) => d.value > 0);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>{greeting}, {userName}!</h1>
        <p className={styles.subtitle}>
          Ringkasan kurikulum dan kelengkapan modul pembelajaran GSB
          {semester && semester !== "all" ? ` — semester ${semester}` : ""}.
        </p>
      </header>

      <div className={styles.statsGrid}>
        <StatCard
          title="TOTAL MODUL"
          value={stats.totalModules.toString()}
          animationDelay={0.05}
          badge={<span className={styles.badgePurple}>Kurikulum</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          }
        />
        <StatCard
          title="MODUL REGULER"
          value={stats.totalOffline.toString()}
          animationDelay={0.1}
          badge={<span className={styles.badgeSuccess}>Offline</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
              <path d="M6 12v5c3 3 9 3 12 0v-5" />
            </svg>
          }
        />
        <StatCard
          title="MODUL SNBT"
          value={stats.totalSNBT.toString()}
          animationDelay={0.15}
          badge={<span className={styles.badgePrimary}>Online</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          }
        />
        <StatCard
          title="MODUL BERKUIS"
          value={stats.withQuiz.toString()}
          progress={quizCoverage}
          animationDelay={0.2}
          badge={<span className={styles.badgeWarning}>{quizCoverage}% lengkap</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
          }
        />
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Sebaran Modul per Fase</h3>
          {stats.byFase.length === 0 ? (
            <div className={styles.emptyChart}>Belum ada modul reguler dengan fase.</div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={stats.byFase} layout="vertical" margin={{ left: 12, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                  <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#555" }} width={110} />
                  <Tooltip
                    cursor={{ fill: "rgba(47,133,90,0.06)" }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="value" name="Modul" fill="#2f855a" radius={[0, 8, 8, 0]} barSize={22} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Komposisi Program</h3>
          {distributionData.length === 0 ? (
            <div className={styles.emptyChart}>Belum ada modul.</div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={distributionData} innerRadius={60} outerRadius={90} paddingAngle={4} dataKey="value">
                    {distributionData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Modul per Mata Pelajaran</h3>
          {stats.bySubject.length === 0 ? (
            <div className={styles.emptyChart}>Belum ada data mata pelajaran.</div>
          ) : (
            <div style={{ width: "100%", height: 300 }}>
              <ResponsiveContainer>
                <BarChart data={stats.bySubject} margin={{ left: 0, right: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#888" }} interval={0} angle={-15} dy={10} height={50} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#888" }} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "rgba(221,107,32,0.06)" }}
                    contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 10px 20px rgba(0,0,0,0.1)" }}
                  />
                  <Bar dataKey="value" name="Modul" fill="#dd6b20" radius={[8, 8, 0, 0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Kelengkapan Konten</h3>
          <div className={styles.coverageList}>
            <div className={styles.coverageRow}>
              <div className={styles.coverageLabel}>
                <span>Modul dengan kuis</span>
                <span className={styles.coverageValue}>{stats.withQuiz}/{stats.totalModules}</span>
              </div>
              <div className={styles.coverageTrack}>
                <div className={styles.coverageFill} style={{ width: `${quizCoverage}%`, background: "#2f855a" }} />
              </div>
            </div>
            <div className={styles.coverageRow}>
              <div className={styles.coverageLabel}>
                <span>Modul dengan file materi</span>
                <span className={styles.coverageValue}>{stats.withFile}/{stats.totalModules}</span>
              </div>
              <div className={styles.coverageTrack}>
                <div className={styles.coverageFill} style={{ width: `${fileCoverage}%`, background: "#3182ce" }} />
              </div>
            </div>
            <div className={styles.coverageRow}>
              <div className={styles.coverageLabel}>
                <span>Modul tanpa kuis</span>
                <span className={styles.coverageValue}>{stats.withoutQuiz}</span>
              </div>
              <div className={styles.coverageTrack}>
                <div
                  className={styles.coverageFill}
                  style={{ width: `${stats.totalModules > 0 ? Math.round((stats.withoutQuiz / stats.totalModules) * 100) : 0}%`, background: "#e53e3e" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.recentCard}>
        <h3 className={styles.chartTitle}>Modul Terbaru</h3>
        {recent.length === 0 ? (
          <div className={styles.emptyChart}>Belum ada modul.</div>
        ) : (
          <div className={styles.recentList}>
            {recent.map((m, idx) => (
              <div
                key={m.id}
                className={styles.recentItem}
                style={{ animationDelay: `${idx * 0.05}s` }}
              >
                <div className={styles.recentMain}>
                  <span className={styles.recentTitle}>{m.title}</span>
                  <div className={styles.recentMeta}>
                    <span className={`${styles.tag} ${m.programType === "SNBT" ? styles.tagBlue : styles.tagGreen}`}>
                      {m.programType}
                    </span>
                    {m.fase && <span className={styles.tag}>{m.fase}</span>}
                    {m.subject && <span className={styles.tagMuted}>{m.subject}</span>}
                    {m.week ? <span className={styles.tagMuted}>Pekan {m.week}</span> : null}
                  </div>
                </div>
                <div className={styles.recentRight}>
                  <span className={m.hasQuiz ? styles.quizYes : styles.quizNo}>
                    {m.hasQuiz ? "Ada kuis" : "Tanpa kuis"}
                  </span>
                  <span className={styles.recentDate}>{formatDate(m.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
