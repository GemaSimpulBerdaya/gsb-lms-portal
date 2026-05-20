"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./student.module.css";

type Student = {
    _id: string;
    name: string;
    region: string;
    category: string;
    parentName: string;
};

type Schedule = {
    _id: string;
    region: string;
    level: string;
    semester: string;
    activeWeek: number;
};

type SearchResult = {
    total: number;
    region: string;
    level: string;
    students: Student[];
} | null;

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
    DISABILITAS: { bg: "#ede9fe", color: "#7c3aed" },
    "FASE PUCUK": { bg: "#dcfce7", color: "#16a34a" },
    "FASE A":     { bg: "#dbeafe", color: "#1d4ed8" },
    "FASE B":     { bg: "#e0f2fe", color: "#0369a1" },
    "FASE C":     { bg: "#f0f9ff", color: "#075985" },
    "FASE D":     { bg: "#ffedd5", color: "#c2410c" },
    "FASE E":     { bg: "#fee2e2", color: "#991b1b" },
    SNBT:         { bg: "#fef3c7", color: "#92400e" },
    TK:           { bg: "#dcfce7", color: "#16a34a" },
    SD:           { bg: "#dbeafe", color: "#1d4ed8" },
    SMP:          { bg: "#ffedd5", color: "#c2410c" },
};

const DEFAULT_COLOR = { bg: "#f3f4f6", color: "#374151" };

export default function StudentPage() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SearchResult>(null);
    const [error, setError] = useState("");
    const [tableSearch, setTableSearch] = useState("");

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

    // Keep localStorage in sync
    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("activeSemester", selectedSemester);
        }
    }, [selectedSemester]);

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

    const isReadOnly = selectedSemester !== getCurrentSemester();

    const fetchSchedules = useCallback(async () => {
        try {
            const res = await fetch("/api/volunteer/schedule");
            const data = await res.json();
            if (res.ok && data.schedules) {
                setSchedules(data.schedules);
                
                const activeSchedules = data.schedules.filter((s: { semester: string; _id: string }) => s.semester === selectedSemester);
                if (activeSchedules.length > 0) {
                    const targetSched = activeSchedules.find((s: { _id: string }) => s._id === selectedScheduleId) || activeSchedules[0];
                    const timer = setTimeout(() => {
                        setSelectedScheduleId(targetSched._id);
                    }, 0);
                    return () => clearTimeout(timer);
                } else {
                    const timer = setTimeout(() => {
                        setSelectedScheduleId("");
                    }, 0);
                    return () => clearTimeout(timer);
                }
            }
        } catch (err) {
            console.error("Gagal memuat jadwal", err);
        }
    }, [selectedSemester, selectedScheduleId]);

    // Fetch Schedules on mount or semester change
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchSchedules();
        }, 0);
        return () => clearTimeout(timer);
    }, [fetchSchedules]);
    
    const formatSemester = (sem: string) => {
        if (!sem) return "-";
        const [year, term] = sem.split("-");
        return `Semester ${term} - ${year}`;
    };

    const availableSemesters = Array.from(new Set([...schedules.map(s => s.semester), getCurrentSemester()])).sort().reverse();

    // 1b. Sync schedule with selected semester
    useEffect(() => {
        if (selectedScheduleId && schedules.length > 0) {
            const currentSched = schedules.find(s => s._id === selectedScheduleId);
            if (currentSched && currentSched.semester !== selectedSemester) {
                const timer = setTimeout(() => {
                    setSelectedScheduleId("");
                }, 0);
                return () => clearTimeout(timer);
            }
        }
    }, [selectedSemester, schedules, selectedScheduleId]);

    const fetchStudents = useCallback(async () => {
        const sched = schedules.find(s => s._id === selectedScheduleId);
        if (!sched) return;
        
        setLoading(true);
        setError("");
        setResult(null);
        setTableSearch("");

        try {
            const params = new URLSearchParams({ region: sched.region, level: sched.level });
            const res = await fetch(`/api/volunteer/students?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
            setResult(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Gagal mengambil data.");
        } finally {
            setLoading(false);
        }
    }, [selectedScheduleId, schedules]);

    // Automatically fetch students when selected schedule changes
    useEffect(() => {
        if (selectedScheduleId) {
            const timer = setTimeout(() => {
                fetchStudents();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [selectedScheduleId, fetchStudents]);

    const filtered = result?.students.filter((s) =>
        s.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        s.parentName.toLowerCase().includes(tableSearch.toLowerCase())
    ) ?? [];

    const levelColor = result ? (LEVEL_COLORS[result.level] || DEFAULT_COLOR) : null;

    return (
        <div className={styles.page}>
            {/* Hero */}
            <div className={styles.hero}>
                <span className={styles.heroLabel}>Manajemen Anak Didik</span>
                <h1 className={styles.heroTitle}>Data Murid.</h1>
                <p className={styles.heroDesc}>
                    Daftar anak didik ini dimuat otomatis berdasarkan Jadwal Mengajar Anda yang sedang aktif.
                </p>
                {isReadOnly && (
                    <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(192, 57, 43, 0.1)', color: '#c0392b', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        ARSIP SEMESTER LAMPAU
                    </div>
                )}
            </div>

            {/* Filter Card */}
            <div className={styles.filterCard} style={{ paddingBottom: '24px' }}>
                <p className={styles.filterCardTitle}>Jadwal Mengajar Aktif</p>

                <div className={styles.filterGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                    <div className={styles.filterField}>
                        <label className={styles.filterLabel}>Semester</label>
                        <div style={{ position: 'relative' }}>
                            <select 
                                className={styles.filterInput} 
                                style={{ appearance: 'none', cursor: 'pointer', paddingRight: '40px' }}
                                value={selectedSemester}
                                onChange={(e) => setSelectedSemester(e.target.value)}
                            >
                                {availableSemesters.map(sem => (
                                    <option key={sem} value={sem}>{formatSemester(sem)}</option>
                                ))}
                            </select>
                            <svg style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>
                    </div>

                    <div className={styles.filterField}>
                        <label className={styles.filterLabel}>Pilih Jadwal Anda</label>
                        {schedules.length === 0 ? (
                            <div style={{ padding: '12px 16px', background: '#fff0ee', color: '#c0392b', borderRadius: '12px', fontSize: '13.5px', fontWeight: 500 }}>
                                {isReadOnly ? "Tidak ada jadwal di semester ini." : "Anda belum memiliki jadwal aktif."}
                            </div>
                        ) : (
                            <div style={{ position: 'relative' }}>
                                <select 
                                    className={styles.filterInput} 
                                    style={{ appearance: 'none', cursor: 'pointer', paddingRight: '40px' }}
                                    value={selectedScheduleId}
                                    onChange={(e) => setSelectedScheduleId(e.target.value)}
                                >
                                    <option value="">-- Pilih Jadwal --</option>
                                    {schedules
                                        .filter((s: { semester: string; _id: string }) => s.semester === selectedSemester)
                                        .map(s => (
                                            <option key={s._id} value={s._id}>
                                                {s.region} — {s.level} (Pekan {s.activeWeek})
                                            </option>
                                        ))
                                    }
                                </select>
                                <svg style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Results */}
            {error && (
                <div style={{ textAlign: "center", padding: "2rem", color: "#c0392b", fontWeight: 600 }}>
                    {error}
                </div>
            )}
            
            {loading ? (
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    Mengambil data anak didik...
                </div>
            ) : result === null && schedules.length === 0 ? (
                <div className={styles.promptState}>
                    <div className={styles.stateIcon}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <p className={styles.stateTitle}>Belum ada jadwal aktif</p>
                    <p className={styles.stateDesc}>
                        Anda harus membuat jadwal mengajar terlebih dahulu agar daftar anak didik dapat ditampilkan.
                    </p>
                </div>
            ) : result !== null && (
                <>
                    {/* Results Header */}
                    <div className={styles.resultsHeader}>
                        <div className={styles.resultsLeft}>
                            <span className={styles.resultsTitle}>Daftar Murid</span>
                            <span className={styles.resultsBadge}>{result.total} murid</span>
                        </div>
                        <span className={styles.resultsContext}>
                            {result.region} · {result.level}
                        </span>
                    </div>

                    {result.total === 0 ? (
                        <div className={styles.promptState}>
                            <div className={styles.stateIcon}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                            </div>
                            <p className={styles.stateTitle}>Tidak ada murid ditemukan</p>
                            <p className={styles.stateDesc}>
                                Tidak ada anak didik terdaftar untuk wilayah <strong>{result.region}</strong> dengan jenjang <strong>{result.level}</strong>.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.tableWrap}>
                            {/* Inline search */}
                            <div className={styles.tableSearchRow}>
                                <input
                                    type="text"
                                    className={styles.tableSearchInput}
                                    placeholder="Cari nama murid atau orang tua dalam kelas ini..."
                                    value={tableSearch}
                                    onChange={(e) => setTableSearch(e.target.value)}
                                />
                            </div>

                            <table className={styles.table}>
                                <thead className={styles.tableHead}>
                                    <tr>
                                        <th>No.</th>
                                        <th>Nama Murid</th>
                                        <th>Wilayah</th>
                                        <th>Jenjang</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filtered.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "#bbb", fontSize: "13.5px" }}>
                                                {"Tidak ada murid yang cocok dengan \""}{tableSearch}{"\""}
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((student, i) => {
                                            return (
                                                <tr key={student._id} className={styles.tableRow}>
                                                    <td>{i + 1}</td>
                                                    <td>
                                                        <div className={styles.studentName}>{student.name}</div>
                                                        <div className={styles.parentName}>Ortu: {student.parentName}</div>
                                                    </td>
                                                    <td>
                                                        <span className={styles.regionText}>{student.region}</span>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={styles.categoryBadge}
                                                            style={{ 
                                                                background: (LEVEL_COLORS[student.category] || DEFAULT_COLOR).bg, 
                                                                color: (LEVEL_COLORS[student.category] || DEFAULT_COLOR).color 
                                                            }}
                                                        >
                                                            {student.category}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>

                            <div className={styles.tableFooter}>
                                <span className={styles.tableFooterInfo}>
                                    {tableSearch
                                        ? `${filtered.length} dari ${result.total} murid`
                                        : `Total ${result.total} murid`}
                                </span>
                                {levelColor && (
                                    <div className={styles.searchBadge}>
                                        <span
                                            className={styles.searchBadgeDot}
                                            style={{ background: levelColor.color }}
                                        />
                                        {result.region} · {result.level}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
