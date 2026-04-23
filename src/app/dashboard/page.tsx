    "use client";

    import { useState, useEffect } from "react";
    import styles from "./dashboard.module.css";
    import { useRouter } from "next/navigation"; 



    const students = [
    {
        id: "84729",
        name: "Alex Mercer",
        course: "Creative Writing 101",
        progress: 75,
        lastActive: "2 hours ago",
        avatar: "AM",
        color: "#4A90D9",
    },
    {
        id: "84730",
        name: "Maya Lin",
        course: "Digital Photography",
        progress: 40,
        lastActive: "Yesterday",
        avatar: "ML",
        color: "#E07B54",
    },
    {
        id: "84731",
        name: "Jordan Reed",
        course: "Intro to Design",
        progress: 90,
        lastActive: "Just now",
        avatar: "JR",
        color: "#5C9E6E",
    },
    ];

    const navItems = [
    {
        label: "Dashboard",
         path: "/dashboard",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
        ),
    },
    {
        label: "Students",
         path: "/students",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
        ),
    },
    {
        label: "Input Grade",
        path: "/input-grade",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
        ),
    },
    {
        label: "Report",
         path: "/report",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
        ),
    },
    {
        label: "Schedule",
        path: "/schedule",
        icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        ),
    },
    ];

    export default function DashboardPage() {
        const router = useRouter();
    const [activeNav, setActiveNav] = useState("Dashboard");
    const [mounted, setMounted] = useState(false);
    const [collapsed, setCollapsed] = useState(false);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 30);
        return () => clearTimeout(t);
    }, []);

    return (
        <div className={`${styles.container} ${mounted ? styles.mounted : ""}`}>

        {/* ── SIDEBAR ── */}
        <aside className={`${styles.sidebar} ${mounted ? styles.sidebarEnter : ""}`}>
            <div>
            {/* Brand */}
            <div className={styles.brand}>
    <div className={styles.logoCircle}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
    <path d="M22 10L12 5 2 10l10 5 10-5z"/>
    <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/>
    </svg>
    </div>

    <h2 className={styles.logo}>GSB LMS</h2>
    <p className={styles.subLogo}>The Mindful Gallery</p>
    </div>

            {/* Nav */}
            <nav className={styles.menu}>
                {navItems.map((item) => (
                <button
                    key={item.label}
                    className={`${styles.menuItem} ${activeNav === item.label ? styles.menuItemActive : ""}`}
                   onClick={() => {
  setActiveNav(item.label);
  router.push(item.path);
}}
                >
                    <span className={styles.menuIcon}>{item.icon}</span>
                    {item.label}
                </button>
                ))}
            </nav>
            </div>

            {/* Bottom */}
            <div className={styles.bottomMenu}>
            <button className={styles.menuItem}>
                <span className={styles.menuIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                </span>
                Settings
            </button>
            <button className={styles.menuItem}>
                <span className={styles.menuIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                </span>
                Logout
            </button>
            </div>
        </aside>

        {/* ── MAIN ── */}
        <main className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>

            {/* Hero Header */}
            <div className={styles.hero}>
            <div className={styles.heroLeft}>
                <h1 className={styles.heroTitle}>Good morning, Sarah.</h1>
                <p className={styles.heroDesc}>
                You have 3 classes scheduled today. Your students are showing a
                15% increase in module completion this week.
                </p>
            </div>
            <div className={styles.heroRight} />
            </div>

            {/* Stat Cards */}
            <div className={styles.cards}>

            {/* Card 1: Total Students */}
            <div className={`${styles.card} ${mounted ? styles.cardAnim1 : styles.cardHidden}`}>
                <div className={styles.cardTop}>
                <div className={styles.cardIcon}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                </div>
                <span className={styles.badgeGreen}>+4 this week</span>
                </div>
                <p className={styles.cardLabel}>TOTAL STUDENTS</p>
                <p className={styles.cardValue}>124</p>
            </div>

            {/* Card 2: Modules Finished */}
            <div className={`${styles.card} ${mounted ? styles.cardAnim2 : styles.cardHidden}`}>
                <div className={styles.cardTop}>
                <div className={styles.cardIcon}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                    </svg>
                </div>
                </div>
                <p className={styles.cardLabel}>MODULES FINISHED</p>
                <p className={styles.cardValue}>
                89 <span className={styles.cardValueSub}>/150</span>
                </p>
                <div className={styles.progressTrack}>
                <div className={styles.progressFill} style={{ width: "59.3%" }} />
                </div>
            </div>

            {/* Card 3: Today's Schedule */}
            <div className={`${styles.card} ${mounted ? styles.cardAnim3 : styles.cardHidden}`}>
                <div className={styles.cardTop}>
                <div className={styles.cardIcon}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                </div>
                <span className={styles.badgeGold}>Next in 30m</span>
                </div>
                <p className={styles.cardLabel}>TODAY'S SCHEDULE</p>
                <p className={styles.cardValue}>
                3 <span className={styles.cardValueSub}>Classes</span>
                </p>
            </div>

            </div>

            {/* Active Students Table */}
            <div className={`${styles.tableSection} ${mounted ? styles.tableEnter : styles.tableHidden}`}>
            <div className={styles.tableHeader}>
                <h3 className={styles.tableTitle}>Active Students</h3>
                <button className={styles.viewAll}>View All →</button>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                <thead>
                    <tr>
                    <th>STUDENT NAME</th>
                    <th>COURSE</th>
                    <th>PROGRESS</th>
                    <th>LAST ACTIVE</th>
                    <th>ACTION</th>
                    </tr>
                </thead>
                <tbody>
                    {students.map((s, i) => (
                    <tr key={s.id} className={mounted ? styles[`rowAnim${i + 1}` as keyof typeof styles] : styles.rowHidden}>
                        <td>
                        <div className={styles.studentCell}>
                            <div
                            className={styles.avatar}
                            style={{ background: s.color }}
                            >
                            {s.avatar}
                            </div>
                            <div>
                            <div className={styles.studentName}>{s.name}</div>
                            <div className={styles.studentId}>ID: {s.id}</div>
                            </div>
                        </div>
                        </td>
                        <td className={styles.courseCell}>{s.course}</td>
                        <td>
                        <div className={styles.progressCell}>
                            <div className={styles.progressTrackSm}>
                            <div
                                className={styles.progressFillSm}
                                style={{ width: `${s.progress}%` }}
                            />
                            </div>
                            <span className={styles.progressPct}>{s.progress}%</span>
                        </div>
                        </td>
                        <td className={styles.lastActiveCell}>{s.lastActive}</td>
                        <td>
                        <button className={styles.gradeBtn}>Grade</button>
                        </td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
            </div>

        </main>
        </div>
    );
    }