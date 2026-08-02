"use client";

import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./schedules.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import Modal from "@/components/ui/Modal/Modal";
import ToastNotice from "@/components/toast/Toast";
import { getCurrentSemester, formatSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import MeetingsGenerator, { KbmDate, TeamMemberOption } from "./_components/MeetingsGenerator";
import RescheduleModal from "./_components/RescheduleModal";
import { Download } from "lucide-react";
import * as XLSX from "xlsx";

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
        meetingType?: string;
        topic?: string;
        requiresGrades?: boolean;
        petugas?: string[];
        originalDate?: string;
        rescheduleReason?: string;
        rescheduledAt?: string;
    }[];
};

type TeamAssignment = {
    id: string;
    name: string;
    role: string;
};

const TEAM_ROLE_LABEL: Record<string, string> = {
    FASILITATOR: "Fasilitator",
    PENGAJAR: "Pengajar",
    DOKUMENTASI: "Dokumentasi",
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
    { value: "FASE PELITA", label: "FASE PELITA", icon: "♿" },
    { value: "FASE TUNAS & PUCUK", label: "FASE TUNAS & PUCUK", icon: "🎒" },
    { value: "FASE A", label: "FASE A", icon: "📚" },
    { value: "FASE B", label: "FASE B", icon: "📚" },
    { value: "FASE C", label: "FASE C", icon: "📚" },
    { value: "FASE D", label: "FASE D", icon: "🎓" },
    { value: "FASE E", label: "FASE E", icon: "🎓" },

];

const LEVEL_COLORS: Record<string, { bg: string; color: string }> = {
    "FASE PELITA": { bg: "#ede9fe", color: "#7c3aed" },
    "FASE TUNAS & PUCUK": { bg: "#dcfce7", color: "#16a34a" },
    "FASE A":     { bg: "var(--admin-hero-soft)", color: "var(--admin-primary-dark)" },
    "FASE B":     { bg: "var(--admin-hero-soft)", color: "var(--admin-primary-dark)" },
    "FASE C":     { bg: "#f0f9ff", color: "#075985" },
    "FASE D":     { bg: "#ffedd5", color: "#c2410c" },
    "FASE E":     { bg: "#fee2e2", color: "#991b1b" },

    TK:           { bg: "#dcfce7", color: "#16a34a" },
    SD:           { bg: "var(--admin-hero-soft)", color: "var(--admin-primary-dark)" },
    SMP:          { bg: "#ffedd5", color: "#c2410c" },
};

const MEETING_TYPE_LABELS: Record<string, string> = {
    KBM: "KBM",
    OTHER: "Lainnya",
};

function getMeetingTypeLabel(value?: string) {
    const normalized = normalizeMeetingType(value);
    return MEETING_TYPE_LABELS[normalized] ?? "Lainnya";
}

function normalizeMeetingType(value?: string) {
    return (value || "KBM").toUpperCase() === "KBM" ? "KBM" : "OTHER";
}

function getModuleCacheKey(region: string, fase: string) {
    return `${region.trim().toLowerCase()}|${fase.trim().toLowerCase()}`;
}

type ToastState = { type: "success" | "error"; message: string } | null;

const EMPTY_FORM = { region: "", fase: "FASE A" as Schedule["fase"], semester: getCurrentSemester() };

export default function AdminSchedulesPage() {
    const semesterLabels = useSemesterLabels();
    const [mounted, setMounted] = useState(false);
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [toast, setToast] = useState<ToastState>(null);

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
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
    const [teamRegion] = useState("");

    // Admin bisa mengubah jadwal sepenuhnya
    const IS_READONLY = false;

    // Filter
    const [selectedFilterSemester, setSelectedFilterSemester] = useState(() => {
        if (typeof window !== "undefined") {
            return localStorage.getItem("activeSemester") || getCurrentSemester();
        }
        return getCurrentSemester();
    });
    const [searchQuery, setSearchQuery] = useState("");
    const [filterRegion, setFilterRegion] = useState("ALL");

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
    }, []);

    const fetchSchedules = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({ semester: selectedFilterSemester });
            const res = await fetch(`/api/admin/schedules?${params.toString()}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setSchedules(data.schedules ?? []);
            
            // Collect unique regions from the fetched schedules if we don't have them in settings
            if (data.schedules) {
                const fetchedRegions = Array.from(new Set(data.schedules.map((s: any) => s.region)));
                setAvailableRegions(prev => {
                    const combined = new Set([...prev, ...(fetchedRegions as string[])]);
                    return Array.from(combined).sort();
                });
            }
        } catch {
            showToast("error", "Gagal memuat jadwal. Silakan coba lagi.");
        } finally {
            setLoading(false);
        }
    }, [selectedFilterSemester, showToast]);

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

                if (data.availableSubjects) {
                    setAvailableSubjects(data.availableSubjects);
                }
            }
        } catch (err) {
            console.error("Gagal memuat pengaturan global", err);
        }
    }, []);

    const fetchTeamMembersByRegion = useCallback(async (selectedRegion: string) => {
        if (!selectedRegion) {
            setTeamMembers([]);
            return;
        }
        console.log('[DEBUG] Fetching team members for region:', selectedRegion);
        try {
            const res = await fetch(`/api/admin/team-members-by-region?region=${encodeURIComponent(selectedRegion)}`);
            console.log('[DEBUG] Response status:', res.status);
            if (res.ok) {
                const data = await res.json();
                console.log('[DEBUG] Response data:', data);
                setTeamMembers(data.members ?? []);
            } else {
                const errorData = await res.json();
                console.error('[DEBUG] API error:', errorData);
            }
        } catch (err) {
            console.error("[DEBUG] Gagal memuat anggota tim untuk region", selectedRegion, err);
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

    // Fetch anggota tim ketika region berubah di modal form
    useEffect(() => {
        if (formOpen && region) {
            fetchTeamMembersByRegion(region);
        }
    }, [formOpen, region, fetchTeamMembersByRegion]);

    // Refetch schedules saat user balik ke tab/page supaya data admin tetap fresh.
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
        setRegion(teamRegion);
        setLevel("FASE A");
        setSemester(selectedFilterSemester);
        setKbmDates([]);
        setFormOpen(true);
    };

    const openEdit = (s: Schedule) => {
        if (IS_READONLY) {
            showToast("error", "Perubahan jadwal telah dikunci. Silakan hubungi Super Admin.");
            return;
        }
        const currentRealSemester = getCurrentSemester();
        if (s.semester !== currentRealSemester) {
            showToast("error", "Jadwal semester lampau tidak dapat diubah.");
            return;
        }
        setEditingId(s._id);
        setRegion(s.region);
        setLevel(s.fase);
        setSemester(s.semester || "");
        setKbmDates(
            (s.kbmDates ?? []).map((k) => ({
                week: k.week,
                date: k.date.slice(0, 10), // ISO yyyy-mm-dd
                meetingType: normalizeMeetingType(k.meetingType),
                topic: k.topic ?? "",
                requiresGrades: normalizeMeetingType(k.meetingType) === "KBM",
                petugas: k.petugas ?? [],
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
                    meetingType: normalizeMeetingType(k.meetingType),
                    topic: k.topic ?? "",
                    requiresGrades: normalizeMeetingType(k.meetingType) === "KBM",
                    petugas: k.petugas ?? [],
                })),
            };
            if (isEdit) payload.id = editingId;

            const res = await fetch("/api/admin/schedules", {
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
        if (IS_READONLY) {
            showToast("error", "Penghapusan jadwal telah dikunci. Silakan hubungi Super Admin.");
            setConfirmId(null);
            return;
        }
        setDeletingId(id);
        try {
            const res = await fetch(`/api/admin/schedules?id=${id}`, { method: "DELETE" });
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
                  if (!o) return true;
                  if (o.date.slice(0, 10) !== k.date) return true;
                  if (normalizeMeetingType(o.meetingType) !== normalizeMeetingType(k.meetingType)) return true;
                  if ((o.topic || "") !== (k.topic || "")) return true;
                  if ((o.requiresGrades ?? true) !== (k.requiresGrades ?? true)) return true;
                  // Bandingkan petugas (urutan-agnostik)
                  const op = [...(o.petugas ?? [])].sort().join(",");
                  const kp = [...(k.petugas ?? [])].sort().join(",");
                  return op !== kp;
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
        const matchesRegion = filterRegion === "ALL" || s.region === filterRegion;
        return matchesSemester && matchesSearch && matchesRegion;
    });

    const handleExportExcel = async () => {
        if (filteredSchedules.length === 0) return;
        try {
            const membersByRegion = new Map<string, Map<string, TeamMemberOption>>();
            await Promise.all(
                Array.from(new Set(filteredSchedules.map((schedule) => schedule.region))).map(async (scheduleRegion) => {
                    const response = await fetch(`/api/admin/team-members-by-region?region=${encodeURIComponent(scheduleRegion)}`);
                    if (!response.ok) throw new Error();
                    const members = ((await response.json()).members ?? []) as TeamMemberOption[];
                    membersByRegion.set(scheduleRegion, new Map(members.map((member) => [member.volunteerId, member])));
                }),
            );
            const rows = filteredSchedules.flatMap((schedule) =>
                (schedule.kbmDates ?? []).map((meeting) => ({
                    Semester: schedule.semester,
                    "Lokasi Belajar": schedule.region,
                    Fase: schedule.fase,
                    Pekan: meeting.week,
                    Tanggal: new Date(meeting.date).toLocaleDateString("id-ID"),
                    "Jenis Pertemuan": getMeetingTypeLabel(meeting.meetingType),
                    Agenda: meeting.topic || "-",
                    "Perlu Penilaian": meeting.requiresGrades === false ? "Tidak" : "Ya",
                    Relawan: meeting.petugas?.map((id) => {
                        const member = membersByRegion.get(schedule.region)?.get(id);
                        return member ? `${member.name} - ${TEAM_ROLE_LABEL[member.role] ?? member.role}` : id;
                    }).join(", ") || "-",
                    "Tanggal Awal": meeting.originalDate ? new Date(meeting.originalDate).toLocaleDateString("id-ID") : "-",
                    "Alasan Perubahan": meeting.rescheduleReason || "-",
                })),
            );
            if (rows.length === 0) {
                showToast("error", "Belum ada pertemuan untuk diekspor.");
                return;
            }
            const sheet = XLSX.utils.json_to_sheet(rows);
            sheet["!cols"] = [
                { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 8 }, { wch: 14 },
                { wch: 18 }, { wch: 34 }, { wch: 18 }, { wch: 40 }, { wch: 14 }, { wch: 34 },
            ];
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, sheet, "Jadwal Mengajar");
            XLSX.writeFile(workbook, `Jadwal Mengajar ${selectedFilterSemester}.xlsx`);
        } catch {
            showToast("error", "Gagal menyiapkan export jadwal.");
        }
    };

    const filteredTeamMembers = useMemo(() => {
        // Data dari API udah specific untuk region yang dipilih, langsung pakai
        console.log('[RENDER] filteredTeamMembers:', teamMembers);
        return teamMembers;
    }, [teamMembers]);

    const isArchive = selectedFilterSemester !== getCurrentSemester();
    const teamMemberById = useMemo(() => {
        return new Map(teamMembers.map((member) => [member.volunteerId, member]));
    }, [teamMembers]);

    const formatTeamAssignments = useCallback(
        (petugas?: string[]) => {
            return (petugas ?? [])
                .map((id) => {
                    const member = teamMemberById.get(id);
                    if (!member) return null;
                    return {
                        id,
                        name: member.name,
                        role: TEAM_ROLE_LABEL[member.role] ?? member.role,
                    };
                })
                .filter((member): member is TeamAssignment => Boolean(member));
        },
        [teamMemberById]
    );

    const getMeetingSummaryLabel = (meeting?: NonNullable<Schedule["kbmDates"]>[number]) => {
        if (!meeting) return null;
        const team = formatTeamAssignments(meeting.petugas);
        return {
            subject: meeting.topic?.trim() || "Agenda belum diisi",
            meetingType: getMeetingTypeLabel(meeting.meetingType),
            team,
            teamTitle: team.length > 0
                ? team.map((member) => `${member.name} - ${member.role}`).join(", ")
                : "Belum ditentukan",
        };
    };

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
                        <>Melihat kembali riwayat jadwal mengajar di semester lampau. Data di halaman ini bersifat <strong>Read-Only</strong> (Arsip).</>
                    ) : (
                        <>
                            Kelola jadwal KBM semester dan tugaskan relawan per pekan untuk setiap lokasi belajar.
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
                    <button className={styles.btnExport} onClick={handleExportExcel} disabled={loading || filteredSchedules.length === 0} type="button">
                        <Download size={14} /> Export
                    </button>
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

                        <AdminFilterSelect
                            width="lg"
                            value={filterRegion === "ALL" ? "" : filterRegion}
                            onChange={(v) => setFilterRegion(v || "ALL")}
                            placeholder="Semua Lokasi Belajar"
                            clearable
                            clearLabel="Semua Lokasi Belajar"
                            options={availableRegions.map(r => ({ value: r, label: r }))}
                        />

                        {availableSemesters.length > 0 && (
                            <AdminFilterSelect
                                value={selectedFilterSemester}
                                onChange={(v) => { setSelectedFilterSemester(v); setSelectedId(null); setModulesCache({}); }}
                                options={availableSemesters.map(sem => ({ value: sem, label: formatSemester(sem, semesterLabels) }))}
                            />
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

                        <AdminFilterSelect
                            width="lg"
                            value={filterRegion === "ALL" ? "" : filterRegion}
                            onChange={(v) => setFilterRegion(v || "ALL")}
                            placeholder="Semua Lokasi Belajar"
                            clearable
                            clearLabel="Semua Lokasi Belajar"
                            options={availableRegions.map(r => ({ value: r, label: r }))}
                        />

                        {availableSemesters.length > 0 && (
                            <AdminFilterSelect
                                value={selectedFilterSemester}
                                onChange={(v) => { setSelectedFilterSemester(v); setSelectedId(null); setModulesCache({}); }}
                                options={availableSemesters.map(sem => ({ value: sem, label: formatSemester(sem, semesterLabels) }))}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Cards */}
            {loading ? (
                <div className={styles.loadingState}>
                    <Spinner />
                    <p>Memuat jadwal...</p>
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
                        const schedulePreview = getMeetingSummaryLabel(currentMeeting ?? nextMeeting);

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
                                                    {IS_READONLY ? "Belum ada jadwal pertemuan yang diset oleh Admin" : "Belum ada jadwal pertemuan — klik Edit untuk mengatur"}
                                                </span>
                                            )}
                                        </div>
                                        {schedulePreview && (
                                            <div className={styles.rowMeetingPreview}>
                                                <span className={styles.rowPreviewItem} title={schedulePreview.subject}>
                                                    <span className={styles.rowPreviewLabel}>{schedulePreview.meetingType}</span>
                                                    {schedulePreview.subject}
                                                </span>
                                                <span className={styles.rowPreviewTeam} title={schedulePreview.teamTitle}>
                                                    <span className={styles.rowPreviewLabel}>Relawan</span>
                                                    {schedulePreview.team.length > 0 ? (
                                                        <span className={styles.teamChipGroupCompact}>
                                                            {schedulePreview.team.slice(0, 3).map((member) => (
                                                                <span key={member.id} className={styles.teamChipCompact}>
                                                                    <span className={styles.teamChipName}>{member.name}</span>
                                                                    <span className={styles.teamChipRole}>{member.role}</span>
                                                                </span>
                                                            ))}
                                                            {schedulePreview.team.length > 3 && (
                                                                <span className={styles.teamChipMore}>
                                                                    +{schedulePreview.team.length - 3}
                                                                </span>
                                                            )}
                                                        </span>
                                                    ) : (
                                                        <span className={styles.teamEmpty}>Belum ditentukan</span>
                                                    )}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.rowActions} onClick={(e) => e.stopPropagation()}>
                                        {isCurrent && !IS_READONLY && (
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
                                                        {syllabusOpenId === s._id ? "Tutup Materi" : "Lihat Materi"}
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

                                                        const renderItem = (k: typeof sortedKbm[number]) => {
                                                            const status = getMeetingStatus(k.date);
                                                            const meetingKey = `${s._id}:${k.week}`;
                                                            const isExpanded = expandedMeeting === meetingKey;
                                                            const meetingTypeLabel = getMeetingTypeLabel(k.meetingType);

                                                            let cls: string;
                                                            if (status === "future") cls = styles.timelineItemFuture;
                                                            else if (status === "current") cls = styles.timelineItemCurrent;
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
                                                            } else {
                                                                pillText = "Sudah Lewat";
                                                                pillClass = styles.statusPillFuture;
                                                            }

                                                            const teamAssignments = formatTeamAssignments(k.petugas);
                                                            const teamTitle = teamAssignments.length > 0
                                                                ? teamAssignments.map((member) => `${member.name} - ${member.role}`).join(", ")
                                                                : "Belum ditentukan";

                                                            return (
                                                            <div
                                                                key={`${k.week}-${k.date}`}
                                                                className={`${styles.timelineItem} ${cls} ${isExpanded ? styles.timelineItemExpanded : ""}`}
                                                                onClick={() => {
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
                                                                        <span className={styles.timelineType}>
                                                                            {meetingTypeLabel}
                                                                        </span>
                                                                    </div>
                                                                    {k.topic ? (
                                                                        <span className={styles.timelineTopic} title={k.topic}>
                                                                            {k.topic}
                                                                        </span>
                                                                    ) : (
                                                                        <span className={styles.timelineTopicEmpty}>Agenda belum diisi</span>
                                                                    )}
                                                                    <div className={styles.timelineTeam} title={teamTitle}>
                                                                        <span className={styles.timelineTeamLabel}>Relawan</span>
                                                                        {teamAssignments.length > 0 ? (
                                                                            <span className={styles.teamChipGroup}>
                                                                                {teamAssignments.map((member) => (
                                                                                    <span key={member.id} className={styles.teamChip}>
                                                                                        <span className={styles.teamChipName}>{member.name}</span>
                                                                                        <span className={styles.teamChipRole}>{member.role}</span>
                                                                                    </span>
                                                                                ))}
                                                                            </span>
                                                                        ) : (
                                                                            <span className={styles.teamEmpty}>Belum ditentukan</span>
                                                                        )}
                                                                    </div>
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
                                                                    </span>
                                                                    <span className={`${styles.timelineChevron} ${isExpanded ? styles.timelineChevronOpen : ""}`}>▾</span>
                                                                </div>

                                                                {/* Expand panel admin: detail jadwal dan aksi pengaturan */}
                                                                {isExpanded && (
                                                                    <div className={styles.actionPanel} onClick={(e) => e.stopPropagation()}>
                                                                        <div className={styles.actionPanelHeader}>
                                                                            <span className={styles.actionPanelTitle}>Detail pertemuan</span>
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

                                                                        {isCurrent && status !== "past" && (
                                                                            <div className={styles.actionPanelFooter}>
                                                                                <span>Atur tanggal pertemuan</span>
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
                    return ss ? `Materi & Modul — ${ss.region}` : "Materi";
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
                                    <Spinner />
                                    <p>Memuat modul...</p>
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
                                                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                                        </svg>
                                                                        Buka Tautan
                                                                    </a>
                                                                </div>
                                                            ) : (
                                                                <span className={styles.btnDownloadDisabled}>Belum ada tautan</span>
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
                maxWidth="1000px"
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
                                    <Spinner size="sm" style={{ marginRight: "6px" }} />
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
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                                    <polyline points="6 9 12 15 18 9"></polyline>
                                </svg>
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
                            {availableLevels.length === 0 && (
                                <span style={{ fontSize: '13px', color: '#888', marginTop: '4px' }}>Tidak ada jenjang terdaftar.</span>
                            )}
                        </div>
                    </div>

                    <div className={`${styles.formField} ${styles.formFieldFull}`}>
                        <label className={styles.formLabel}>Periode Semester</label>
                        <div 
                            className={styles.formInput} 
                            style={{ background: '#f5f5f5', color: '#888', cursor: 'not-allowed', display: 'flex', alignItems: 'center' }}
                        >
                            {formatSemester(semester, semesterLabels)}
                        </div>
                    </div>

                    {isDuplicate && (
                        <div className={`${styles.formField} ${styles.formFieldFull}`}>
                            <div className={styles.duplicateAlert} role="alert">
                                <span className={styles.duplicateAlertIcon} aria-hidden="true">
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <line x1="12" y1="8" x2="12" y2="12" />
                                        <line x1="12" y1="16" x2="12.01" y2="16" />
                                    </svg>
                                </span>
                                <div className={styles.duplicateAlertText}>
                                    <strong>Jadwal sudah terdaftar</strong>
                                    <span>
                                        Kombinasi {region || "lokasi belajar"} dan {fase} sudah ada di semester {formatSemester(semester, semesterLabels)}.
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className={`${styles.formField} ${styles.formFieldFull}`}>
                        <label className={styles.formLabel}>
                            Jadwal Pertemuan
                            <span style={{ fontWeight: 400, color: '#888', marginLeft: '6px', fontSize: '12px' }}>
                                (pekan aktif otomatis dari tanggal hari ini)
                            </span>
                        </label>
                        <MeetingsGenerator
                            initial={kbmDates}
                            onChange={setKbmDates}
                            subjects={availableSubjects}
                            teamMembers={filteredTeamMembers}
                            canGenerate={!!region && !!fase}
                        />
                    </div>

                </div>
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
                <ToastNotice
                    message={toast.message}
                    type={toast.type}
                    duration={3500}
                    onClose={() => setToast(null)}
                />
            )}
        </div>
    );
}
