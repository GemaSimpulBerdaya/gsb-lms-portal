"use client";

import { useState } from "react";
import styles from "./student.module.css";

type Student = {
    _id: string;
    name: string;
    region: string;
    category: "DISABILITAS" | "TK" | "SD" | "SMP";
    parentName: string;
};

type SearchResult = {
    total: number;
    region: string;
    level: string;
    students: Student[];
} | null;

const LEVELS = [
    { value: "DISABILITAS", label: "Disabilitas", icon: "♿" },
    { value: "TK",          label: "TK",          icon: "🎒" },
    { value: "SD",          label: "SD",          icon: "📚" },
    { value: "SMP",         label: "SMP",         icon: "🎓" },
] as const;

const LEVEL_COLORS: Record<Student["category"], { bg: string; color: string }> = {
    DISABILITAS: { bg: "#ede9fe", color: "#7c3aed" },
    TK:          { bg: "#dcfce7", color: "#16a34a" },
    SD:          { bg: "#dbeafe", color: "#1d4ed8" },
    SMP:         { bg: "#ffedd5", color: "#c2410c" },
};

export default function StudentPage() {
    const [region, setRegion] = useState("");
    const [level, setLevel] = useState<Student["category"]>("SD");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<SearchResult>(null);
    const [error, setError] = useState("");
    const [tableSearch, setTableSearch] = useState("");

    const handleSearch = async () => {
        if (!region.trim()) {
            setError("Wilayah wajib diisi.");
            return;
        }
        setError("");
        setLoading(true);
        setResult(null);
        setTableSearch("");

        try {
            const params = new URLSearchParams({ region: region.trim(), level });
            const res = await fetch(`/api/volunteer/students?${params}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
            setResult(data);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Gagal mengambil data.");
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSearch();
    };

    const filtered = result?.students.filter((s) =>
        s.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
        s.parentName.toLowerCase().includes(tableSearch.toLowerCase())
    ) ?? [];

    const levelColor = result ? LEVEL_COLORS[result.level as Student["category"]] : null;

    return (
        <div className={styles.page}>
            {/* Hero */}
            <div className={styles.hero}>
                <span className={styles.heroLabel}>Manajemen Anak Didik</span>
                <h1 className={styles.heroTitle}>Data Murid.</h1>
                <p className={styles.heroDesc}>
                    Cari daftar anak didik berdasarkan wilayah dan jenjang pendidikan yang Anda ajar.
                </p>
            </div>

            {/* Filter Card */}
            <div className={styles.filterCard}>
                <p className={styles.filterCardTitle}>Filter Pencarian</p>

                <div className={styles.filterGrid}>
                    {/* Region */}
                    <div className={styles.filterField}>
                        <label className={styles.filterLabel}>Wilayah / Daerah</label>
                        <input
                            type="text"
                            className={styles.filterInput}
                            placeholder="Contoh: Jakarta Selatan, Bandung..."
                            value={region}
                            onChange={(e) => { setRegion(e.target.value); setError(""); }}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {/* Level */}
                    <div className={styles.filterField}>
                        <label className={styles.filterLabel}>Jenjang Pendidikan</label>
                        <div className={styles.levelPicker}>
                            {LEVELS.map((l) => (
                                <label key={l.value} className={styles.levelOption}>
                                    <input
                                        type="radio"
                                        name="level"
                                        value={l.value}
                                        checked={level === l.value}
                                        onChange={() => setLevel(l.value)}
                                    />
                                    <span className={styles.levelOptionLabel}>
                                        <span className={styles.levelIcon}>{l.icon}</span>
                                        <span className={styles.levelName}>{l.label}</span>
                                    </span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                <div className={styles.filterFooter}>
                    <span className={styles.filterHint}>
                        {error ? (
                            <span style={{ color: "#c0392b", fontWeight: 600 }}>{error}</span>
                        ) : (
                            "Isi wilayah lalu klik Cari Data"
                        )}
                    </span>
                    <button
                        className={styles.btnSearch}
                        onClick={handleSearch}
                        disabled={loading}
                        type="button"
                    >
                        {loading ? (
                            <>
                                <span className={styles.spinner} style={{ borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                                Mencari...
                            </>
                        ) : (
                            <>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="11" cy="11" r="8" />
                                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                                </svg>
                                Cari Data
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Results */}
            {loading ? (
                <div className={styles.loadingState}>
                    <div className={styles.spinner} />
                    Mengambil data anak didik...
                </div>
            ) : result === null ? (
                <div className={styles.promptState}>
                    <div className={styles.stateIcon}>
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                    </div>
                    <p className={styles.stateTitle}>Belum ada pencarian</p>
                    <p className={styles.stateDesc}>
                        Masukkan wilayah dan pilih jenjang pendidikan, lalu klik <strong>Cari Data</strong> untuk melihat daftar anak didik.
                    </p>
                </div>
            ) : (
                <>
                    {/* Results Header */}
                    <div className={styles.resultsHeader}>
                        <div className={styles.resultsLeft}>
                            <span className={styles.resultsTitle}>Hasil Pencarian</span>
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
                                    placeholder="Cari nama murid atau orang tua dalam hasil ini..."
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
                                                Tidak ada murid yang cocok dengan &quot;{tableSearch}&quot;
                                            </td>
                                        </tr>
                                    ) : (
                                        filtered.map((student, i) => {
                                            const color = LEVEL_COLORS[student.category];
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
                                                            style={{ background: color.bg, color: color.color }}
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
