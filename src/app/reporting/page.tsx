"use client";

import { useState, useEffect } from "react";
import styles from "./report.module.css";
import { useRouter } from "next/navigation";

type Student = {
  id: string;
  name: string;
  course: string;
  section: string;
  completion: number;
  avgScore: number;
  avatar: string;
  status: string;
};

type SubjectRow = {
  subject: string;
  credits: number;
  grade: string;
  remarks: string;
};

const subjectRows: SubjectRow[] = [
  { subject: "Advanced Mathematics", credits: 4.0, grade: "A",  remarks: "Exceptional logic" },
  { subject: "Physics & Mechanics",  credits: 4.0, grade: "A−", remarks: "Strong practical skills" },
  { subject: "World Literature",     credits: 3.0, grade: "B+", remarks: "Good participation" },
  { subject: "Computer Science II",  credits: 4.0, grade: "A+", remarks: "Outstanding project work" },
];

const students = [
  {
    id: "8492",
    name: "Tiara Awalina ",
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
    path: "/reporting",
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

export default function ReportPage() {
  const router = useRouter();
  const [activeNav, setActiveNav] = useState("Report");
  const [mounted, setMounted] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [previewPage, setPreviewPage] = useState(1);
  const [draftStudent, setDraftStudent] = useState<Student | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Lock body scroll when any modal is open
  useEffect(() => {
    if (previewStudent || draftStudent) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [previewStudent, draftStudent]);

  const openDraft  = (student: Student) => setDraftStudent(student);
  const closeDraft = () => setDraftStudent(null);

  const openPreview = (student: Student) => {
    setPreviewStudent(student);
    setPreviewPage(1);
  };

  const closePreview = () => setPreviewStudent(null);

  const termGPA = (student: Student) => (student.avgScore / 25).toFixed(2);
  const cumGPA  = (student: Student) => ((student.avgScore / 25) + 0.05).toFixed(2);

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
              className={`${styles.studentCard} ${mounted ? styles[`cardAnim${index + 1}` as keyof typeof styles] : styles.cardHidden}`}
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
                <button className={styles.btnDetails} onClick={() => openPreview(student)}>
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
                  <button className={styles.btnDraft} onClick={() => openDraft(student)}>
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

      </main>

      {/* ── PDF PREVIEW MODAL ── */}
      {previewStudent && (
        <div className={styles.previewOverlay} onClick={closePreview}>
          <div className={styles.previewPanel} onClick={(e) => e.stopPropagation()}>

            {/* Modal Top Bar */}
            <div className={styles.previewTopBar}>
              <div className={styles.previewBreadcrumb}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                <span>TERM 2 RECORDS</span>
                <span className={styles.previewBadge}>PDF PREVIEW</span>
              </div>
              <h2 className={styles.previewTitle}>Student Report Card</h2>
              <p className={styles.previewSubtitle}>
                {previewStudent.name} — {previewStudent.course}, {previewStudent.section}
              </p>

              <div className={styles.previewActions}>
                <button className={styles.btnShareLink}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="18" cy="5" r="3"/>
                    <circle cx="6" cy="12" r="3"/>
                    <circle cx="18" cy="19" r="3"/>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Share Link
                </button>
                <button className={styles.btnDownloadPdf}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Download PDF
                </button>
                <button className={styles.previewClose} onClick={closePreview}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Pagination & Zoom Bar */}
            <div className={styles.previewToolbar}>
              <div className={styles.toolbarLeft}>
                <button
                  className={styles.toolbarBtn}
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={previewPage === 1}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
                </button>
                <span className={styles.pageIndicator}>Page {previewPage} of 2</span>
                <button
                  className={styles.toolbarBtn}
                  onClick={() => setPreviewPage((p) => Math.min(2, p + 1))}
                  disabled={previewPage === 2}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                </button>
              </div>
              <div className={styles.toolbarRight}>
                <button className={styles.toolbarBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <span className={styles.zoomLabel}>100%</span>
                <button className={styles.toolbarBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                </button>
                <button className={styles.toolbarBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                </button>
                <button className={styles.toolbarBtn}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>
                </button>
              </div>
            </div>

            {/* Document Paper */}
            <div className={styles.previewScroll}>
              <div className={styles.docPaper}>

                {/* Document Header */}
                <div className={styles.docHeader}>
                  <div className={styles.docSchoolInfo}>
                    <div className={styles.docSchoolIcon}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M22 10L12 5 2 10l10 5 10-5z"/>
                        <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/>
                      </svg>
                    </div>
                    <div>
                      <p className={styles.docSchoolName}>Global Science Academy</p>
                      <p className={styles.docSchoolTagline}>Excellence in Mindful Education</p>
                    </div>
                  </div>
                  <div className={styles.docTranscriptInfo}>
                    <p className={styles.docTranscriptLabel}>OFFICIAL TRANSCRIPT</p>
                    <p className={styles.docTranscriptTerm}>Term 2, 2023 – 2024</p>
                    <p className={styles.docTranscriptIssued}>Issued May 14, 2024</p>
                  </div>
                </div>

                <div className={styles.docDivider} />

                {/* Student Info Grid */}
                <div className={styles.docInfoGrid}>
                  <div className={styles.docInfoCell}>
                    <p className={styles.docInfoLabel}>STUDENT NAME</p>
                    <p className={styles.docInfoValue}>{previewStudent.name}</p>
                  </div>
                  <div className={styles.docInfoCell}>
                    <p className={styles.docInfoLabel}>STUDENT ID</p>
                    <p className={styles.docInfoValue}>#GSA-2024-{previewStudent.id}</p>
                  </div>
                  <div className={styles.docInfoCell}>
                    <p className={styles.docInfoLabel}>GRADE / SECTION</p>
                    <p className={styles.docInfoValue}>{previewStudent.course.includes("10") ? "Grade 10" : "Grade 11"}, {previewStudent.section}</p>
                  </div>
                  <div className={styles.docInfoCell}>
                    <p className={styles.docInfoLabel}>HOMEROOM TEACHER</p>
                    <p className={styles.docInfoValue}>Mr. David Chen</p>
                  </div>
                </div>

                {/* Academic Performance */}
                <div className={styles.docSection}>
                  <p className={styles.docSectionTitle}>Academic Performance</p>
                  <table className={styles.docTable}>
                    <thead>
                      <tr className={styles.docTableHead}>
                        <th>SUBJECT</th>
                        <th>CREDITS</th>
                        <th>GRADE</th>
                        <th>REMARKS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {subjectRows.map((row) => (
                        <tr key={row.subject} className={styles.docTableRow}>
                          <td className={styles.docTableSubject}>{row.subject}</td>
                          <td className={styles.docTableCredits}>{row.credits.toFixed(1)}</td>
                          <td>
                            <span
                              className={`${styles.docGradeBadge} ${
                                row.grade.startsWith("A") ? styles.gradeA :
                                row.grade.startsWith("B") ? styles.gradeB : styles.gradeC
                              }`}
                            >
                              {row.grade}
                            </span>
                          </td>
                          <td className={styles.docTableRemarks}>{row.remarks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* GPA Row */}
                  <div className={styles.docGpaRow}>
                    <div className={styles.docGpaBox}>
                      <p className={styles.docGpaLabel}>TERM GPA</p>
                      <p className={styles.docGpaValue}>{termGPA(previewStudent)}</p>
                    </div>
                    <div className={`${styles.docGpaBox} ${styles.docGpaBoxAccent}`}>
                      <p className={styles.docGpaLabel}>CUMULATIVE GPA</p>
                      <p className={styles.docGpaValue}>{cumGPA(previewStudent)}</p>
                    </div>
                  </div>
                </div>

                {/* Homeroom Remarks */}
                <div className={styles.docSection}>
                  <p className={styles.docSectionTitle}>Catatan Belajar Guru</p>
                  <blockquote className={styles.docRemarks}>
                    {previewStudent.name.split(" ")[0]} telah menunjukkan dedikasi yang luar biasa pada semester ini. Kemampuan analisisnya sebanding dengan kesediaannya membantu teman-temannya dalam proyek kolaboratif. Seorang siswa yang penuh perhatian dan fokus, yang benar-benar mencerminkan nilai-nilai dalam lingkungan pembelajaran kami.
                  </blockquote>
                </div>

                {/* Signatures */}
                <div className={styles.docSignatures}>
                  <div className={styles.docSigBlock}>
                    <p className={styles.docSigName}>D. Chen</p>
                    <div className={styles.docSigLine} />
                    <p className={styles.docSigRole}>HOMEROOM TEACHER</p>
                  </div>
                  <div className={styles.docSealBlock}>
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.2">
                      <circle cx="12" cy="12" r="10"/>
                      <path d="M12 8l1.09 3.26L16.5 12l-3.41 0.74L12 16l-1.09-3.26L7.5 12l3.41-0.74L12 8z"/>
                    </svg>
                    <p className={styles.docSealLabel}>OFFICIAL SEAL</p>
                  </div>
                  <div className={styles.docSigBlock}>
                    <p className={styles.docSigName}>E. Wright</p>
                    <div className={styles.docSigLine} />
                    <p className={styles.docSigRole}>PRINCIPAL</p>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── DRAFT / ACADEMIC PERFORMANCE PANEL ── */}
      {draftStudent && (
        <div className={styles.previewOverlay} onClick={closeDraft}>
          <div className={styles.previewPanel} onClick={(e) => e.stopPropagation()}>

            {/* Panel Header */}
            <div className={styles.draftTopBar}>
              <div className={styles.draftHeaderLeft}>
                <p className={styles.draftTermLabel}>TERM 2 • 2024</p>
                <h2 className={styles.draftTitle}>Academic<br/>Performance</h2>
              </div>
              <div className={styles.draftHeaderRight}>
                <button className={styles.btnExportDossier}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export Dossier
                </button>
                <button className={styles.previewClose} onClick={closeDraft}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Scrollable Body */}
            <div className={styles.draftScroll}>

              {/* Row 1 — Profile / Cumulative Avg / Attendance */}
              <div className={styles.draftRow1}>

                {/* Student Profile Card */}
                <div className={styles.draftProfileCard}>
                  <img src={draftStudent.avatar} alt={draftStudent.name} className={styles.draftAvatar} />
                  <p className={styles.draftStudentName}>{draftStudent.name}</p>
                  <p className={styles.draftStudentGrade}>Grade 11 • Science Track</p>
                  <div className={styles.draftMetaGrid}>
                    <div className={styles.draftMetaCell}>
                      <p className={styles.draftMetaLabel}>STUDENT ID</p>
                      <p className={styles.draftMetaValue}>GSB-24-{draftStudent.id}</p>
                    </div>
                    <div className={styles.draftMetaCell}>
                      <p className={styles.draftMetaLabel}>ADVISOR</p>
                      <p className={styles.draftMetaValue}>Dr. Aris Thorne</p>
                    </div>
                  </div>
                </div>

                {/* Cumulative Average */}
                <div className={styles.draftStatCard}>
                  <div className={styles.draftStatHeader}>
                    <p className={styles.draftStatTitle}>Cumulative<br/>Average</p>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                      <polyline points="16 7 22 7 22 13"/>
                    </svg>
                  </div>
                  <div className={styles.draftBigStat}>
                    <span className={styles.draftBigNum}>{Math.round(draftStudent.avgScore)}</span>
                    <span className={styles.draftBigDenom}>/100</span>
                  </div>
                  <div className={styles.draftProgressBar}>
                    <div className={styles.draftProgressFill} style={{ width: `${draftStudent.avgScore}%` }} />
                  </div>
                  <p className={styles.draftProgressNote}>+3 points from previous term</p>
                </div>

                {/* Attendance Record */}
                <div className={styles.draftStatCard}>
                  <div className={styles.draftStatHeader}>
                    <p className={styles.draftStatTitle}>Attendance<br/>Record</p>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                      <line x1="16" y1="2" x2="16" y2="6"/>
                      <line x1="8" y1="2" x2="8" y2="6"/>
                      <line x1="3" y1="10" x2="21" y2="10"/>
                    </svg>
                  </div>
                  <div className={styles.draftBigStat}>
                    <span className={styles.draftBigNum}>{draftStudent.completion}</span>
                    <span className={styles.draftBigDenom}>%</span>
                  </div>
                  <div className={styles.draftProgressBar}>
                    <div className={styles.draftProgressFill} style={{ width: `${draftStudent.completion}%` }} />
                  </div>
                  <p className={styles.draftProgressNote}>1 absent day (excused)</p>
                </div>

              </div>

              {/* Row 2 — Academic Momentum */}
              <div className={styles.draftMomentumCard}>
                <div className={styles.draftMomentumLeft}>
                  <p className={styles.draftMomentumTitle}>Academic<br/>Momentum</p>
                  <p className={styles.draftMomentumDesc}>
                    {draftStudent.name.split(" ")[0]} demonstrates a consistent upward trajectory across all core
                    scientific disciplines, recovering beautifully from an early dip in calculus.
                  </p>
                </div>
                <div className={styles.draftMomentumChart}>
                  {/* Simple SVG bar chart */}
                  {[40, 55, 48, 62, 70, 85, 92].map((h, i) => (
                    <div key={i} className={styles.draftChartBarWrap}>
                      {i === 5 && <span className={styles.draftChartLabel}>Dec</span>}
                      <div
                        className={`${styles.draftChartBar} ${i === 5 ? styles.draftChartBarActive : ""}`}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Row 3 — Module Breakdown + Quote */}
              <div className={styles.draftRow3}>

                {/* Module Breakdown */}
                <div className={styles.draftModuleCard}>
                  <p className={styles.draftModuleTitle}>Module Breakdown</p>
                  <div className={styles.draftModuleList}>
                    {[
                      { icon: "🔬", name: "Advanced Biology",    teacher: "Prof. Hemlock", score: 96 },
                      { icon: "∑",  name: "Calculus II",         teacher: "Dr. Vance",    score: 88 },
                      { icon: "🌍", name: "Modern World History",teacher: "Mr. Sterling",  score: 94 },
                      { icon: "📖", name: "Literature Review",   teacher: "Ms. Albright", score: 91 },
                    ].map((mod) => (
                      <div key={mod.name} className={styles.draftModuleRow}>
                        <div className={styles.draftModuleIconBox}>
                          <span className={styles.draftModuleEmoji}>{mod.icon}</span>
                        </div>
                        <div className={styles.draftModuleInfo}>
                          <p className={styles.draftModuleName}>{mod.name}</p>
                          <p className={styles.draftModuleTeacher}>{mod.teacher}</p>
                        </div>
                        <div className={`${styles.draftModuleScore} ${
                          mod.score >= 93 ? styles.scoreHigh :
                          mod.score >= 88 ? styles.scoreMid  : styles.scoreLow
                        }`}>{mod.score}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Advisor Quote */}
                <div className={styles.draftQuoteCard}>
                  <p className={styles.draftQuoteText}>
                    &ldquo;{draftStudent.name.split(" ")[0]} possesses a rare synthesis of analytical
                    rigor and creative curiosity. Their final project on cellular mitosis was not merely
                    accurate; it was structurally poetic.&rdquo;
                  </p>
                  <div className={styles.draftQuoteAuthor}>
                    <img src={draftStudent.avatar} alt="advisor" className={styles.draftQuoteAvatar} />
                    <div>
                      <p className={styles.draftQuoteAuthorName}>Dr. Aris Thorne</p>
                      <p className={styles.draftQuoteAuthorRole}>Lead Advisor, Sciences Dept.</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}