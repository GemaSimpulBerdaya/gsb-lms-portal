"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./dashboard.module.css";
import { Users, Calendar, FileText } from "lucide-react";
import StatCard from "@/components/stat-card/StatCard";
import { formatSemester, getCurrentSemester } from "@/utils/formatters";

type ActivityItem = {
  id: string;
  type: "report" | "schedule" | "attendance" | "team-attendance" | "grade" | "portfolio";
  title: string;
  meta: string;
  dateLabel: string;
  href: string;
};

type UpcomingAgenda = {
  id: string;
  scheduleId: string;
  region: string;
  fase: string;
  week: number;
  date: string;
  topic: string;
  petugas?: string;
};

type WeeklyChecklist = {
  id: string;
  scheduleId: string;
  title: string;
  week: number;
  date: string;
  items: {
    report: boolean;
    studentAttendance: boolean;
    teamAttendance: boolean;
    grade: boolean;
  };
};

const activityIconClass: Record<ActivityItem["type"], string> = {
  report: "activityIconReport",
  schedule: "activityIconSchedule",
  attendance: "activityIconAttendance",
  "team-attendance": "activityIconTeam",
  grade: "activityIconGrade",
  portfolio: "activityIconPortfolio",
};

const activityUsesCalendar = new Set<ActivityItem["type"]>([
  "schedule",
  "attendance",
  "team-attendance",
]);

const formatDateShort = (value?: string) => {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("Relawan");
  const [greeting, setGreeting] = useState("Selamat datang");
  const [stats, setStats] = useState({ totalStudents: 0, totalSchedules: 0, totalReports: 0 });
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [upcomingAgenda, setUpcomingAgenda] = useState<UpcomingAgenda[]>([]);
  const [weeklyChecklist, setWeeklyChecklist] = useState<WeeklyChecklist[]>([]);
  const [semesterLabels, setSemesterLabels] = useState<Record<string, string>>({});

  const [selectedSemester, setSelectedSemester] = useState(() => {
    return getCurrentSemester();
  });

  useEffect(() => {
    let cancelled = false;

    const hydrateActiveSemester = async () => {
      try {
        const res = await fetch("/api/settings/public", { cache: "no-store" });
        const data = res.ok ? await res.json() : {};
        const activeSemester =
          typeof data.activeSemester === "string" && data.activeSemester.trim()
            ? data.activeSemester
            : "";
        const nextSemester = activeSemester || getCurrentSemester();
        const labels =
          data.semesterLabels && typeof data.semesterLabels === "object"
            ? (data.semesterLabels as Record<string, string>)
            : {};

        if (cancelled) return;
        // setState dengan nilai sama = no-op di React, jadi fetchData cuma
        // ke-trigger ulang kalau semester aktif dari settings BEDA dari
        // fallback getCurrentSemester() yang sudah dipakai fetch pertama.
        setSelectedSemester(nextSemester);
        setSemesterLabels(labels);
        localStorage.setItem("activeSemester", nextSemester);
      } catch (err) {
        console.error("Gagal memuat semester aktif dashboard", err);
      }
    };

    hydrateActiveSemester();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/volunteer/dashboard/stats?semester=${selectedSemester}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setStats(data.stats);
        setActivities(data.recentActivities || []);
        setUpcomingAgenda(data.upcomingAgenda || []);
        setWeeklyChecklist(data.weeklyChecklist || []);
      }
    } catch (err) {
      console.error("Gagal memuat data dashboard", err);
    } finally {
      setLoading(false);
    }
  }, [selectedSemester]);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
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
      fetchUser();
      
      const hrs = new Date().getHours();
      if (hrs >= 5 && hrs < 11) setGreeting("Selamat pagi");
      else if (hrs >= 11 && hrs < 15) setGreeting("Selamat siang");
      else if (hrs >= 15 && hrs < 18) setGreeting("Selamat sore");
      else setGreeting("Selamat malam");

      setMounted(true);
    }, 0);
    
    return () => clearTimeout(timer);
  }, [fetchUser]);

  // Fetch stats LANGSUNG saat mount pakai semester fallback — jangan nunggu
  // /api/settings/public selesai (sebelumnya di-serialisasi via flag
  // semesterReady, bikin dashboard diam menunggu di login pertama saat
  // koneksi DB/kompilasi route masih dingin). Kalau semester aktif dari
  // settings ternyata beda, selectedSemester berubah → fetch ulang otomatis.
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className={`${styles.dashboard} ${mounted ? styles.mounted : ""}`}>
      <div className={styles.header}>
        <div className={styles.welcome}>
          <h1 className={styles.title}>{greeting}, {userName}! 👋</h1>
          <p className={styles.subtitle}>Selamat datang kembali di GSB Portal. Berikut adalah ringkasan perkembangan belajar siswa Anda.</p>
        </div>
        <div className={styles.semesterFilter}>
          <label>Semester Aktif</label>
          <div className={styles.semesterBadge}>
             {formatSemester(selectedSemester, semesterLabels)}
          </div>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <StatCard 
          title="Total Siswa" 
          value={stats.totalStudents.toString()} 
          icon={<Users size={24} />}
          animationDelay={0.1}
          badge={<span style={{background: '#dcfce7', color: '#166534', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase'}}>Aktif</span>}
        />
        <StatCard 
          title="Jadwal Mengajar" 
          value={stats.totalSchedules.toString()} 
          icon={<Calendar size={24} />}
          animationDelay={0.2}
          badge={<span style={{background: '#fef3c7', color: '#92400e', fontSize: '11px', fontWeight: 800, padding: '4px 10px', borderRadius: '20px', textTransform: 'uppercase'}}>Pekan Ini</span>}
        />
        <StatCard 
          title="Laporan Terkirim" 
          value={stats.totalReports.toString()} 
          icon={<FileText size={24} />}
          animationDelay={0.3}
          progress={stats.totalReports > 0 ? 100 : 0}
        />
      </div>

      <div className={styles.contentGrid}>
        <div className={styles.dashboardColumns}>
          <section className={styles.panelSection}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Agenda KBM Terdekat</h2>
                <p className={styles.panelSubtitle}>Pertemuan berikutnya dari jadwal semester aktif.</p>
              </div>
              <a href="/schedule" className={styles.panelLink}>Jadwal</a>
            </div>

            {loading ? (
              <div className={styles.agendaList}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className={`${styles.agendaItem} ${styles.skeletonItem}`} style={{ animationDelay: `${i * 0.08}s` }}>
                    <span className={`${styles.skeletonBlock} ${styles.skeletonDate}`} />
                    <span className={styles.skeletonStack}>
                      <span className={`${styles.skeletonBlock} ${styles.skeletonLine}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonLineSm}`} />
                    </span>
                    <span className={`${styles.skeletonBlock} ${styles.skeletonPill}`} />
                  </div>
                ))}
              </div>
            ) : upcomingAgenda.length === 0 ? (
              <div className={styles.emptyActivity}>Belum ada agenda KBM mendatang.</div>
            ) : (
              <div className={styles.agendaList}>
                {upcomingAgenda.map((agenda, idx) => (
                  <div
                    key={agenda.id}
                    className={`${styles.agendaItem} ${styles.fadeInItem}`}
                    style={{ animationDelay: `${idx * 0.06}s` }}
                  >
                    <span className={styles.agendaDate}>{formatDateShort(agenda.date)}</span>
                    <span className={styles.agendaBody}>
                      <strong>{agenda.region} - {agenda.fase}</strong>
                      <small title={`Mapel: ${agenda.topic} · Relawan: ${agenda.petugas || '—'}`}>
                        Pekan {agenda.week} · {agenda.topic}
                        {agenda.petugas && agenda.petugas !== "Belum ditentukan" && (
                          <> · <span style={{ color: '#c0392b', fontWeight: 600 }}>{agenda.petugas}</span></>
                        )}
                      </small>
                    </span>
                    <span className={styles.agendaActions}>
                      <a href={`/attendance?scheduleId=${agenda.scheduleId}&week=${agenda.week}`}>Presensi</a>
                      <a href={`/reporting?scheduleId=${agenda.scheduleId}&date=${agenda.date.slice(0, 10)}`}>Laporan</a>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panelSection}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Checklist KBM Pekan Ini</h2>
                <p className={styles.panelSubtitle}>Status kelengkapan operasional per jadwal aktif.</p>
              </div>
            </div>

            {loading ? (
              <div className={styles.checklistList}>
                {[0, 1].map((i) => (
                  <div key={i} className={`${styles.checklistItem} ${styles.skeletonItem}`} style={{ animationDelay: `${i * 0.08}s` }}>
                    <div className={styles.checklistTop}>
                      <span className={`${styles.skeletonBlock} ${styles.skeletonLine}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonPill}`} />
                    </div>
                    <div className={styles.checklistChips}>
                      <span className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
                      <span className={`${styles.skeletonBlock} ${styles.skeletonChip}`} />
                    </div>
                  </div>
                ))}
              </div>
            ) : weeklyChecklist.length === 0 ? (
              <div className={styles.emptyActivity}>Belum ada jadwal aktif untuk dicek.</div>
            ) : (
              <div className={styles.checklistList}>
                {weeklyChecklist.map((item, idx) => (
                  <div
                    key={item.id}
                    className={`${styles.checklistItem} ${styles.fadeInItem}`}
                    style={{ animationDelay: `${idx * 0.06}s` }}
                  >
                    <div className={styles.checklistTop}>
                      <strong>{item.title}</strong>
                      <span>Pekan {item.week}</span>
                    </div>
                    <div className={styles.checklistChips}>
                      <span className={item.items.report ? styles.chipDone : styles.chipTodo}>Laporan</span>
                      <span className={item.items.studentAttendance ? styles.chipDone : styles.chipTodo}>Presensi Siswa</span>
                      <span className={item.items.teamAttendance ? styles.chipDone : styles.chipTodo}>Presensi Tim</span>
                      <span className={item.items.grade ? styles.chipDone : styles.chipTodo}>Nilai</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className={styles.activitySection}>
          <div className={styles.activityHeader}>
            <div>
              <h2 className={styles.activityTitle}>Aktivitas Terkini</h2>
              <p className={styles.activitySubtitle}>Aktivitas operasional terbaru dari semester aktif.</p>
            </div>
            <div className={styles.quickActions}>
              <a href="/reporting" className={styles.quickAction}>Buat Laporan</a>
              <a href="/attendance" className={styles.quickAction}>Input Presensi</a>
              <a href="/evaluation" className={styles.quickAction}>Input Nilai</a>
              <a href="/portfolio" className={styles.quickAction}>Tambah Karya</a>
            </div>
          </div>

          {loading ? (
            <div className={styles.activityList}>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className={`${styles.activityItem} ${styles.skeletonItem}`} style={{ animationDelay: `${i * 0.07}s` }}>
                  <span className={`${styles.skeletonBlock} ${styles.skeletonAvatar}`} />
                  <span className={styles.skeletonStack}>
                    <span className={`${styles.skeletonBlock} ${styles.skeletonLine}`} />
                    <span className={`${styles.skeletonBlock} ${styles.skeletonLineSm}`} />
                  </span>
                  <span className={`${styles.skeletonBlock} ${styles.skeletonPill}`} />
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className={styles.emptyActivity}>
              Belum ada aktivitas terbaru untuk semester ini.
            </div>
          ) : (
            <div className={styles.activityList}>
              {activities.map((activity, idx) => (
                <a
                  key={activity.id}
                  href={activity.href}
                  className={`${styles.activityItem} ${styles.fadeInItem}`}
                  style={{ animationDelay: `${idx * 0.05}s` }}
                >
                  <span className={`${styles.activityIcon} ${styles[activityIconClass[activity.type]]}`}>
                    {activityUsesCalendar.has(activity.type) ? <Calendar size={16} /> : <FileText size={16} />}
                  </span>
                  <span className={styles.activityBody}>
                    <strong>{activity.title}</strong>
                    <small>{activity.meta}</small>
                  </span>
                  <span className={styles.activityDate}>{activity.dateLabel}</span>
                </a>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
