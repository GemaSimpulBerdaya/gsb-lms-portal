"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./schedule.module.css";
import Modal from "@/components/ui/Modal/Modal";
import { getCurrentSemester, formatSemester, dateToIso } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import MeetingsGenerator, { KbmDate } from "./_components/MeetingsGenerator";
import RescheduleModal from "./_components/RescheduleModal";

type CompletionEntry = {
    attendance: boolean;
    grades: boolean;
    documentation: boolean;
    attendanceCount?: number;
    gradesCount?: number;
    documentationCount?: number;
};

type Schedule = {
    _id: string;
    region: string;
    fase: string;
    activeWeek: number;
    semester: string;
    updatedAt: string;
    kbmDates?: {
        week: number;
        date: string;
        topic?: string;
        originalDate?: string;
        rescheduleReason?: string;
        rescheduledAt?: string;
    }[];
    completionByWeek?: Record<number, CompletionEntry>;
};

// Status pertemuan: lewat / minggu ini / akan datang.
// "current" = pertemuan jatuh di minggu yang sama dengan hari ini (Senin-Minggu).
// Bukan exact-day match supaya volunteer bisa siap-siap dari awal minggu.
function getMeetingStatus(iso: string): "past" | "current" | "future" {
    const target = new Date(iso);
    target.setHours(0, 0, 0, 0);
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    // Hitung Senin minggu ini
    const day = now.getDay(); // 0 Min, 1 Sen, ..., 6 Sab
    const offsetToMon = day === 0 ? -6 : 1 - day;
    const mon = new Date(now);
    mon.setDate(mon.getDate() + offsetToMon);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);

    if (target < mon) return "past";
    if (target > sun) return "future";
    return "current";
}

/**
 * Derive completion status enum dari raw CompletionEntry.
 * - "complete": semua 3 aktivitas done
 * - "partial": minimal 1 done, gak semua
 * - "empty": semua belum
 * - "n/a": pertemuan masa depan, gak relevan
 */
function getCompletionStatus(
    completion: CompletionEntry | undefined,
    meetingStatus: "past" | "current" | "future"
): "complete" | "partial" | "empty" | "n/a" {
    if (meetingStatus === "future") return "n/a";
    if (!completion) return "empty";
    const filled = [completion.attendance, completion.grades, completion.documentation].filter(Boolean).length;
    if (filled === 3) return "complete";
    if (filled === 0) return "empty";
    return "partial";
}

function fmtDateShort(iso: string): { date: string; day: string } {
    const d = new Date(iso);
    return {
        date: d.toLocaleDateString("id-ID", {
            day: "numeric",
            month: "short",
            year: "numeric",
        }),
        day: d.toLocaleDateString("id-ID", { weekday: "short" }),
    };
}

type ModuleItem = {
    _id: string;
    title: string;
    slug: string;
    description?: string;
    subCategory?: string;
    subject?: string;
    learningLocation?: string;
    week: number;
    fileUrl?: string;
    order: number;
};

type WeeksMap = Record<number, ModuleItem[]>;

const DEFAULT_LEVELS = [
    { value: "FASE PELITA", label: "Fase Pelita (Disabilitas)", icon: "♿" },
    { value: "FASE TUNAS & PUCUK", label: "Fase Tunas & Pucuk (PAUD)", icon: "🎒" },
    { value: "FASE A", label: "Fase A (SD 1-2)", icon: "📚" },
    { value: "FASE B", label: "Fase B (SD 3-4)", icon: "📚" },
    { value: "FASE C", label: "Fase C (SD 5-6)", icon: "📚" },
    { value: "FASE D", label: "Fase D (SMP)", icon: "🎓" },
    { value: "FASE E", label: "Fase E (SMA)", icon: "🎓" },
    { value: "SNBT", label: "SNBT", icon: "🚀" },
];

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
    "FASE PELITA": { bg: "#ede9fe", color: "#7c3aed" },
    "FASE TUNAS & PUCUK": { bg: "#dcfce7", color: "#16a34a" },
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

function getModuleCacheKey(region: string, fase: string) {
    return `${region.trim().toLowerCase()}|${fase.trim().toLowerCase()}`;
}

type Toast = { type: "success" | "error"; message: string } | null;

const EMPTY_FORM = { region: "", fase: "FASE A" as Schedule["fase"], semester: getCurrentSemester() };

export default function SchedulePage() {
    const semesterLabels = useSemesterLabels();
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
    const [fase, setLevel] = useState<Schedule["fase"]>(EMPTY_FORM.fase);
    const [semester, setSemester] = useState(EMPTY_FORM.semester);
    const [kbmDates, setKbmDates] = useState<KbmDate[]>([]);

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

    // Reschedule modal
    const [rescheduleTarget, setRescheduleTarget] = useState<{
        scheduleId: string;
        week: number;
        oldDate: string;
        topic?: string;
    } | null>(null);

    // Module syllabus toggle (inline)
    const [syllabusOpenId, setSyllabusOpenId] = useState<string | null>(null);
    /** Track which silabus modal should auto-scroll to a specific week. */
    const [syllabusOpenWeek, setSyllabusOpenWeek] = useState<number | null>(null);
    void syllabusOpenWeek;

    /** Track which timeline item is expanded for action panel. Keyed by `${scheduleId}:${week}`. */
    const [expandedMeeting, setExpandedMeeting] = useState<string | null>(null);

    /** Track which timeline sections (past/future) are expanded per schedule. Keyed by `${scheduleId}:${section}`. */
    const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
    const toggleSection = useCallback((scheduleId: string, section: "past" | "future") => {
        const key = `${scheduleId}:${section}`;
        setExpandedSections((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    const showToast = useCallback((type: "success" | "error", message: string) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 3500);
    }, []);

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
    }, [showToast]);

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

                if (data.availableSemesters) {
                    setAvailableSemesters(data.availableSemesters);
                }
            }
        } catch (err) {
            console.error("Gagal memuat pengaturan global", err);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
            fetchSchedules();
            fetchGlobalSettings();
        }, 30);
        return () => clearTimeout(timer);
    }, [fetchSchedules, fetchGlobalSettings]);

    // Refetch schedules saat user balik ke tab/page (browser back, alt-tab, dll).
    // Ini bikin completionByWeek selalu fresh setelah isi presensi/penilaian/laporan
    // di page lain dan navigate balik ke /schedule.
    useEffect(() => {
        const handleFocus = () => {
            if (document.visibilityState === "visible") {
                fetchSchedules();
            }
        };
        document.addEventListener("visibilitychange", handleFocus);
        window.addEventListener("focus", handleFocus);
        return () => {
            document.removeEventListener("visibilitychange", handleFocus);
            window.removeEventListener("focus", handleFocus);
        };
    }, [fetchSchedules]);

    useEffect(() => {
        document.body.style.overflow = formOpen ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [formOpen]);

    const fetchModules = useCallback(async (fase: string, region: string) => {
        const cacheKey = getModuleCacheKey(region, fase);
        if (modulesCache[cacheKey]) return; // already cached
        setModulesLoadingLevel(cacheKey);
        try {
            const params = new URLSearchParams({
                fase,
                region,
                semester: selectedFilterSemester,
            });
            const res = await fetch(`/api/volunteer/modules?${params.toString()}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setModulesCache((prev) => ({ ...prev, [cacheKey]: data.weeks ?? {} }));
        } catch {
            setModulesCache((prev) => ({ ...prev, [cacheKey]: {} }));
        } finally {
            setModulesLoadingLevel(null);
        }
    }, [modulesCache, selectedFilterSemester]);



    // Form helpers
    const openAdd = () => {
        const currentRealSemester = getCurrentSemester();
        if (selectedFilterSemester !== currentRealSemester) {
            showToast("error", "Tidak dapat menambah jadwal di semester lampau. Silakan pindah ke semester aktif.");
            return;
        }

        setEditingId(null);
        setRegion(""); // Reset lokasi belajar
        setLevel("FASE A");
        setSemester(selectedFilterSemester);
        setKbmDates([]);
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
        setLevel(s.fase);
        setSemester(s.semester || "2026-1");
        setKbmDates(
            (s.kbmDates ?? []).map((k) => ({
                week: k.week,
                date: k.date.slice(0, 10), // ISO yyyy-mm-dd
                topic: k.topic ?? "",
            }))
        );
        setFormOpen(true);
    };

    const closeForm = () => {
        setFormOpen(false);
        setEditingId(null);
    };

    const handleSave = async () => {
        if (!region.trim()) {
            showToast("error", "Lokasi Belajar wajib dipilih.");
            return;
        }

        setSaving(true);
        try {
            const isEdit = editingId !== null;
            const payload: Record<string, unknown> = {
                region: region.trim(),
                fase,
                semester,
                kbmDates: kbmDates.map((k) => ({
                    week: k.week,
                    date: k.date,
                    topic: k.topic ?? "",
                })),
            };
            if (isEdit) payload.id = editingId;

            const res = await fetch("/api/volunteer/schedule", {
                method: isEdit ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
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



    const isEdited = editingId
        ? (() => {
              const orig = schedules.find((s) => s._id === editingId);
              if (!orig) return true;
              if (region !== orig.region || fase !== orig.fase || semester !== orig.semester) return true;
              const origKbm = orig.kbmDates ?? [];
              if (kbmDates.length !== origKbm.length) return true;
              return kbmDates.some((k, i) => {
                  const o = origKbm[i];
                  return !o || o.date.slice(0, 10) !== k.date || (o.topic || "") !== (k.topic || "");
              });
          })()
        : region !== "" || kbmDates.length > 0;

    const isDuplicate = schedules.some(s => 
        s.region === region.trim() && 
        s.fase === fase && 
        s.semester === semester &&
        s._id !== editingId
    );

    
    const filteredSchedules = schedules.filter(s => {
        const matchesSemester = s.semester === selectedFilterSemester;
        const matchesSearch = s.region.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesLevel = filterLevel === "ALL" || s.fase === filterLevel;
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
                            Atur lokasi belajar, jenjang pendidikan, dan pekan aktif mengajar Anda.
                            Jadwal yang Anda buat akan otomatis tercatat untuk <strong>{formatSemester(getCurrentSemester(), semesterLabels)}</strong>.
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
                                placeholder="Cari lokasi belajar..." 
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

                        {availableSemesters.length > 1 && (
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
                                        <option key={sem} value={sem}>{formatSemester(sem, semesterLabels)}</option>
                                    ))}
                                </select>
                                <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                            </div>
                        )}

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
                                placeholder="Cari lokasi belajar..." 
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

                        {availableSemesters.length > 1 && (
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
                                        <option key={sem} value={sem}>{formatSemester(sem, semesterLabels)}</option>
                                    ))}
                                </select>
                                <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                            </div>
                        )}
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
                    <p className={styles.emptyDesc}>Tidak ada jadwal mengajar yang tersimpan untuk <strong>{formatSemester(selectedFilterSemester, semesterLabels)}</strong>.</p>
                    {!isArchive && (
                        <button className={styles.btnAddEmpty} onClick={openAdd} type="button">
                            + Tambah Jadwal
                        </button>
                    )}
                </div>
            ) : (
                <div className={styles.scheduleList}>
                    {filteredSchedules.map((s) => {
                        const isConfirming = confirmId === s._id;
                        const isDeleting = deletingId === s._id;
                        const isExpanded = selectedId === s._id;
                        const isCurrent = s.semester === getCurrentSemester();

                        const sortedKbm = [...(s.kbmDates ?? [])].sort(
                            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
                        );
                        const totalMeetings = sortedKbm.length;

                        // Pertemuan minggu ini (kalau ada di kbmDates)
                        const currentMeeting = sortedKbm.find(
                            (k) => getMeetingStatus(k.date) === "current"
                        );
                        // Pertemuan berikutnya (future, paling dekat)
                        const nextMeeting = sortedKbm.find(
                            (k) => getMeetingStatus(k.date) === "future"
                        );

                        return (
                            <div
                                key={s._id}
                                className={`${styles.scheduleRow} ${isExpanded ? styles.scheduleRowExpanded : ""}`}
                            >
                                <div
                                    className={styles.rowHeader}
                                    onClick={() => {
                                        setSelectedId(isExpanded ? null : s._id);
                                        setSyllabusOpenId(null);
                                    }}
                                >
                                    <div className={styles.rowHeaderLeft}>
                                        <div className={styles.rowTitle}>
                                            <span className={styles.rowRegion}>{s.region}</span>
                                            <span
                                                className={styles.rowLevelTag}
                                                style={{
                                                    background: (LEVEL_COLORS[s.fase] || { bg: "#f3f4f6", color: "#374151" }).bg,
                                                    color: (LEVEL_COLORS[s.fase] || { bg: "#f3f4f6", color: "#374151" }).color,
                                                }}
                                            >
                                                {s.fase}
                                            </span>
                                            {!isCurrent && (
                                                <span style={{ fontSize: "11px", color: "#888", fontWeight: 600, background: "#f0f0f0", padding: "3px 8px", borderRadius: "5px" }}>
                                                    Arsip
                                                </span>
                                            )}
                                        </div>
                                        <div className={styles.rowSubtitle}>
                                            {totalMeetings > 0 ? (
                                                <>
                                                    <span>
                                                        Pekan{" "}
                                                        <span className={styles.rowSubtitleStrong}>
                                                            {s.activeWeek}
                                                        </span>{" "}
                                                        dari{" "}
                                                        <span className={styles.rowSubtitleStrong}>{totalMeetings}</span>
                                                    </span>
                                                    {currentMeeting ? (
                                                        <>
                                                            <span className={styles.rowMetaDot}>·</span>
                                                            <span>
                                                                Minggu ini:{" "}
                                                                <span className={styles.rowSubtitleStrong}>
                                                                    {fmtDateShort(currentMeeting.date).date}
                                                                </span>
                                                            </span>
                                                        </>
                                                    ) : nextMeeting ? (
                                                        <>
                                                            <span className={styles.rowMetaDot}>·</span>
                                                            <span>
                                                                Berikutnya:{" "}
                                                                <span className={styles.rowSubtitleStrong}>
                                                                    {fmtDateShort(nextMeeting.date).date}
                                                                </span>
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <span className={styles.rowMetaDot}>·</span>
                                                            <span style={{ color: "#16a34a", fontWeight: 600 }}>
                                                                Semester selesai
                                                            </span>
                                                        </>
                                                    )}
                                                </>
                                            ) : (
                                                <span style={{ color: "#c2410c", fontStyle: "italic" }}>
                                                    Belum ada jadwal pertemuan — klik Edit untuk mengatur
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                                        {isCurrent && (
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
                                                    <button className={styles.rowActionBtn} onClick={() => openEdit(s)} title="Edit jadwal & atur pertemuan" type="button">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                                        </svg>
                                                    </button>
                                                    <button className={`${styles.rowActionBtn} ${styles.rowActionBtnDanger}`} onClick={() => setConfirmId(s._id)} title="Hapus jadwal" type="button">
                                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                            <polyline points="3 6 5 6 21 6" />
                                                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                                            <path d="M10 11v6M14 11v6" />
                                                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                                                        </svg>
                                                    </button>
                                                </>
                                            )
                                        )}
                                        <svg
                                            className={`${styles.rowChevron} ${isExpanded ? styles.rowChevronOpen : ""}`}
                                            width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                                            onClick={() => {
                                                setSelectedId(isExpanded ? null : s._id);
                                                setSyllabusOpenId(null);
                                            }}
                                        >
                                            <polyline points="6 9 12 15 18 9" />
                                        </svg>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className={styles.rowExpand}>
                                        {totalMeetings === 0 ? (
                                            <div className={styles.timelineEmpty}>
                                                Belum ada jadwal pertemuan untuk kelas ini.
                                                {isCurrent && (
                                                    <div>
                                                        <button className={styles.btnAddEmpty} onClick={() => openEdit(s)} type="button" style={{ marginTop: "12px" }}>
                                                            Atur Jadwal Pertemuan
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <>
                                                <div className={styles.timelineHeader}>
                                                    <span className={styles.timelineTitle}>
                                                        {totalMeetings} Pertemuan
                                                    </span>
                                                    <button
                                                        className={styles.btnSyllabusInline}
                                                        onClick={() => {
                                                            const open = syllabusOpenId === s._id;
                                                            setSyllabusOpenId(open ? null : s._id);
                                                            if (!open) fetchModules(s.fase, s.region);
                                                        }}
                                                        type="button"
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                                        </svg>
                                                        {syllabusOpenId === s._id ? "Tutup Silabus" : "Lihat Silabus"}
                                                    </button>
                                                </div>

                                                <div className={styles.timelineList}>
                                                    {(() => {
                                                        // Compute windowing: show 2 before + current + 2 after
                                                        // Find anchor: current week, else first future, else last past
                                                        let anchorIdx = sortedKbm.findIndex(
                                                            (k) => getMeetingStatus(k.date) === "current"
                                                        );
                                                        if (anchorIdx === -1) {
                                                            anchorIdx = sortedKbm.findIndex(
                                                                (k) => getMeetingStatus(k.date) === "future"
                                                            );
                                                        }
                                                        if (anchorIdx === -1) anchorIdx = sortedKbm.length - 1;

                                                        const WINDOW_BEFORE = 2;
                                                        const WINDOW_AFTER = 2;
                                                        const start = Math.max(0, anchorIdx - WINDOW_BEFORE);
                                                        const end = Math.min(sortedKbm.length, anchorIdx + WINDOW_AFTER + 1);

                                                        const pastHidden = sortedKbm.slice(0, start);
                                                        const visible = sortedKbm.slice(start, end);
                                                        const futureHidden = sortedKbm.slice(end);

                                                        const pastSectionKey = `${s._id}:past`;
                                                        const futureSectionKey = `${s._id}:future`;
                                                        const pastExpanded = expandedSections.has(pastSectionKey);
                                                        const futureExpanded = expandedSections.has(futureSectionKey);

                                                        // Compute past summary (filled vs total)
                                                        const pastFilled = pastHidden.filter((k) => {
                                                            const c = s.completionByWeek?.[k.week];
                                                            return c?.attendance && c?.grades && c?.documentation;
                                                        }).length;
                                                        const pastIncomplete = pastHidden.length - pastFilled;

                                                        const renderItem = (k: typeof sortedKbm[number]) => {
                                                            const status = getMeetingStatus(k.date);
                                                            const completion = s.completionByWeek?.[k.week];
                                                            const compStatus = getCompletionStatus(completion, status);
                                                            const meetingKey = `${s._id}:${k.week}`;
                                                            const isExpanded = expandedMeeting === meetingKey;

                                                            let cls: string;
                                                            if (status === "future") cls = styles.timelineItemFuture;
                                                            else if (status === "current") cls = styles.timelineItemCurrent;
                                                            else if (compStatus === "complete") cls = styles.timelineItemComplete;
                                                            else cls = styles.timelineItemPast;

                                                            const { date, day } = fmtDateShort(k.date);

                                                            let pillText: string;
                                                            let pillClass: string;
                                                            if (status === "current") {
                                                                pillText = "Minggu Ini";
                                                                pillClass = styles.statusPillCurrent;
                                                            } else if (status === "future") {
                                                                pillText = "Akan Datang";
                                                                pillClass = styles.statusPillFuture;
                                                            } else if (compStatus === "complete") {
                                                                pillText = "✓ Selesai";
                                                                pillClass = styles.statusPillComplete;
                                                            } else if (compStatus === "partial") {
                                                                const filled = [completion?.attendance, completion?.grades, completion?.documentation].filter(Boolean).length;
                                                                pillText = `${filled}/3 Lengkap`;
                                                                pillClass = styles.statusPillPartial;
                                                            } else {
                                                                pillText = "Belum diisi";
                                                                pillClass = styles.statusPillEmpty;
                                                            }

                                                            const dateParam = dateToIso(k.date);
                                                            const qs = `scheduleId=${s._id}&week=${k.week}&date=${dateParam}&region=${encodeURIComponent(s.region)}&fase=${encodeURIComponent(s.fase)}`;

                                                            return (
                                                            <div
                                                                key={`${k.week}-${k.date}`}
                                                                className={`${styles.timelineItem} ${cls} ${isExpanded ? styles.timelineItemExpanded : ""}`}
                                                                onClick={() => {
                                                                    if (status === "future") return;
                                                                    setExpandedMeeting(isExpanded ? null : meetingKey);
                                                                }}
                                                            >
                                                                <div className={styles.timelineBar} />
                                                                <div className={styles.timelineBody}>
                                                                    <div className={styles.timelineTopRow}>
                                                                        <span className={styles.timelineDate}>{date}</span>
                                                                        <span className={styles.timelineDay}>
                                                                            Pekan {k.week} · {day}
                                                                            {status === "current" && " · Minggu Ini"}
                                                                        </span>
                                                                    </div>
                                                                    {k.topic ? (
                                                                        <span className={styles.timelineTopic} title={k.topic}>
                                                                            {k.topic}
                                                                        </span>
                                                                    ) : (
                                                                        <span className={styles.timelineTopicEmpty}>—</span>
                                                                    )}
                                                                    {k.rescheduledAt && (
                                                                        <span
                                                                            className={styles.timelineRescheduled}
                                                                            title={
                                                                                k.rescheduleReason
                                                                                    ? `Digeser: ${k.rescheduleReason}`
                                                                                    : "Digeser"
                                                                            }
                                                                        >
                                                                            Digeser
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className={styles.timelineRight}>
                                                                    <span className={`${styles.statusPill} ${pillClass}`}>
                                                                        {pillText}
                                                                        {status !== "future" && status !== "current" && (
                                                                            <span className={styles.progressDots}>
                                                                                <span className={`${styles.dot} ${completion?.attendance ? styles.dotFilled : ""}`} />
                                                                                <span className={`${styles.dot} ${completion?.grades ? styles.dotFilled : ""}`} />
                                                                                <span className={`${styles.dot} ${completion?.documentation ? styles.dotFilled : ""}`} />
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    {status !== "future" && (
                                                                        <span className={`${styles.timelineChevron} ${isExpanded ? styles.timelineChevronOpen : ""}`}>▾</span>
                                                                    )}
                                                                </div>

                                                                {/* Expand panel — action checklist */}
                                                                {isExpanded && (
                                                                    <div className={styles.actionPanel} onClick={(e) => e.stopPropagation()}>
                                                                        <div className={styles.actionPanelHeader}>
                                                                            <span className={styles.actionPanelTitle}>
                                                                                {compStatus === "complete"
                                                                                    ? "Pertemuan ini sudah selesai"
                                                                                    : "Lengkapi 3 aktivitas berikut"}
                                                                            </span>
                                                                            <button
                                                                                className={styles.materialLink}
                                                                                onClick={() => {
                                                                                    setSyllabusOpenId(s._id);
                                                                                    setSyllabusOpenWeek(k.week);
                                                                                    fetchModules(s.fase, s.region);
                                                                                }}
                                                                                type="button"
                                                                            >
                                                                                📚 Materi Pekan {k.week} →
                                                                            </button>
                                                                        </div>

                                                                        <div className={styles.actionList}>
                                                                            <a
                                                                                href={completion?.attendance ? `/attendance/recap?scheduleId=${s._id}&week=${k.week}` : `/attendance?${qs}`}
                                                                                className={`${styles.actionRow} ${completion?.attendance ? styles.actionRowDone : ""}`}
                                                                            >
                                                                                <span className={styles.actionCheck}>{completion?.attendance ? "✓" : ""}</span>
                                                                                <div className={styles.actionInfo}>
                                                                                    <div className={styles.actionLabel}>Presensi Kehadiran</div>
                                                                                    <div className={styles.actionDesc}>
                                                                                        {completion?.attendance
                                                                                            ? `Tercatat · ${completion.attendanceCount ?? 0} siswa`
                                                                                            : "Belum diisi · auto-fill tanggal"}
                                                                                    </div>
                                                                                </div>
                                                                                <span className={styles.actionCta}>
                                                                                    {completion?.attendance ? "Lihat" : "Isi sekarang →"}
                                                                                </span>
                                                                            </a>
                                                                            <a
                                                                                href={`/evaluation?${qs}`}
                                                                                className={`${styles.actionRow} ${completion?.grades ? styles.actionRowDone : ""}`}
                                                                            >
                                                                                <span className={styles.actionCheck}>{completion?.grades ? "✓" : ""}</span>
                                                                                <div className={styles.actionInfo}>
                                                                                    <div className={styles.actionLabel}>Penilaian (TUGAS)</div>
                                                                                    <div className={styles.actionDesc}>
                                                                                        {completion?.grades
                                                                                            ? `Tercatat · ${completion.gradesCount ?? 0} siswa dinilai`
                                                                                            : "Belum diinput · auto-fill pekan"}
                                                                                    </div>
                                                                                </div>
                                                                                <span className={styles.actionCta}>
                                                                                    {completion?.grades ? "Lihat" : "Isi sekarang →"}
                                                                                </span>
                                                                            </a>
                                                                            <a
                                                                                href={`/reporting?${qs}`}
                                                                                className={`${styles.actionRow} ${completion?.documentation ? styles.actionRowDone : ""}`}
                                                                            >
                                                                                <span className={styles.actionCheck}>{completion?.documentation ? "✓" : ""}</span>
                                                                                <div className={styles.actionInfo}>
                                                                                    <div className={styles.actionLabel}>Dokumentasi KBM</div>
                                                                                    <div className={styles.actionDesc}>
                                                                                        {completion?.documentation
                                                                                            ? `Laporan tersimpan · ${completion.documentationCount ?? 0} dokumen`
                                                                                            : "Belum dibuat · auto-fill tanggal"}
                                                                                    </div>
                                                                                </div>
                                                                                <span className={styles.actionCta}>
                                                                                    {completion?.documentation ? "Lihat" : "Buat laporan →"}
                                                                                </span>
                                                                            </a>
                                                                        </div>

                                                                        {isCurrent && status !== "past" && (
                                                                            <div className={styles.actionPanelFooter}>
                                                                                <span>Pertemuan ini perlu dipindah?</span>
                                                                                <button
                                                                                    className={styles.btnReschedule}
                                                                                    onClick={() => setRescheduleTarget({
                                                                                        scheduleId: s._id,
                                                                                        week: k.week,
                                                                                        oldDate: k.date,
                                                                                        topic: k.topic,
                                                                                    })}
                                                                                    type="button"
                                                                                >
                                                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                                                                                        <rect x="3" y="4" width="18" height="18" rx="2" />
                                                                                        <line x1="16" y1="2" x2="16" y2="6" />
                                                                                        <line x1="8" y1="2" x2="8" y2="6" />
                                                                                        <line x1="3" y1="10" x2="21" y2="10" />
                                                                                    </svg>
                                                                                    Geser tanggal
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            );
                                                        };

                                                        return (
                                                            <>
                                                                {pastHidden.length > 0 && !pastExpanded && (
                                                                    <button
                                                                        type="button"
                                                                        className={styles.timelineSummary}
                                                                        onClick={() => toggleSection(s._id, "past")}
                                                                    >
                                                                        <span className={styles.timelineSummaryIcon}>▴</span>
                                                                        <span className={styles.timelineSummaryText}>
                                                                            {pastHidden.length} pekan sebelumnya
                                                                            {pastIncomplete > 0 ? (
                                                                                <span className={styles.timelineSummaryWarn}>
                                                                                    · {pastIncomplete} belum lengkap
                                                                                </span>
                                                                            ) : (
                                                                                <span className={styles.timelineSummaryOk}>
                                                                                    · ✓ semua selesai
                                                                                </span>
                                                                            )}
                                                                        </span>
                                                                        <span className={styles.timelineSummaryAction}>Lihat</span>
                                                                    </button>
                                                                )}
                                                                {pastExpanded && pastHidden.map(renderItem)}
                                                                {pastExpanded && pastHidden.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        className={`${styles.timelineSummary} ${styles.timelineSummaryCollapse}`}
                                                                        onClick={() => toggleSection(s._id, "past")}
                                                                    >
                                                                        <span className={styles.timelineSummaryIcon}>▴</span>
                                                                        <span className={styles.timelineSummaryText}>Sembunyikan {pastHidden.length} pekan sebelumnya</span>
                                                                    </button>
                                                                )}

                                                                {visible.map(renderItem)}

                                                                {futureHidden.length > 0 && !futureExpanded && (
                                                                    <button
                                                                        type="button"
                                                                        className={styles.timelineSummary}
                                                                        onClick={() => toggleSection(s._id, "future")}
                                                                    >
                                                                        <span className={styles.timelineSummaryIcon}>▾</span>
                                                                        <span className={styles.timelineSummaryText}>
                                                                            {futureHidden.length} pekan selanjutnya
                                                                        </span>
                                                                        <span className={styles.timelineSummaryAction}>Lihat</span>
                                                                    </button>
                                                                )}
                                                                {futureExpanded && futureHidden.map(renderItem)}
                                                                {futureExpanded && futureHidden.length > 0 && (
                                                                    <button
                                                                        type="button"
                                                                        className={`${styles.timelineSummary} ${styles.timelineSummaryCollapse}`}
                                                                        onClick={() => toggleSection(s._id, "future")}
                                                                    >
                                                                        <span className={styles.timelineSummaryIcon}>▾</span>
                                                                        <span className={styles.timelineSummaryText}>Sembunyikan {futureHidden.length} pekan selanjutnya</span>
                                                                    </button>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Syllabus / Module Modal */}
            <Modal
                isOpen={!!syllabusOpenId && !!schedules.find((s) => s._id === syllabusOpenId)}
                onClose={() => setSyllabusOpenId(null)}
                title={(() => {
                    const ss = schedules.find((s) => s._id === syllabusOpenId);
                    return ss ? `Silabus & Modul — ${ss.region}` : "Silabus";
                })()}
                maxWidth="600px"
            >
                {(() => {
                    const ss = syllabusOpenId ? schedules.find((s) => s._id === syllabusOpenId) : null;
                    if (!ss) return null;
                    const moduleCacheKey = getModuleCacheKey(ss.region, ss.fase);
                    const wmap = modulesCache[moduleCacheKey] ?? null;
                    const loading = modulesLoadingLevel === moduleCacheKey;
                    const wnums = wmap
                        ? Object.keys(wmap).map(Number).filter((w) => w > 0).sort((a, b) => a - b)
                        : [];
                    return (
                        <>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <span
                                    className={styles.modulePanelBadge}
                                    style={{
                                        background: (LEVEL_COLORS[ss.fase] || {bg: '#f3f4f6', color: '#374151'}).bg,
                                        color: (LEVEL_COLORS[ss.fase] || {bg: '#f3f4f6', color: '#374151'}).color,
                                    }}
                                >
                                    {availableLevels.find((l) => l.value === ss.fase)?.icon || "📖"}{" "}
                                    {ss.fase}
                                </span>
                                <span style={{ fontSize: '12.5px', color: '#64748b' }}>Pekan aktif: Pekan {ss.activeWeek}</span>
                            </div>
                            {loading ? (
                                <div className={styles.loadingState}>
                                    <div className={styles.spinner} style={{ borderColor: "rgba(0,0,0,0.1)", borderTopColor: "#c0392b" }} />
                                    Memuat modul...
                                </div>
                            ) : wnums.length === 0 ? (
                                <div className={styles.emptyModules}>
                                    <div className={styles.emptyIcon}>
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                        </svg>
                                    </div>
                                    <p className={styles.emptyTitle}>Modul belum tersedia</p>
                                    <p className={styles.emptyDesc}>
                                        Admin belum menambahkan modul untuk {ss.region} — {ss.fase}. Cek kembali nanti.
                                    </p>
                                </div>
                            ) : (
                                <div className={styles.weekGroups}>
                                    {wnums.map((week) => {
                                        const modules = wmap![week] ?? [];
                                        const isActive = week === ss.activeWeek;
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
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                                    <span className={styles.moduleTitle}>{mod.title}</span>
                                                                    {mod.subCategory && mod.subCategory !== ss.fase && (
                                                                        <span style={{ 
                                                                            fontSize: '9px', 
                                                                            fontWeight: 700, 
                                                                            padding: '2px 6px', 
                                                                            background: '#f1f5f9', 
                                                                            color: '#64748b', 
                                                                            borderRadius: '4px',
                                                                            textTransform: 'uppercase'
                                                                        }}>
                                                                            {mod.subCategory}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                {mod.description && (
                                                                    <span className={styles.moduleDesc}>{mod.description}</span>
                                                                )}
                                                            </div>
                                                            {mod.fileUrl ? (
                                                                <div className={styles.moduleActions}>
                                                                    <a
                                                                        href={mod.fileUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className={styles.btnRead}
                                                                    >
                                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                                                            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                                                                            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                                                                        </svg>
                                                                        Baca
                                                                    </a>
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
                                                                </div>
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
                        </>
                    );
                })()}
            </Modal>

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
                        <label className={styles.formLabel}>Lokasi Belajar</label>
                        {availableRegions.length === 0 ? (
                            <input
                                type="text"
                                className={styles.formInput}
                                placeholder="Tidak ada data lokasi belajar..."
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
                                    <option value="" disabled>Pilih Lokasi Belajar...</option>
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
                                        name="fase"
                                        value={l.value}
                                        checked={fase === l.value}
                                        onChange={() => setLevel(l.value)}
                                    />
                                    <span className={styles.levelOptionLabel}>
                                        <span className={styles.levelIcon}>{l.icon}</span>
                                        <span className={styles.levelName}>{l.label}</span>
                                    </span>
                                </label>
                            ))}
                            {region && availableLevels.length === 0 && (
                                <span style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Tidak ada jenjang terdaftar.</span>
                            )}
                        </div>
                    </div>
                    <div className={styles.formField}>
                        <label className={styles.formLabel}>Periode Semester</label>
                        <div 
                            className={styles.formInput} 
                            style={{ background: '#f5f5f5', color: '#888', cursor: 'not-allowed', display: 'flex', alignItems: 'center' }}
                        >
                            {formatSemester(semester, semesterLabels)}
                        </div>
                    </div>
                    <div className={`${styles.formField} ${styles.formFieldFull}`}>
                        <label className={styles.formLabel}>
                            Jadwal Pertemuan KBM
                            <span style={{ fontWeight: 400, color: '#888', marginLeft: '6px', fontSize: '12px' }}>
                                (pekan aktif otomatis dari tanggal hari ini)
                            </span>
                        </label>
                        <MeetingsGenerator initial={kbmDates} onChange={setKbmDates} />
                    </div>
                </div>

                {isDuplicate && (
                    <div style={{ marginTop: '16px', padding: '10px 14px', background: 'rgba(192, 57, 43, 0.08)', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#c0392b', fontSize: '12.5px', fontWeight: 600 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                        Kombinasi lokasi belajar & jenjang ini sudah terdaftar di semester ini.
                    </div>
                )}
            </Modal>

            {/* Reschedule Modal */}
            {rescheduleTarget && (
                <RescheduleModal
                    scheduleId={rescheduleTarget.scheduleId}
                    week={rescheduleTarget.week}
                    oldDate={rescheduleTarget.oldDate}
                    topic={rescheduleTarget.topic}
                    onClose={() => setRescheduleTarget(null)}
                    onSaved={(updated) => {
                        setSchedules((prev) =>
                            prev.map((s) => s._id === updated._id ? { ...s, kbmDates: updated.kbmDates, activeWeek: updated.activeWeek } : s)
                        );
                        setRescheduleTarget(null);
                        showToast("success", `Pertemuan ${rescheduleTarget.week} berhasil dijadwalkan ulang.`);
                    }}
                />
            )}

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
