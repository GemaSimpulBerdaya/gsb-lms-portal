"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./schedule.module.css";
import Modal from "@/components/ui/Modal/Modal";

type Schedule = {
    _id: string;
    region: string;
    level: string;
    activeWeek: number;
    semester: string;
    updatedAt: string;
};

type ModuleItem = {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    week: number;
    fileUrl?: string;
    order: number;
};

type WeeksMap = Record<number, ModuleItem[]>;

const DEFAULT_LEVELS = [
    { value: "DISABILITAS", label: "Disabilitas", icon: "♿" },
    { value: "FASE PUCUK", label: "Fase Pucuk (TK)", icon: "🎒" },
    { value: "FASE A", label: "Fase A (SD 1-2)", icon: "📚" },
    { value: "FASE B", label: "Fase B (SD 3-4)", icon: "📚" },
    { value: "FASE C", label: "Fase C (SD 5-6)", icon: "📚" },
    { value: "FASE D", label: "Fase D (SMP)", icon: "🎓" },
    { value: "FASE E", label: "Fase E (SMA)", icon: "🎓" },
    { value: "SNBT", label: "SNBT", icon: "🚀" },
];

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

type Toast = { type: "success" | "error"; message: string } | null;

const getCurrentSemester = () => {
    const d = new Date();
    // Simple logic: Jan-Jun = Sem 2 of previous year or Sem 1? Usually Jan-Jun is Genap (Semester 2), Jul-Dec is Ganjil (Semester 1).
    // For simplicity, let's just default to current year Semester 1.
    return `${d.getFullYear()}-1`;
};

const EMPTY_FORM = { region: "", level: "FASE A" as Schedule["level"], activeWeek: 1, semester: getCurrentSemester() };

export default function SchedulePage() {
    const [mounted, setMounted] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [toast, setToast] = useState<Toast>(null);

    // Form
    const [formOpen, setFormOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [region, setRegion] = useState(EMPTY_FORM.region);
    const [level, setLevel] = useState<Schedule["level"]>(EMPTY_FORM.level);
    const [activeWeek, setActiveWeek] = useState(EMPTY_FORM.activeWeek);
    const [semester, setSemester] = useState(EMPTY_FORM.semester);

    // Student Data for Form Filtering
    // Dynamic Settings
    const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
    const [availableLevels, setAvailableLevels] = useState<{value: string, label: string, icon: string}[]>([]);
    const [availableRegions, setAvailableRegions] = useState<string[]>([]);

    // Filter
    const [selectedFilterSemester, setSelectedFilterSemester] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("activeSemester") || getCurrentSemester();
        }
        return getCurrentSemester();
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [filterLevel, setFilterLevel] = useState("ALL");

    useEffect(() => {
        if (typeof window !== "undefined") {
            localStorage.setItem("activeSemester", selectedFilterSemester);
        }
    }, [selectedFilterSemester]);

    // Modules
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [modulesCache, setModulesCache] = useState<Record<string, WeeksMap>>({});
    const [modulesLoadingLevel, setModulesLoadingLevel] = useState<string | null>(null);

    const showToast = (type: "success" | "error", message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchSchedules = useCallback(async () => {
        try {
            const res = await fetch("/api/volunteer/schedule");
            if (!res.ok) throw new Error();
            const data = await res.json();
            setSchedules(data.schedules ?? []);
        } catch {
            showToast("error", "Gagal memuat jadwal. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchGlobalSettings = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/settings");
            if (res.ok) {
                const data = await res.json();
                
                if (data.availableLevels) {
                    const mapped = data.availableLevels.map((lvl: string) => {
                        const found = DEFAULT_LEVELS.find(d => d.value === lvl);
                        return found || { value: lvl, label: lvl, icon: "📖" };
                    });
                    setAvailableLevels(mapped);
                }

                if (data.availableRegions) {
                    setAvailableRegions(data.availableRegions.sort());
                }
            }
        } catch (err) {
            console.error("Gagal memuat pengaturan global", err);
        }
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setMounted(true), 30);
        fetchSchedules();
        fetchGlobalSettings();
        return () => clearTimeout(t);
    }, [fetchSchedules, fetchGlobalSettings]);

    // Lock body scroll when modal open
    useEffect(() => {
        document.body.style.overflow = formOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [formOpen]);

    const fetchModules = useCallback(async (lvl: string) => {
        if (modulesCache[lvl]) return; // already cached
        setModulesLoadingLevel(lvl);
        try {
            const res = await fetch(`/api/volunteer/modules?level=${lvl}&semester=${selectedFilterSemester}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setModulesCache((prev) => ({ ...prev, [lvl]: data.weeks ?? {} }));
        } catch {
            setModulesCache((prev) => ({ ...prev, [lvl]: {} }));
        } finally {
            setModulesLoadingLevel(null);
        }
    }, [modulesCache, selectedFilterSemester]);

    const toggleSyllabus = (s: Schedule) => {
        if (selectedId === s._id) {
            setSelectedId(null);
            return;
        }
        setSelectedId(s._id);
        fetchModules(s.level);
    };

    // Form helpers
    const openAdd = () => {
        const currentRealSemester = getCurrentSemester();
        if (selectedFilterSemester !== currentRealSemester) {
            showToast("error", "Tidak dapat menambah jadwal di semester lampau. Silakan pindah ke semester aktif.");
            return;
        }

        setEditingId(null);
        setRegion(""); // Reset region
        // Set level to SD safely if SD is not available in the first region, it will be updated when user selects a region
        setLevel("SD");
        setActiveWeek(EMPTY_FORM.activeWeek);
        setSemester(selectedFilterSemester);
        setFormOpen(true);
    };

    const openEdit = (s: Schedule) => {
        const currentRealSemester = getCurrentSemester();
        if (s.semester !== currentRealSemester) {
            showToast("error", "Jadwal semester lampau tidak dapat diubah.");
            return;
        }
        setEditingId(s._id);
        setRegion(s.region);
        setLevel(s.level);
        setActiveWeek(s.activeWeek);
        setSemester(s.semester || "2024-1");
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!region.trim()) {
            showToast("error", "Wilayah wajib dipilih.");
            return;
        }

        setSaving(true);
        try {
            const isEdit = editingId !== null;
            const res = await fetch("/api/volunteer/schedule", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(
                    isEdit
                        ? { id: editingId, region: region.trim(), level, activeWeek, semester }
                        : { region: region.trim(), level, activeWeek, semester }
                ),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");

            if (isEdit) {
                setSchedules((prev) =>
                    prev.map((s) => (s._id === editingId ? data.schedule : s))
                );
                showToast("success", "Jadwal berhasil diperbarui.");
            } else {
                setSchedules((prev) => [data.schedule, ...prev]);
                showToast("success", "Jadwal berhasil ditambahkan.");
            }
            closeForm();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Gagal menyimpan jadwal.";
            showToast("error", msg);
        } finally {
            setSaving(false);
        }
    };

    const handleQuickUpdateWeek = async (s: Schedule, increment: number) => {
        const newWeek = Math.max(1, s.activeWeek + increment);
        if (newWeek === s.activeWeek) return;

        setSchedules((prev) =>
            prev.map((item) => (item._id === s._id ? { ...item, _isUpdating: true } : item))
        );

        try {
            const res = await fetch("/api/volunteer/schedule", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: s._id,
                    region: s.region,
                    level: s.level,
                    semester: s.semester,
                    activeWeek: newWeek
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setSchedules((prev) =>
                prev.map((item) => (item._id === s._id ? data.schedule : item))
            );
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Gagal update pekan.";
            showToast("error", msg);
            setSchedules((prev) =>
                prev.map((item) => (item._id === s._id ? { ...item, _isUpdating: false } : item))
            );
        }
    };

    const handleDelete = async (id: string) => {
        setDeletingId(id);
        try {
            const res = await fetch(`/api/volunteer/schedule?id=${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
            setSchedules((prev) => prev.filter((s) => s._id !== id));
            if (selectedId === id) setSelectedId(null);
            showToast("success", "Jadwal berhasil dihapus.");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Gagal menghapus jadwal.";
            showToast("error", msg);
        } finally {
            setDeletingId(null);
            setConfirmId(null);
        }
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

    const isEdited = editingId
        ? (() => {
              const orig = schedules.find((s) => s._id === editingId);
              return orig
                  ? region !== orig.region || level !== orig.level || activeWeek !== orig.activeWeek || semester !== orig.semester
                  : true;
          })()
        : region !== "" || level !== "SD" || activeWeek !== 1;

    const selectedSchedule = schedules.find((s) => s._id === selectedId) ?? null;
    const selectedWeeksMap = selectedSchedule ? (modulesCache[selectedSchedule.level] ?? null) : null;
    const isModulesLoading = selectedSchedule ? modulesLoadingLevel === selectedSchedule.level : false;
    const weekNumbers = selectedWeeksMap
        ? Object.keys(selectedWeeksMap).map(Number).filter((w) => w > 0).sort((a, b) => a - b)
        : [];

    const isDuplicate = schedules.some(s => 
        s.region === region.trim() && 
        s.level === level && 
        s.semester === semester &&
        s._id !== editingId
    );

    const formatSemester = (sem: string) => {
        if (!sem) return "-";
        const [year, term] = sem.split("-");
        return `Semester ${term} Tahun Ajaran ${year}/${parseInt(year)+1}`;
    };


    
    const filteredSchedules = schedules.filter(s => {
        const matchesSemester = s.semester === selectedFilterSemester;
        const matchesSearch = s.region.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLevel = filterLevel === "ALL" || s.level === filterLevel;
        return matchesSemester && matchesSearch && matchesLevel;
    });

    const isArchive = selectedFilterSemester !== getCurrentSemester();

    return (
        <div className={`${styles.mainEnter} ${mounted ? "" : ""}`}>
            {/* Hero */}
            <div className={styles.hero}>
                <span className={isArchive ? styles.heroLabelArchive : styles.heroLabel}>
                    {isArchive ? "ARSIP SEMESTER" : "Manajemen Jadwal"}
                </span>
                <h1 className={styles.heroTitle}>
                    {isArchive ? "Arsip Jadwal." : "Jadwal Mengajar."}
                </h1>
                <p className={styles.heroDesc}>
                    {isArchive ? (
                        <>Melihat kembali riwayat jadwal mengajar Anda di semester lampau. Data di halaman ini bersifat <strong>Read-Only</strong> (Arsip).</>
                    ) : (
                        <>
                            Atur wilayah, jenjang pendidikan, dan pekan aktif mengajar Anda.
                            Jadwal yang Anda buat akan otomatis tercatat untuk <strong>{formatSemester(getCurrentSemester())}</strong>.
                        </>
                    )}
                </p>
            </div>

            {/* Section Header */}
            <div className={styles.sectionHeader}>
                <div className={styles.sectionLeft}>
                    <span className={styles.sectionTitle}>Daftar Jadwal</span>
                    {!loading && (
                        <span className={styles.countBadge}>{filteredSchedules.length}</span>
                    )}
                </div>
                {!loading && !isArchive && (
                    <div className={styles.filterBar}>
                        <div className={styles.searchWrapper}>
                            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input 
                                type="text" 
                                placeholder="Cari wilayah..." 
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className={styles.selectWrapper}>
                            <select 
                                value={filterLevel} 
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className={styles.filterSelect}
                            >
                                <option value="ALL">Semua Jenjang</option>
                                {availableLevels.map(l => (
                                    <option key={l.value} value={l.value}>{l.label}</option>
                                ))}
                            </select>
                            <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>

                        <div className={styles.selectWrapper}>
                            <select 
                                value={selectedFilterSemester} 
                                onChange={(e) => {
                                    setSelectedFilterSemester(e.target.value);
                                    setSelectedId(null); 
                                    setModulesCache({}); // Clear cache for new semester
                                }}
                                className={styles.filterSelect}
                            >
                                {availableSemesters.map(sem => (
                                    <option key={sem} value={sem}>{formatSemester(sem)}</option>
                                ))}
                            </select>
                            <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>

                        <button className={styles.btnAdd} onClick={openAdd} type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="12" y1="5" x2="12" y2="19" />
                                <line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            Tambah
                        </button>
                    </div>
                )}
                
                {!loading && isArchive && (
                    <div className={styles.filterBar}>
                        <div className={styles.searchWrapper}>
                            <svg className={styles.searchIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input 
                                type="text" 
                                placeholder="Cari wilayah..." 
                                className={styles.searchInput}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className={styles.selectWrapper}>
                            <select 
                                value={filterLevel} 
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className={styles.filterSelect}
                            >
                                <option value="ALL">Semua Jenjang</option>
                                {availableLevels.map(l => (
                                    <option key={l.value} value={l.value}>{l.label}</option>
                                ))}
                            </select>
                            <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>

                        <div className={styles.selectWrapper}>
                            <select 
                                value={selectedFilterSemester} 
                                onChange={(e) => {
                                    setSelectedFilterSemester(e.target.value);
                                    setSelectedId(null); 
                                    setModulesCache({});
                                }}
                                className={styles.filterSelect}
                            >
                                {availableSemesters.map(sem => (
                                    <option key={sem} value={sem}>{formatSemester(sem)}</option>
                                ))}
                            </select>
                            <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>
                    </div>
                )}
            </div>

            {/* Cards */}
            {loading ? (
                <div className={styles.loadingState}>
                    <div className={styles.spinner} style={{ borderColor: "rgba(0,0,0,0.1)", borderTopColor: "#c0392b" }} />
                    Memuat jadwal...
                </div>
            ) : filteredSchedules.length === 0 && !formOpen ? (
                <div className={styles.emptyCard}>
                    <div className={styles.emptyIcon}>
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="4" width="18" height="18" rx="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                    </div>
                    <p className={styles.emptyTitle}>Belum ada jadwal</p>
                    <p className={styles.emptyDesc}>Tidak ada jadwal mengajar yang tersimpan untuk <strong>{formatSemester(selectedFilterSemester)}</strong>.</p>
                    {!isArchive && (
                        <button className={styles.btnAddEmpty} onClick={openAdd} type="button">
                            + Tambah Jadwal
                        </button>
                    )}
                </div>
            ) : (
                <div className={styles.cardsGrid}>
                    {filteredSchedules.map((s, i) => {
                        const color = LEVEL_COLORS[s.level];
                        const isConfirming = confirmId === s._id;
                        const isDeleting = deletingId === s._id;
                        const isSelected = selectedId === s._id;
                        return (
                            <div
                                key={s._id}
                                className={`${styles.scheduleCard} ${styles.cardAnim} ${isSelected ? styles.scheduleCardSelected : ""}`}
                                style={{ animationDelay: `${i * 60}ms` }}
                            >
                                <div className={styles.cardTop}>
                                    <span className={styles.levelTag} style={{ 
                                        background: (LEVEL_COLORS[s.level] || {bg: '#f3f4f6', color: '#374151'}).bg, 
                                        color: (LEVEL_COLORS[s.level] || {bg: '#f3f4f6', color: '#374151'}).color 
                                    }}>
                                        {s.level}
                                    </span>
                                    <div className={styles.cardActions}>
                                        {s.semester === getCurrentSemester() && (
                                            isConfirming ? (
                                                <div className={styles.confirmRow}>
                                                    <span className={styles.confirmText}>Hapus?</span>
                                                    <button className={styles.confirmYes} onClick={() => handleDelete(s._id)} disabled={isDeleting} type="button">
                                                        {isDeleting ? "..." : "Ya"}
                                                    </button>
                                                    <button className={styles.confirmNo} onClick={() => setConfirmId(null)} disabled={isDeleting} type="button">
                                                        Batal
                                                    </button>
                                                </div>
                                            ) : (
                                                <>
                                                    <button className={styles.actionBtn} onClick={() => openEdit(s)} title="Edit jadwal" type="button">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button className={`${styles.actionBtn} ${styles.actionBtnDanger}`} onClick={() => setConfirmId(s._id)} title="Hapus jadwal" type="button">
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            <path d="M10 11v6M14 11v6" />
                                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )
                                        )}
                                        {s.semester !== getCurrentSemester() && (
                                            <span style={{ fontSize: '11px', color: '#888', fontWeight: 600, background: '#f0f0f0', padding: '4px 8px', borderRadius: '6px' }}>Arsip</span>
                                        )}
                                    </div>
                                </div>

                                <div className={styles.cardRegion}>{s.region}</div>

                                <div className={styles.cardMeta}>
                                    <div className={styles.weekControl}>
                                        {s.semester === getCurrentSemester() && (
                                            <button 
                                                className={styles.btnQuickWeek} 
                                                onClick={(e) => { e.stopPropagation(); handleQuickUpdateWeek(s, -1); }}
                                                disabled={(s as any)._isUpdating || s.activeWeek <= 1}
                                                title="Kembali ke pekan sebelumnya"
                                            >
                                                {(s as any)._isUpdating ? (
                                                    <span className={styles.miniSpinner} />
                                                ) : (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                )}
                                            </button>
                                        )}
                                        <span className={styles.cardMetaItem}>Pekan {s.activeWeek}</span>
                                        {s.semester === getCurrentSemester() && (
                                            <button 
                                                className={styles.btnQuickWeek} 
                                                onClick={(e) => { e.stopPropagation(); handleQuickUpdateWeek(s, 1); }}
                                                disabled={(s as any)._isUpdating}
                                                title="Naik ke pekan selanjutnya"
                                            >
                                                {(s as any)._isUpdating ? (
                                                    <span className={styles.miniSpinner} />
                                                ) : (
                                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                                                )}
                                            </button>
                                        )}
                                    </div>
                                    <span className={styles.cardMetaDot}>·</span>
                                    <span className={styles.cardMetaItem}>{s.semester}</span>
                                    <span className={styles.cardMetaDot}>·</span>
                                    <span className={styles.cardMetaDate}>{formatDate(s.updatedAt)}</span>
                                </div>

                                {/* Syllabus toggle */}
                                <button
                                    className={`${styles.btnSyllabus} ${isSelected ? styles.btnSyllabusActive : ""}`}
                                    onClick={() => toggleSyllabus(s)}
                                    type="button"
                                >
                                    {isSelected ? (
                                        <>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="18 15 12 9 6 15" />
                                            </svg>
                                            Tutup Silabus
                                        </>
                                    ) : (
                                        <>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                            </svg>
                                            Lihat Silabus
                                        </>
                                    )}
                                </button>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Syllabus / Module Panel */}
            {selectedSchedule && (
                <div className={styles.modulePanel}>
                    <div className={styles.modulePanelHeader}>
                        <div className={styles.modulePanelLeft}>
                            <span
                                className={styles.modulePanelBadge}
                                style={{
                                    background: (LEVEL_COLORS[selectedSchedule.level] || {bg: '#f3f4f6', color: '#374151'}).bg,
                                    color: (LEVEL_COLORS[selectedSchedule.level] || {bg: '#f3f4f6', color: '#374151'}).color,
                                }}
                            >
                                {availableLevels.find((l) => l.value === selectedSchedule.level)?.icon || "📖"}{" "}
                                {selectedSchedule.level}
                            </span>
                            <div>
                                <p className={styles.modulePanelTitle}>Silabus & Modul — {selectedSchedule.region}</p>
                                <p className={styles.modulePanelDesc}>Pekan aktif: Pekan {selectedSchedule.activeWeek}</p>
                            </div>
                        </div>
                        <button className={styles.btnClose} onClick={() => setSelectedId(null)} type="button">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    </div>

                    {isModulesLoading ? (
                        <div className={styles.loadingState}>
                            <div className={styles.spinner} style={{ borderColor: "rgba(0,0,0,0.1)", borderTopColor: "#c0392b" }} />
                            Memuat modul...
                        </div>
                    ) : weekNumbers.length === 0 ? (
                        <div className={styles.emptyModules}>
                            <div className={styles.emptyIcon}>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                </svg>
                            </div>
                            <p className={styles.emptyTitle}>Modul belum tersedia</p>
                            <p className={styles.emptyDesc}>
                                Admin belum menambahkan modul untuk jenjang {selectedSchedule.level}. Cek kembali nanti.
                            </p>
                        </div>
                    ) : (
                        <div className={styles.weekGroups}>
                            {weekNumbers.map((week) => {
                                const modules = selectedWeeksMap![week] ?? [];
                                const isActive = week === selectedSchedule.activeWeek;
                                return (
                                    <div key={week} className={`${styles.weekGroup} ${isActive ? styles.weekGroupActive : ""}`}>
                                        <div className={styles.weekGroupHeader}>
                                            <div className={styles.weekGroupLeft}>
                                                <span className={styles.weekGroupNumber}>Pekan {week}</span>
                                                {isActive && (
                                                    <span className={styles.weekActiveBadge}>Pekan Ini</span>
                                                )}
                                            </div>
                                            <span className={styles.weekModuleCount}>{modules.length} modul</span>
                                        </div>

                                        <div className={styles.modulesList}>
                                            {modules.map((mod) => (
                                                <div key={mod._id} className={styles.moduleItem}>
                                                    <div className={styles.moduleInfo}>
                                                        <span className={styles.moduleTitle}>{mod.title}</span>
                                                        {mod.description && (
                                                            <span className={styles.moduleDesc}>{mod.description}</span>
                                                        )}
                                                    </div>
                                                    {mod.fileUrl ? (
                                                        <a
                                                            href={mod.fileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={styles.btnDownload}
                                                            download
                                                        >
                                                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                                                <polyline points="7 10 12 15 17 10" />
                                                                <line x1="12" y1="15" x2="12" y2="3" />
                                                            </svg>
                                                            Unduh
                                                        </a>
                                                    ) : (
                                                        <span className={styles.btnDownloadDisabled}>Belum ada file</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Add / Edit Form Modal */}
            <Modal
                isOpen={formOpen}
                onClose={closeForm}
                title={editingId ? "Edit Jadwal" : "Tambah Jadwal Baru"}
                footer={
                    <>
                        <button className={styles.btnReset} onClick={closeForm} disabled={saving}>Batal</button>
                        <button 
                            className={styles.btnSave} 
                            onClick={handleSave} 
                            disabled={saving || !isEdited || !region || isDuplicate}
                            style={{ margin: 0 }}
                        >
                            {saving ? (
                                <>
                                    <span className={styles.spinner} />
                                    Menyimpan...
                                </>
                            ) : (
                                <>
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                                        <polyline points="17 21 17 13 7 13 7 21" />
                                        <polyline points="7 3 7 8 15 8" />
                                    </svg>
                                    {editingId ? "Simpan Perubahan" : "Tambah Jadwal"}
                                </>
                            )}
                        </button>
                    </>
                }
            >
                <div className={styles.formGrid}>
                    <div className={`${styles.formField} ${styles.formFieldFull}`}>
                        <label className={styles.formLabel}>Wilayah</label>
                        {availableRegions.length === 0 ? (
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="Tidak ada data wilayah..."
                                value={region}
                                disabled
                            />
                        ) : (
                            <div style={{ position: 'relative' }}>
                                <select
                                    className={styles.formInput}
                                    style={{ appearance: 'none', cursor: 'pointer', paddingRight: '40px' }}
                                    value={region}
                                    onChange={(e) => setRegion(e.target.value)}
                                >
                                    <option value="" disabled>Pilih Wilayah...</option>
                                    {availableRegions.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>
                                <svg style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9" /></svg>
                            </div>
                        )}
                    </div>
                    <div className={`${styles.formField} ${styles.formFieldFull}`}>
                        <label className={styles.formLabel}>Jenjang Pendidikan</label>
                        <div className={styles.levelPicker}>
                            {availableLevels.map((l) => (
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
                            {region && availableRegions[region] && availableRegions[region].length === 0 && (
                                <span style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Tidak ada jenjang terdaftar.</span>
                            )}
                        </div>
                    </div>
                    <div className={styles.formField}>
                        <label className={styles.formLabel}>Pekan Aktif</label>
                        <div className={styles.weekStepper}>
                            <button className={styles.weekBtn} onClick={() => setActiveWeek((w) => Math.max(1, w - 1))} disabled={activeWeek <= 1} type="button">−</button>
                            <div className={styles.weekDisplay}>
                                <span className={styles.weekNum}>{activeWeek}</span>
                                <span className={styles.weekUnit}>pekan</span>
                            </div>
                            <button className={styles.weekBtn} onClick={() => setActiveWeek((w) => w + 1)} type="button">+</button>
                        </div>
                    </div>
                    <div className={styles.formField}>
                        <label className={styles.formLabel}>Periode Semester</label>
                        <div 
                            className={styles.formInput} 
                            style={{ background: '#f5f5f5', color: '#888', cursor: 'not-allowed', display: 'flex', alignItems: 'center' }}
                        >
                            {formatSemester(semester)}
                        </div>
                    </div>
                </div>

                {isDuplicate && (
                    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(192, 57, 43, 0.08)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#c0392b', fontSize: '12.5px', fontWeight: 600 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Kombinasi wilayah & jenjang ini sudah terdaftar di semester ini.
                    </div>
                )}
            </Modal>

            {/* Toast */}
            {toast && (
                <div className={styles.toastWrapper}>
                    <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : styles.toastSuccess}`}>
                        {toast.type === "success" ? (
                            <svg className={styles.toastIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        ) : (
                            <svg className={styles.toastIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                            </svg>
                        )}
                        {toast.message}
                    </div>
                </div>
            )}
        </div>
    );
}
