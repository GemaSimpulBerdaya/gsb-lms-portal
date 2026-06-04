"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./student.module.css";
import { getCurrentSemester, formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import AdminPagination from "@/components/admin/ui/AdminPagination";

type Student = {
    _id: string;
    name: string;
    region: string;
    fase: string;
    parentName: string;
};

type Schedule = {
    _id: string;
    region: string;
    fase: string;
    semester: string;
    activeWeek: number;
};

type SearchResult = {
    total: number;
    region: string;
    fase: string;
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
    const semesterLabels = useSemesterLabels();
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [result, setResult] = useState<SearchResult>(null);
    const [error, setError] = useState("");
    const [tableSearch, setTableSearch] = useState("");

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
                    setSelectedScheduleId(targetSched._id);
                    // Tetap initialLoading=true; fetchStudents yang akan flip ke false biar transisi mulus.
                    return;
                }
                setSelectedScheduleId("");
            }
            // Sampai sini berarti gak ada jadwal aktif — aman matikan initial loading.
            setInitialLoading(false);
        } catch (err) {
            console.error("Gagal memuat jadwal", err);
            setInitialLoading(false);
        }
    }, [selectedSemester, selectedScheduleId]);

    // Fetch Schedules on mount or semester change
    useEffect(() => {
        fetchSchedules();
    }, [fetchSchedules]);
    
    const availableSemesters = Array.from(new Set([...schedules.map(s => s.semester), getCurrentSemester()])).sort().reverse();

    // 1b. Sync schedule with selected semester
    useEffect(() => {
        if (selectedScheduleId && schedules.length > 0) {
            const currentSched = schedules.find(s => s._id === selectedScheduleId);
            if (currentSched && currentSched.semester !== selectedSemester) {
                setSelectedScheduleId("");
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
            const params = new URLSearchParams({ region: sched.region, fase: sched.fase });
            const res = await fetch(`/api/volunteer/students?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
            setResult(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Gagal mengambil data.");
        } finally {
            setLoading(false);
            setInitialLoading(false);
        }
    }, [selectedScheduleId, schedules]);

    // Automatically fetch students when selected schedule changes
    useEffect(() => {
        if (selectedScheduleId) {
            fetchStudents();
        }
    }, [selectedScheduleId, fetchStudents]);

    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const filtered = result?.students.filter((s) =>
        s.name.toLowerCase().includes(tableSearch.toLowerCase())
    ) ?? [];
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        setCurrentPage(1);
    }, [tableSearch, selectedScheduleId]);

    const levelColor = result ? (LEVEL_COLORS[result.fase] || DEFAULT_COLOR) : null;

    // Avatar color from name hash (consistent across renders)
    const AVATAR_COLORS = ["#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
    const colorFor = (name: string) => {
        let h = 0;
        for (let i = 0; i < name.length; i++) h = (h << 5) - h + name.charCodeAt(i);
        return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
    };
    const initials = (name: string) =>
        name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();

    return (
        <div className={styles.page}>
            {/* Hero */}
            <div className={styles.hero}>
                <span className={styles.heroLabel}>Manajemen Data Siswa</span>
                <h1 className={styles.heroTitle}>Data Murid.</h1>
                <p className={styles.heroDesc}>
                    Daftar siswa ini dimuat otomatis berdasarkan Jadwal Mengajar Anda yang sedang aktif.
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
                    {availableSemesters.length > 1 && (
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
                                        <option key={sem} value={sem}>{formatSemester(sem, semesterLabels)}</option>
                                    ))}
                                </select>
                                <svg style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                            </div>
                        </div>
                    )}

                    <div className={styles.filterField}>
                        <label className={styles.filterLabel}>Pilih Jadwal Anda</label>
                        {initialLoading ? (
                            <div style={{ padding: '12px 16px', background: '#f8fafc', color: '#64748b', borderRadius: '12px', fontSize: '13.5px', fontWeight: 500 }}>
                                Memuat jadwal...
                            </div>
                        ) : schedules.length === 0 ? (
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
                                                {s.region} — {s.fase} (Pekan {s.activeWeek})
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
            
            {loading || initialLoading ? (
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    {initialLoading ? "Memuat jadwal..." : "Mengambil data siswa..."}
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
                        Anda harus membuat jadwal mengajar terlebih dahulu agar daftar siswa dapat ditampilkan.
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
                            {result.region} · {result.fase}
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
                                Tidak ada siswa terdaftar untuk wilayah <strong>{result.region}</strong> dengan jenjang <strong>{result.fase}</strong>.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.tableWrap}>
                            {/* Inline search */}
                            <div className={styles.tableSearchRow}>
                                <input
                                    type="text"
                                    className={styles.tableSearchInput}
                                    placeholder="Cari nama murid dalam kelas ini..."
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
                                        <th>Fase</th>
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
                                        paginated.map((student, i) => {
                                            return (
                                                <tr key={student._id} className={styles.tableRow}>
                                                    <td>{(safePage - 1) * pageSize + i + 1}</td>
                                                    <td>
                                                        <div className={styles.studentCell}>
                                                            <div
                                                                className={styles.avatar}
                                                                style={{ background: colorFor(student.name) }}
                                                            >
                                                                {initials(student.name)}
                                                            </div>
                                                            <div>
                                                                <div className={styles.studentName}>{student.name}</div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td>
                                                        <span className={styles.regionText}>{student.region}</span>
                                                    </td>
                                                    <td>
                                                        <span
                                                            className={styles.categoryBadge}
                                                            style={{ 
                                                                color: (LEVEL_COLORS[student.fase] || DEFAULT_COLOR).color 
                                                            }}
                                                        >
                                                            {student.fase}
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
                                    {filtered.length === 0 ? "Tidak ada data" : `${filtered.length} murid ditemukan`}
                                </span>

                                <AdminPagination
                                    page={safePage}
                                    totalItems={filtered.length}
                                    itemsPerPage={pageSize}
                                    onPageChange={setCurrentPage}
                                />

                                {levelColor && (
                                    <div className={styles.searchBadge}>
                                        <span
                                            className={styles.searchBadgeDot}
                                            style={{ background: levelColor.color }}
                                        />
                                        {result.region} · {result.fase}
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
