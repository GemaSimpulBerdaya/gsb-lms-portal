"use client";

import { useState, useEffect } from "react";
import styles from "./report.module.css";
import { useRouter } from "next/navigation";

const students = [
  {
    id: "84729",
    name: "Alex Mercer",
    course: "Creative Writing 101",
    progress: 75,
    lastActive: "2 hours ago",
    avatar: "https://i.pravatar.cc/150?img=12",
  },
  {
    id: "84730",
    name: "Maya Lin",
    course: "Digital Photography",
    progress: 40,
    lastActive: "Yesterday",
    avatar: "https://i.pravatar.cc/150?img=32",
  },
  {
    id: "84731",
    name: "Jordan Reed",
    course: "Intro to Design",
    progress: 90,
    lastActive: "Just now",
    avatar: "https://i.pravatar.cc/150?img=5",
  },
];

const navItems = [
  { label: "Dashboard", path: "/dashboard" },
  { label: "Students", path: "/students" },
  { label: "Input Grade", path: "/input-grade" },
  { label: "Report", path: "/reporting" },
  { label: "Schedule", path: "/schedule" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Dashboard");
  const [mounted, setMounted] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
  }, []);

  return (
    <div className={styles.container}>
      
      {/* MOBILE BUTTON */}
      <button className={styles.mobileToggle} onClick={() => setMobileOpen(!mobileOpen)}>
        ☰
      </button>

      {/* SIDEBAR */}
      <aside className={`${styles.sidebar} ${mobileOpen ? styles.open : ""}`}>
        <div className={styles.brand}>
          <div className={styles.logoCircle}>🎓</div>
          <div>
            <h2>GSB LMS</h2>
            <p>The Mindful Gallery</p>
          </div>
        </div>

        <nav className={styles.menu}>
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`${styles.menuItem} ${
                activeNav === item.label ? styles.active : ""
              }`}
              onClick={() => {
                setActiveNav(item.label);
                router.push(item.path);
              }}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* MAIN */}
      <main className={styles.main}>
        
        {/* HERO */}
        <div className={styles.hero}>
          <h1>Good morning, Sarah 👋</h1>
          <p>Your students are performing better this week 🚀</p>
        </div>

        {/* CARDS */}
        <div className={styles.cards}>
          <div className={styles.card}>
            <p>Total Students</p>
            <h2>124</h2>
          </div>

          <div className={styles.card}>
            <p>Modules Finished</p>
            <h2>89 / 150</h2>
          </div>

          <div className={styles.card}>
            <p>Today's Schedule</p>
            <h2>3 Classes</h2>
          </div>
        </div>

        {/* TABLE */}
        <div className={styles.tableBox}>
          <h3>Active Students</h3>

          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Course</th>
                <th>Progress</th>
                <th>Last Active</th>
                <th></th>
              </tr>
            </thead>

            <tbody>
              {students.map((s) => (
                <tr key={s.id}>
                  <td className={styles.student}>
                    <div className={styles.avatar}>
                      <img src={s.avatar} />
                    </div>
                    <div>
                      <strong>{s.name}</strong>
                      <p>ID: {s.id}</p>
                    </div>
                  </td>

                  <td>{s.course}</td>

                  <td>
                    <div className={styles.progress}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${s.progress}%` }}
                      />
                    </div>
                    {s.progress}%
                  </td>

                  <td>{s.lastActive}</td>

                  <td>
                    <button className={styles.btn}>Grade</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      </main>
    </div>
  );
}