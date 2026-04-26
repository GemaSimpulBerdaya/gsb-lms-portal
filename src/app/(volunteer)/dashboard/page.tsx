"use client";

import { useState, useEffect } from "react";
import styles from "./dashboard.module.css";
import StatCard from "@/components/StatCard/StatCard";
import StudentTable, { Student } from "@/components/StudentTable/StudentTable";

const students: Student[] = [
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

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [userName, setUserName] = useState("User");
  const [greeting, setGreeting] = useState("Good morning");


  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);

    // ambil user dari localStorage (hasil login)
    const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

    if (storedUser?.name) {
      setUserName(storedUser.name);
    } else if (storedUser?.email) {
      setUserName(storedUser.email);
    }

    // greeting berdasarkan waktu
    const hour = new Date().getHours();

    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good night");

    return () => clearTimeout(t);
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
            You have 3 classes scheduled today. Your students are showing a
            15% increase in module completion this week.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={styles.cards}>
        <StatCard
          title="TOTAL STUDENTS"
          value="124"
          animationDelay={0.05}
          badge={<span className={styles.badgeGreen}>+4 this week</span>}
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
          title="MODULES FINISHED"
          value={<>89 <span className={styles.cardValueSub}>/150</span></>}
          progress={59.3}
          animationDelay={0.1}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          }
        />
        <StatCard
          title="TODAY'S SCHEDULE"
          value={<>3 <span className={styles.cardValueSub}>Classes</span></>}
          animationDelay={0.15}
          badge={<span className={styles.badgeGold}>Next in 30m</span>}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />
      </div>

      {/* Active Students Table */}
      <StudentTable students={students} />
    </div>
  );
}
