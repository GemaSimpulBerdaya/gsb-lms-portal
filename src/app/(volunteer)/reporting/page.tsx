"use client";

import { useState, useEffect } from "react";
import styles from "./report.module.css";

const students = [
  {
    id: "8492",
    name: "Elena Rostova",
    course: "Advanced Typography & Layouts",
    section: "Section B",
    completion: 100,
    avgScore: 94.5,
    avatar: "https://i.pravatar.cc/150?img=47",
    status: "generate", // generate | draft | review
  },
  {
    id: "7381",
    name: "Marcus Chen",
    course: "Advanced Typography & Layouts",
    section: "Section A",
    completion: 85,
    avgScore: 88.2,
    avatar: "https://i.pravatar.cc/150?img=12",
    status: "draft",
  },
  {
    id: "9102",
    name: "Sarah Jenkins",
    course: "Digital Sculpting Practicum",
    section: "Section C",
    completion: 100,
    avgScore: 97.8,
    avatar: "https://i.pravatar.cc/150?img=32",
    status: "generate",
  },
  {
    id: "6422",
    name: "David Alaba",
    course: "Color Theory Seminar",
    section: "Section A",
    completion: 100,
    avgScore: 91.0,
    avatar: "https://i.pravatar.cc/150?img=53",
    status: "review",
  },
];

export default function ReportPage() {
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`${styles.mainEnter} ${mounted ? styles.mounted : ""}`}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>EVALUATION PHASE</span>
            <h1 className={styles.heroTitle}>
              Semester Report<br />Generation.
            </h1>
            <p className={styles.heroDesc}>
              Compile comprehensive academic profiles. Review
              progress, analyze completion rates, and generate
              authoritative semester reports for your gallery of students.
            </p>
          </div>
          <div className={styles.heroActions}>
            <button className={styles.btnExport}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Export<br/>All<br/>Drafts</span>
            </button>
            <button className={styles.btnPublish}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                <polyline points="16 6 12 2 8 6" />
                <line x1="12" y1="2" x2="12" y2="15" />
              </svg>
              <span>Publish<br/>Selected</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className={styles.filterBar}>
        <div className={styles.filterGroup}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>ACADEMIC TERM</label>
            <div className={styles.selectWrapper}>
              <select className={styles.filterSelect}>
                <option>Fall 2023 – 2024</option>
                <option>Spring 2023 – 2024</option>
                <option>Fall 2024 – 2025</option>
              </select>
              <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>REGION / COHORT</label>
            <div className={styles.selectWrapper}>
              <select className={styles.filterSelect}>
                <option>North America (All)</option>
                <option>Europe (All)</option>
                <option>Asia Pacific (All)</option>
              </select>
              <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
          </div>
        </div>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Student Gallery Grid */}
      <div className={styles.gallery}>
        {students.map((student, index) => (
          <div
            key={student.id}
            className={`${styles.studentCard} ${mounted ? styles.cardAnim : styles.cardHidden}`}
            style={{ animationDelay: `${0.1 * (index + 1)}s` }}
          >
            {/* Card Header */}
            <div className={styles.cardHeader}>
              <div className={styles.avatarWrapper}>
                <img
                  src={student.avatar}
                  alt={student.name}
                  className={styles.avatar}
                />
              </div>
              <div className={styles.cardInfo}>
                <div className={styles.cardNameRow}>
                  <h3 className={styles.studentName}>{student.name}</h3>
                  <button className={styles.moreBtn}>•••</button>
                </div>
                <p className={styles.studentCourse}>
                  {student.course} •<br/>{student.section}
                </p>
              </div>
            </div>

            {/* ID Badge */}
            <div className={styles.idBadge}>
              <span className={styles.idTag}>ID: {student.id}</span>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>COMPLETION</span>
                <span className={styles.statValue}>
                  {student.completion} <span className={styles.statUnit}>%</span>
                </span>
              </div>
              <div className={styles.statBlock}>
                <span className={styles.statLabel}>AVG. SCORE</span>
                <span className={`${styles.statValue} ${styles.scoreValue}`}>
                  {student.avgScore.toFixed(1)} <span className={styles.statSuffix}>/100</span>
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.cardActions}>
              <button className={styles.btnDetails}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                Details
              </button>
              {student.status === "generate" && (
                <button className={styles.btnGenerate}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                  Generate<br/>Report
                </button>
              )}
              {student.status === "draft" && (
                <button className={styles.btnDraft}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  Draft<br/>Report
                </button>
              )}
              {student.status === "review" && (
                <button className={styles.btnReview}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                  Review<br/>Draft
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Load More */}
      <div className={styles.loadMoreWrapper}>
        <button className={styles.btnLoadMore}>
          Load More Gallery Entries
        </button>
      </div>

    </div>
  );
}
