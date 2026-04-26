"use client";

import { useState, useEffect } from "react";
import styles from "../reporting/report.module.css";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

type Student = {
    id: string;
    name: string;
    course: string;
    section: string;
    completion: number;
    avgScore: number;
    avatar: string;
    status: "generate" | "draft" | "review";
};

type SubjectRow = {
    subject: string;
    credits: number;
    grade: string;
    remarks: string;
};

type NilaiDetail = {
    _id: string;
    type: "TUGAS" | "UJIAN" | "KUIS";
    score: number;
    week?: number;
    semester: string;
    catatan?: string;
};

type RaportPayload = {
    anakDidik: {
        _id: string;
        name: string;
        region: string;
        category: string;
        parentName?: string;
    };
    semester: string;
    raport: {
        rataRataTugas: number | null;
        rataRataUjian: number | null;
        nilaiAkhir: number | null;
        totalPertemuanTugas: number;
        detailTugas: NilaiDetail[];
        detailUjian: NilaiDetail[];
    };
};

type AnakDidikFromAPI = {
    _id: string;
    name: string;
    region?: string;
    category?: string;
    parentName?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const scoreToGrade = (score: number): string => {
    if (score >= 93) return "A+";
    if (score >= 90) return "A";
    if (score >= 87) return "A−";
    if (score >= 83) return "B+";
    if (score >= 80) return "B";
    if (score >= 77) return "B−";
    if (score >= 73) return "C+";
    if (score >= 70) return "C";
    return "D";
};

const gradeClass = (grade: string, styles: Record<string, string>) => {
    if (grade.startsWith("A")) return styles.gradeA;
    if (grade.startsWith("B")) return styles.gradeB;
    return styles.gradeC;
};

/** Map API AnakDidik → local Student shape */
const mapToStudent = (a: AnakDidikFromAPI): Student => ({
    id: a._id,
    name: a.name,
    course: a.category || "Pembelajaran Umum",
    section: a.region || "—",
    completion: 0,
    avgScore: 0,
    avatar: `https://i.pravatar.cc/150?u=${a._id}`,
    status: "generate",
});

/** Build SubjectRow[] from raport detail arrays */
const buildSubjectRows = (payload: RaportPayload): SubjectRow[] => {
    const rows: SubjectRow[] = [];

    payload.raport.detailTugas.forEach((n) => {
        rows.push({
            subject: `Tugas Minggu ${n.week ?? "—"}`,
            credits: 1.0,
            grade: scoreToGrade(n.score),
            remarks: n.catatan || `Nilai: ${n.score}`,
        });
    });

    payload.raport.detailUjian.forEach((n, i) => {
        rows.push({
            subject: `Ujian ${i + 1}`,
            credits: 2.0,
            grade: scoreToGrade(n.score),
            remarks: n.catatan || `Nilai: ${n.score}`,
        });
    });

    return rows;
};

/** Module emojis cycling for draft modal */
const MODULE_EMOJIS = ["📚", "✏️", "🔬", "📖", "∑", "🌍"];

/** Map semester label shown in dropdown → API semester string */
const SEMESTER_LABEL_MAP: Record<string, string> = {
    "Semester 1 2024": "2024-1",
    "Semester 2 2024": "2024-2",
    "Semester 1 2025": "2025-1",
};

// ─── Nav Items ────────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportPage() {
    const router = useRouter();
    const [activeNav, setActiveNav] = useState("Report");
    const [mounted, setMounted] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
    const [previewPage, setPreviewPage] = useState(1);
    const [draftStudent, setDraftStudent] = useState<Student | null>(null);

    // ── API state ──────────────────────────────────────────────────────────────
    const [students, setStudents] = useState<Student[]>([]);
    const [isLoadingStudents, setIsLoadingStudents] = useState(true);
    const [selectedSemester, setSelectedSemester] = useState("2024-1");

    // Raport data for PDF preview modal
    const [raportData, setRaportData] = useState<RaportPayload | null>(null);
    const [isLoadingRaport, setIsLoadingRaport] = useState(false);

    // Evaluation data for draft/performance modal
    const [draftData, setDraftData] = useState<RaportPayload | null>(null);
    const [isLoadingDraft, setIsLoadingDraft] = useState(false);

    // ── Mount ──────────────────────────────────────────────────────────────────
    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 30);
        return () => clearTimeout(t);
    }, []);

    // ── Fetch Students ─────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchStudents = async () => {
            setIsLoadingStudents(true);
            try {
                const res = await fetch("/api/students");
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                // Support both { students: [] } and bare array shapes
                const list: AnakDidikFromAPI[] = Array.isArray(data) ? data : data.students ?? [];
                setStudents(list.map(mapToStudent));
            } catch (err) {
                console.error("[ReportPage] fetch students:", err);
                setStudents([]);
            } finally {
                setIsLoadingStudents(false);
            }
        };
        fetchStudents();
    }, []);

    // ── Re-fetch student stats when semester changes ───────────────────────────
    // (status is reset to "generate"; real status resolved on modal open)
    useEffect(() => {
        setStudents((prev) => prev.map((s) => ({ ...s, status: "generate", avgScore: 0, completion: 0 })));
    }, [selectedSemester]);

    // ── Body scroll lock ───────────────────────────────────────────────────────
    useEffect(() => {
        if (previewStudent || draftStudent) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [previewStudent, draftStudent]);

    // ── Open Preview (PDF modal) ───────────────────────────────────────────────
    const openPreview = async (student: Student) => {
        setPreviewStudent(student);
        setPreviewPage(1);
        setRaportData(null);
        setIsLoadingRaport(true);

        try {
            const res = await fetch(
                `/api/evaluation/raport?anakDidikId=${student.id}&semester=${selectedSemester}`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: RaportPayload = await res.json();
            setRaportData(data);

            // Patch student card stats & status after we know the data
            const nilaiAkhir = data.raport.nilaiAkhir;
            const totalTugas = data.raport.totalPertemuanTugas;
            setStudents((prev) =>
                prev.map((s) =>
                    s.id === student.id
                        ? {
                            ...s,
                            avgScore: nilaiAkhir ?? s.avgScore,
                            completion: totalTugas > 0 ? Math.min(100, Math.round((totalTugas / 12) * 100)) : s.completion,
                            status: nilaiAkhir !== null ? "review" : totalTugas > 0 ? "draft" : "generate",
                        }
                        : s
                )
            );
        } catch (err) {
            console.error("[ReportPage] fetch raport:", err);
        } finally {
            setIsLoadingRaport(false);
        }
    };

    const closePreview = () => {
        setPreviewStudent(null);
        setRaportData(null);
    };

    // ── Open Draft (performance modal) ────────────────────────────────────────
    const openDraft = async (student: Student) => {
        setDraftStudent(student);
        setDraftData(null);
        setIsLoadingDraft(true);

        try {
            const res = await fetch(
                `/api/evaluation?anakDidikId=${student.id}&semester=${selectedSemester}`
            );
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data: RaportPayload = await res.json();
            setDraftData(data);
        } catch (err) {
            console.error("[ReportPage] fetch evaluation:", err);
        } finally {
            setIsLoadingDraft(false);
        }
    };

    const closeDraft = () => {
        setDraftStudent(null);
        setDraftData(null);
    };

    // ── Derived values ─────────────────────────────────────────────────────────
    const activeSubjectRows: SubjectRow[] = raportData ? buildSubjectRows(raportData) : [];

    const termGPA = (student: Student) => (student.avgScore / 25).toFixed(2);
    const cumGPA = (student: Student) => ((student.avgScore / 25) + 0.05).toFixed(2);

    const filteredStudents = students.filter(
        (s) =>
            s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Chart bar heights for draft modal from weekly tugas scores
    const draftChartBars: number[] = (() => {
        if (!draftData || draftData.raport.detailTugas.length === 0) {
            return [40, 55, 48, 62, 70, 85, 92]; // fallback placeholder
        }
        const scores = draftData.raport.detailTugas.map((n) => n.score);
        // Normalize to 0–100 range for bar heights
        return scores.slice(-7).map((s) => Math.round(s));
    })();

    // Module list for draft modal
    const draftModules = (() => {
        if (!draftData) return [];
        const all: { icon: string; name: string; teacher: string; score: number }[] = [];

        draftData.raport.detailTugas.forEach((n, i) => {
            all.push({
                icon: MODULE_EMOJIS[i % MODULE_EMOJIS.length],
                name: `Tugas Minggu ${n.week ?? i + 1}`,
                teacher: draftData.anakDidik.name,
                score: n.score,
            });
        });

        draftData.raport.detailUjian.forEach((n, i) => {
            all.push({
                icon: "📋",
                name: `Ujian ${i + 1}`,
                teacher: draftData.anakDidik.name,
                score: n.score,
            });
        });

        return all.slice(0, 4); // match original 4-item layout
    })();

    // ── Semester change ────────────────────────────────────────────────────────
    const handleSemesterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedSemester(SEMESTER_LABEL_MAP[val] ?? val);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className={`${styles.container} ${mounted ? styles.mounted : ""}`}>

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
                                <span>Export<br />All<br />Drafts</span>
                            </button>
                            <button className={styles.btnPublish}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                                    <polyline points="16 6 12 2 8 6" />
                                    <line x1="12" y1="2" x2="12" y2="15" />
                                </svg>
                                <span>Publish<br />Selected</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Bar */}
                <div className={styles.filterBar}>
                    <div className={styles.filterGroup}>
                        <div className={styles.filterItem}>
                            <label className={styles.filterLabel}>SEMESTER</label>
                            <div className={styles.selectWrapper}>
                                <select
                                    className={styles.filterSelect}
                                    onChange={handleSemesterChange}
                                    defaultValue="Semester 1 2024"
                                >
                                    <option value="Semester 1 2024">Semester 1 2024</option>
                                    <option value="Semester 2 2024">Semester 2 2024</option>
                                    <option value="Semester 1 2025">Semester 1 2025</option>
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
                                    <option>Semua Wilayah</option>
                                    <option>Jakarta</option>
                                    <option>Jawa Barat</option>
                                    <option>Jawa Timur</option>
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
                    {isLoadingStudents ? (
                        // Loading placeholders — same card shape, no new class needed
                        Array.from({ length: 4 }).map((_, index) => (
                            <div
                                key={index}
                                className={`${styles.studentCard} ${mounted ? styles[`cardAnim${index + 1}` as keyof typeof styles] : styles.cardHidden}`}
                                style={{ opacity: 0.4, pointerEvents: "none" }}
                            >
                                <div className={styles.cardHeader}>
                                    <div className={styles.avatarWrapper}>
                                        <div className={styles.avatar} style={{ background: "#e5e7eb", borderRadius: "50%" }} />
                                    </div>
                                    <div className={styles.cardInfo}>
                                        <div className={styles.cardNameRow}>
                                            <div style={{ height: 16, width: 120, background: "#e5e7eb", borderRadius: 4 }} />
                                        </div>
                                        <div style={{ height: 12, width: 80, background: "#e5e7eb", borderRadius: 4, marginTop: 6 }} />
                                    </div>
                                </div>
                                <div className={styles.statsRow}>
                                    <div className={styles.statBlock}>
                                        <span className={styles.statLabel}>LOADING…</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    ) : filteredStudents.length === 0 ? (
                        <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "3rem 0", opacity: 0.5 }}>
                            <p>Tidak ada anak didik ditemukan.</p>
                        </div>
                    ) : (
                        filteredStudents.map((student, index) => (
                            <div
                                key={student.id}
                                className={`${styles.studentCard} ${mounted ? styles[`cardAnim${(index % 4) + 1}` as keyof typeof styles] : styles.cardHidden}`}
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
                                            {student.course} •<br />{student.section}
                                        </p>
                                    </div>
                                </div>

                                {/* ID Badge */}
                                <div className={styles.idBadge}>
                                    <span className={styles.idTag}>ID: {student.id.slice(-6).toUpperCase()}</span>
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
                                            {student.avgScore > 0 ? student.avgScore.toFixed(1) : "—"}{" "}
                                            <span className={styles.statSuffix}>/100</span>
                                        </span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className={styles.cardActions}>
                                    <button className={styles.btnDetails} onClick={() => openPreview(student)}>
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                        </svg>
                                        Details
                                    </button>

                                    {student.status === "generate" && (
                                        <button className={styles.btnGenerate} onClick={() => openPreview(student)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                                            </svg>
                                            Generate<br />Report
                                        </button>
                                    )}
                                    {student.status === "draft" && (
                                        <button className={styles.btnDraft} onClick={() => openDraft(student)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                                                <polyline points="14 2 14 8 20 8" />
                                            </svg>
                                            Draft<br />Report
                                        </button>
                                    )}
                                    {student.status === "review" && (
                                        <button className={styles.btnReview} onClick={() => openPreview(student)}>
                                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                                                <circle cx="8.5" cy="8.5" r="1.5" />
                                                <polyline points="21 15 16 10 5 21" />
                                            </svg>
                                            Review<br />Draft
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
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
                                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                                </svg>
                                <span>SEMESTER {selectedSemester.toUpperCase()}</span>
                                <span className={styles.previewBadge}>PDF PREVIEW</span>
                            </div>
                            <h2 className={styles.previewTitle}>Student Report Card</h2>
                            <p className={styles.previewSubtitle}>
                                {previewStudent.name} — {previewStudent.course}, {previewStudent.section}
                            </p>

                            <div className={styles.previewActions}>
                                <button className={styles.btnShareLink}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="18" cy="5" r="3" />
                                        <circle cx="6" cy="12" r="3" />
                                        <circle cx="18" cy="19" r="3" />
                                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                                    </svg>
                                    Share Link
                                </button>
                                <button className={styles.btnDownloadPdf}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Download PDF
                                </button>
                                <button className={styles.previewClose} onClick={closePreview}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
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
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6" /></svg>
                                </button>
                                <span className={styles.pageIndicator}>Page {previewPage} of 2</span>
                                <button
                                    className={styles.toolbarBtn}
                                    onClick={() => setPreviewPage((p) => Math.min(2, p + 1))}
                                    disabled={previewPage === 2}
                                >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </button>
                            </div>
                            <div className={styles.toolbarRight}>
                                <button className={styles.toolbarBtn}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                </button>
                                <span className={styles.zoomLabel}>100%</span>
                                <button className={styles.toolbarBtn}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                </button>
                                <button className={styles.toolbarBtn}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                                </button>
                                <button className={styles.toolbarBtn}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>
                                </button>
                            </div>
                        </div>

                        {/* Document Paper */}
                        <div className={styles.previewScroll}>
                            <div className={styles.docPaper}>

                                {/* Loading State */}
                                {isLoadingRaport && (
                                    <div style={{ textAlign: "center", padding: "4rem 0", opacity: 0.5 }}>
                                        <p>Memuat data raport…</p>
                                    </div>
                                )}

                                {!isLoadingRaport && (
                                    <>
                                        {/* Document Header */}
                                        <div className={styles.docHeader}>
                                            <div className={styles.docSchoolInfo}>
                                                <div className={styles.docSchoolIcon}>
                                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                                                        <path d="M22 10L12 5 2 10l10 5 10-5z" />
                                                        <path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <p className={styles.docSchoolName}>Program Pendidikan Relawan</p>
                                                    <p className={styles.docSchoolTagline}>Belajar Bersama, Tumbuh Bersama</p>
                                                </div>
                                            </div>
                                            <div className={styles.docTranscriptInfo}>
                                                <p className={styles.docTranscriptLabel}>RAPORT RESMI</p>
                                                <p className={styles.docTranscriptTerm}>
                                                    {raportData?.semester ?? selectedSemester}
                                                </p>
                                                <p className={styles.docTranscriptIssued}>
                                                    Diterbitkan {new Date().toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                                                </p>
                                            </div>
                                        </div>

                                        <div className={styles.docDivider} />

                                        {/* Student Info Grid */}
                                        <div className={styles.docInfoGrid}>
                                            <div className={styles.docInfoCell}>
                                                <p className={styles.docInfoLabel}>NAMA ANAK DIDIK</p>
                                                <p className={styles.docInfoValue}>
                                                    {raportData?.anakDidik.name ?? previewStudent.name}
                                                </p>
                                            </div>
                                            <div className={styles.docInfoCell}>
                                                <p className={styles.docInfoLabel}>ID ANAK DIDIK</p>
                                                <p className={styles.docInfoValue}>
                                                    #{previewStudent.id.slice(-8).toUpperCase()}
                                                </p>
                                            </div>
                                            <div className={styles.docInfoCell}>
                                                <p className={styles.docInfoLabel}>KATEGORI</p>
                                                <p className={styles.docInfoValue}>
                                                    {raportData?.anakDidik.category ?? previewStudent.course}
                                                </p>
                                            </div>
                                            <div className={styles.docInfoCell}>
                                                <p className={styles.docInfoLabel}>WILAYAH</p>
                                                <p className={styles.docInfoValue}>
                                                    {raportData?.anakDidik.region ?? previewStudent.section}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Academic Performance */}
                                        <div className={styles.docSection}>
                                            <p className={styles.docSectionTitle}>Rekap Nilai</p>

                                            {activeSubjectRows.length > 0 ? (
                                                <table className={styles.docTable}>
                                                    <thead>
                                                        <tr className={styles.docTableHead}>
                                                            <th>KOMPONEN</th>
                                                            <th>BOBOT</th>
                                                            <th>GRADE</th>
                                                            <th>KETERANGAN</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {activeSubjectRows.map((row, i) => (
                                                            <tr key={i} className={styles.docTableRow}>
                                                                <td className={styles.docTableSubject}>{row.subject}</td>
                                                                <td className={styles.docTableCredits}>{row.credits.toFixed(1)}</td>
                                                                <td>
                                                                    <span className={`${styles.docGradeBadge} ${gradeClass(row.grade, styles)}`}>
                                                                        {row.grade}
                                                                    </span>
                                                                </td>
                                                                <td className={styles.docTableRemarks}>{row.remarks}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <p style={{ opacity: 0.5, fontSize: 14, padding: "1rem 0" }}>
                                                    Belum ada data nilai untuk semester ini.
                                                </p>
                                            )}

                                            {/* GPA Row */}
                                            <div className={styles.docGpaRow}>
                                                <div className={styles.docGpaBox}>
                                                    <p className={styles.docGpaLabel}>RATA-RATA TUGAS</p>
                                                    <p className={styles.docGpaValue}>
                                                        {raportData?.raport.rataRataTugas ?? "—"}
                                                    </p>
                                                </div>
                                                <div className={`${styles.docGpaBox} ${styles.docGpaBoxAccent}`}>
                                                    <p className={styles.docGpaLabel}>NILAI AKHIR</p>
                                                    <p className={styles.docGpaValue}>
                                                        {raportData?.raport.nilaiAkhir ?? "—"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Catatan Belajar */}
                                        <div className={styles.docSection}>
                                            <p className={styles.docSectionTitle}>Catatan Belajar Relawan</p>
                                            <blockquote className={styles.docRemarks}>
                                                {raportData?.raport.detailTugas.find((n) => n.catatan)?.catatan
                                                    ?? `${(raportData?.anakDidik.name ?? previewStudent.name).split(" ")[0]} telah menyelesaikan ${raportData?.raport.totalPertemuanTugas ?? 0} pertemuan pada semester ini. Terus semangat belajar!`}
                                            </blockquote>
                                        </div>

                                        {/* Signatures */}
                                        <div className={styles.docSignatures}>
                                            <div className={styles.docSigBlock}>
                                                <p className={styles.docSigName}>Relawan</p>
                                                <div className={styles.docSigLine} />
                                                <p className={styles.docSigRole}>PENGAJAR</p>
                                            </div>
                                            <div className={styles.docSealBlock}>
                                                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="1.2">
                                                    <circle cx="12" cy="12" r="10" />
                                                    <path d="M12 8l1.09 3.26L16.5 12l-3.41 0.74L12 16l-1.09-3.26L7.5 12l3.41-0.74L12 8z" />
                                                </svg>
                                                <p className={styles.docSealLabel}>OFFICIAL SEAL</p>
                                            </div>
                                            <div className={styles.docSigBlock}>
                                                <p className={styles.docSigName}>Koordinator</p>
                                                <div className={styles.docSigLine} />
                                                <p className={styles.docSigRole}>KOORDINATOR WILAYAH</p>
                                            </div>
                                        </div>
                                    </>
                                )}

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
                                <p className={styles.draftTermLabel}>
                                    SEMESTER {selectedSemester.toUpperCase()}
                                </p>
                                <h2 className={styles.draftTitle}>Academic<br />Performance</h2>
                            </div>
                            <div className={styles.draftHeaderRight}>
                                <button className={styles.btnExportDossier}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="7 10 12 15 17 10" />
                                        <line x1="12" y1="15" x2="12" y2="3" />
                                    </svg>
                                    Export Dossier
                                </button>
                                <button className={styles.previewClose} onClick={closeDraft}>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18" />
                                        <line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                </button>
                            </div>
                        </div>

                        {/* Scrollable Body */}
                        <div className={styles.draftScroll}>

                            {isLoadingDraft ? (
                                <div style={{ textAlign: "center", padding: "4rem 0", opacity: 0.5 }}>
                                    <p>Memuat data penilaian…</p>
                                </div>
                            ) : (
                                <>
                                    {/* Row 1 — Profile / Cumulative Avg / Attendance */}
                                    <div className={styles.draftRow1}>

                                        {/* Student Profile Card */}
                                        <div className={styles.draftProfileCard}>
                                            <img
                                                src={draftStudent.avatar}
                                                alt={draftStudent.name}
                                                className={styles.draftAvatar}
                                            />
                                            <p className={styles.draftStudentName}>{draftStudent.name}</p>
                                            <p className={styles.draftStudentGrade}>
                                                {draftData?.anakDidik.category ?? draftStudent.course}
                                            </p>
                                            <div className={styles.draftMetaGrid}>
                                                <div className={styles.draftMetaCell}>
                                                    <p className={styles.draftMetaLabel}>ID</p>
                                                    <p className={styles.draftMetaValue}>
                                                        {draftStudent.id.slice(-8).toUpperCase()}
                                                    </p>
                                                </div>
                                                <div className={styles.draftMetaCell}>
                                                    <p className={styles.draftMetaLabel}>WILAYAH</p>
                                                    <p className={styles.draftMetaValue}>
                                                        {draftData?.anakDidik.region ?? draftStudent.section}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Cumulative Average */}
                                        <div className={styles.draftStatCard}>
                                            <div className={styles.draftStatHeader}>
                                                <p className={styles.draftStatTitle}>Nilai<br />Rata-rata</p>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
                                                    <polyline points="16 7 22 7 22 13" />
                                                </svg>
                                            </div>
                                            <div className={styles.draftBigStat}>
                                                <span className={styles.draftBigNum}>
                                                    {draftData?.raport.nilaiAkhir
                                                        ?? draftData?.raport.rataRataTugas
                                                        ?? "—"}
                                                </span>
                                                <span className={styles.draftBigDenom}>/100</span>
                                            </div>
                                            <div className={styles.draftProgressBar}>
                                                <div
                                                    className={styles.draftProgressFill}
                                                    style={{
                                                        width: `${draftData?.raport.nilaiAkhir
                                                            ?? draftData?.raport.rataRataTugas
                                                            ?? 0}%`,
                                                    }}
                                                />
                                            </div>
                                            <p className={styles.draftProgressNote}>
                                                {draftData?.raport.totalPertemuanTugas ?? 0} pertemuan tercatat
                                            </p>
                                        </div>

                                        {/* Attendance Record */}
                                        <div className={styles.draftStatCard}>
                                            <div className={styles.draftStatHeader}>
                                                <p className={styles.draftStatTitle}>Total<br />Pertemuan</p>
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                                                    <line x1="16" y1="2" x2="16" y2="6" />
                                                    <line x1="8" y1="2" x2="8" y2="6" />
                                                    <line x1="3" y1="10" x2="21" y2="10" />
                                                </svg>
                                            </div>
                                            <div className={styles.draftBigStat}>
                                                <span className={styles.draftBigNum}>
                                                    {draftData?.raport.totalPertemuanTugas ?? 0}
                                                </span>
                                                <span className={styles.draftBigDenom}>sesi</span>
                                            </div>
                                            <div className={styles.draftProgressBar}>
                                                <div
                                                    className={styles.draftProgressFill}
                                                    style={{
                                                        width: `${Math.min(
                                                            100,
                                                            Math.round(((draftData?.raport.totalPertemuanTugas ?? 0) / 12) * 100)
                                                        )}%`,
                                                    }}
                                                />
                                            </div>
                                            <p className={styles.draftProgressNote}>
                                                Ujian: {draftData?.raport.detailUjian.length ?? 0} kali
                                            </p>
                                        </div>

                                    </div>

                                    {/* Row 2 — Academic Momentum */}
                                    <div className={styles.draftMomentumCard}>
                                        <div className={styles.draftMomentumLeft}>
                                            <p className={styles.draftMomentumTitle}>Academic<br />Momentum</p>
                                            <p className={styles.draftMomentumDesc}>
                                                {draftStudent.name.split(" ")[0]} menunjukkan progres nilai
                                                sepanjang semester. Grafik berdasarkan nilai tugas mingguan yang
                                                telah diinput.
                                            </p>
                                        </div>
                                        <div className={styles.draftMomentumChart}>
                                            {draftChartBars.map((h, i) => (
                                                <div key={i} className={styles.draftChartBarWrap}>
                                                    {i === draftChartBars.length - 2 && (
                                                        <span className={styles.draftChartLabel}>
                                                            W{(draftData?.raport.detailTugas[i]?.week ?? i + 1)}
                                                        </span>
                                                    )}
                                                    <div
                                                        className={`${styles.draftChartBar} ${i === draftChartBars.length - 2 ? styles.draftChartBarActive : ""}`}
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
                                            <p className={styles.draftModuleTitle}>Rincian Nilai</p>
                                            <div className={styles.draftModuleList}>
                                                {draftModules.length > 0 ? (
                                                    draftModules.map((mod, i) => (
                                                        <div key={i} className={styles.draftModuleRow}>
                                                            <div className={styles.draftModuleIconBox}>
                                                                <span className={styles.draftModuleEmoji}>{mod.icon}</span>
                                                            </div>
                                                            <div className={styles.draftModuleInfo}>
                                                                <p className={styles.draftModuleName}>{mod.name}</p>
                                                                <p className={styles.draftModuleTeacher}>{draftStudent.name}</p>
                                                            </div>
                                                            <div
                                                                className={`${styles.draftModuleScore} ${mod.score >= 90
                                                                        ? styles.scoreHigh
                                                                        : mod.score >= 75
                                                                            ? styles.scoreMid
                                                                            : styles.scoreLow
                                                                    }`}
                                                            >
                                                                {mod.score}
                                                            </div>
                                                        </div>
                                                    ))
                                                ) : (
                                                    <p style={{ opacity: 0.5, fontSize: 13, padding: "0.5rem 0" }}>
                                                        Belum ada data nilai untuk ditampilkan.
                                                    </p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Catatan / Quote */}
                                        <div className={styles.draftQuoteCard}>
                                            <p className={styles.draftQuoteText}>
                                                &ldquo;
                                                {draftData?.raport.detailTugas.find((n) => n.catatan)?.catatan
                                                    ?? `${draftStudent.name.split(" ")[0]} telah menyelesaikan ${draftData?.raport.totalPertemuanTugas ?? 0} pertemuan dengan nilai rata-rata ${draftData?.raport.rataRataTugas ?? "—"}. Terus pantau perkembangannya setiap minggu.`}
                                                &rdquo;
                                            </p>
                                            <div className={styles.draftQuoteAuthor}>
                                                <img
                                                    src={draftStudent.avatar}
                                                    alt="relawan"
                                                    className={styles.draftQuoteAvatar}
                                                />
                                                <div>
                                                    <p className={styles.draftQuoteAuthorName}>Relawan Pengajar</p>
                                                    <p className={styles.draftQuoteAuthorRole}>
                                                        {draftData?.anakDidik.region ?? draftStudent.section}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                    </div>
                                </>
                            )}

                        </div>

                    </div>
                </div>
            )}

        </div>
    );
}