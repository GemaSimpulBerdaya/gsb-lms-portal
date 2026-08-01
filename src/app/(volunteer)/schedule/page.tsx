"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { SlidersHorizontal } from "lucide-react";
import styles from "./schedule.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import Modal from "@/components/ui/Modal/Modal";
import VolunteerFilterPanel from "@/components/volunteer/VolunteerFilterPanel/VolunteerFilterPanel";
import { getCurrentSemester, formatSemester, dateToIso } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import MeetingsGenerator, { KbmDate, TeamMemberOption } from "./_components/MeetingsGenerator";
import RescheduleModal from "./_components/RescheduleModal";
import ToastNotification from "@/components/toast/Toast";

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
        petugas?: string[];
        originalDate?: string;
        rescheduleReason?: string;
        rescheduledAt?: string;
    }[];
    completionByWeek?: Record<number, CompletionEntry>;
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

const DEFAULT_LEVELS = [
    { value: "FASE PELITA", label: "FASE PELITA", icon: "♿" },
    { value: "FASE TUNAS & PUCUK", label: "FASE TUNAS & PUCUK", icon: "🎒" },
    { value: "FASE A", label: "FASE A", icon: "📚" },
    { value: "FASE B", label: "FASE B", icon: "📚" },
    { value: "FASE C", label: "FASE C", icon: "📚" },
    { value: "FASE D", label: "FASE D", icon: "🎓" },
    { value: "FASE E", label: "FASE E", icon: "🎓" },
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

function getMeetingMonth(iso: string): number {
    const month = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Jakarta",
        month: "numeric",
    }).format(new Date(iso));
    return Number(month) || 0;
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
    const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
    const [teamMembers, setTeamMembers] = useState<TeamMemberOption[]>([]);
    const [teamRegion, setTeamRegion] = useState("");

    // Mengunci semua interaksi tulis (Create, Edit, Delete) -> Relawan hanya View-Only
    const IS_READONLY = true;

    // Filter
    const [selectedFilterSemester, setSelectedFilterSemester] = useState(() => {
        return getCurrentSemester();
    });
    const [filterLevel, setFilterLevel] = useState("ALL");

    // Expanded schedule
    const [selectedId, setSelectedId] = useState<string | null>(null);

    // Reschedule modal
    const [rescheduleTarget, setRescheduleTarget] = useState<{
        scheduleId: string;
        week: number;
        oldDate: string;
        topic?: string;
    } | null>(null);

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

                if (data.activeSemester) {
                    setSelectedFilterSemester(data.activeSemester);
                    if (typeof window !== "undefined") {
                        localStorage.setItem("activeSemester", data.activeSemester);
                    }
                }

                if (data.availableSubjects) {
                    setAvailableSubjects(data.availableSubjects);
                }
            }
        } catch (err) {
            console.error("Gagal memuat pengaturan global", err);
        }
    }, []);

    const fetchTeamMembers = useCallback(async () => {
        try {
            const res = await fetch("/api/volunteer/team-members");
            if (res.ok) {
                const data = await res.json();
                setTeamMembers(data.members ?? []);
                if (typeof data.region === "string") {
                    setTeamRegion(data.region);
                    setRegion((current) => current || data.region);
                }
            }
        } catch (err) {
            console.error("Gagal memuat anggota tim", err);
        }
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            setMounted(true);
            fetchSchedules();
            fetchGlobalSettings();
            fetchTeamMembers();
        }, 30);
        return () => clearTimeout(timer);
    }, [fetchSchedules, fetchGlobalSettings, fetchTeamMembers]);

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
                topic: k.topic ?? "",
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
                    topic: k.topic ?? "",
                    petugas: k.petugas ?? [],
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
        if (IS_READONLY) {
            showToast("error", "Penghapusan jadwal telah dikunci. Silakan hubungi Super Admin.");
            setConfirmId(null);
            return;
        }
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
                  if (!o) return true;
                  if (o.date.slice(0, 10) !== k.date) return true;
                  if ((o.topic || "") !== (k.topic || "")) return true;
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
        const matchesLevel = filterLevel === "ALL" || s.fase === filterLevel;
        return matchesSemester && matchesLevel;
    });

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
            subject: meeting.topic?.trim() || "Mata pelajaran belum diisi",
            team,
            teamTitle: team.length > 0
                ? team.map((member) => `${member.name} - ${member.role}`).join(", ")
                : "Belum ditentukan",
        };
    };

    const buildMaterialsHref = useCallback(
        (schedule: Schedule, meeting?: NonNullable<Schedule["kbmDates"]>[number]) => {
            const params = new URLSearchParams({
                semester: selectedFilterSemester,
                fase: schedule.fase,
            });

            if (meeting) {
                params.set("week", String(meeting.week));
                params.set("month", String(getMeetingMonth(meeting.date)));
                if (meeting.topic?.trim()) params.set("subject", meeting.topic.trim());
            }

            return `/materials?${params.toString()}`;
        },
        [selectedFilterSemester]
    );

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
                            Lihat jadwal mengajar dan pembagian relawan untuk setiap pertemuan.
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
            </div>

            {!loading && (
                <VolunteerFilterPanel
                    title="Filter Jadwal"
                    icon={SlidersHorizontal}
                    className={styles.scheduleFilterPanel}
                >
                    <div className={styles.filterBar}>
                        <div className={styles.selectWrapper}>
                            <select 
                                value={filterLevel} 
                                onChange={(e) => setFilterLevel(e.target.value)}
                                className={styles.filterSelect}
                            >
                                <option value="ALL">Semua Fase</option>
                                {availableLevels.map(l => (
                                    <option key={l.value} value={l.value}>{l.label}</option>
                                ))}
                            </select>
                            <svg className={styles.selectIcon} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                        </div>

                        {availableSemesters.length > 0 && (
                            <div className={styles.selectWrapper}>
                                <select 
                                    value={selectedFilterSemester} 
                                    onChange={(e) => {
                                        setSelectedFilterSemester(e.target.value);
                                        setSelectedId(null); 
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
                </VolunteerFilterPanel>
            )}

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
                                                    <span className={styles.rowPreviewLabel}>Mapel</span>
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
                                                    <a
                                                        className={styles.btnSyllabusInline}
                                                        href={buildMaterialsHref(s)}
                                                    >
                                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                                                            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                                                        </svg>
                                                        Buka Materi & Modul
                                                    </a>
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
                                                            const teamAssignments = formatTeamAssignments(k.petugas);
                                                            const teamTitle = teamAssignments.length > 0
                                                                ? teamAssignments.map((member) => `${member.name} - ${member.role}`).join(", ")
                                                                : "Belum ditentukan";

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
                                                                            <a
                                                                                className={styles.materialLink}
                                                                                href={buildMaterialsHref(s, k)}
                                                                            >
                                                                                📚 Materi Pekan {k.week} →
                                                                            </a>
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
                                    disabled={!!teamRegion}
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
                        <MeetingsGenerator
                            initial={kbmDates}
                            onChange={setKbmDates}
                            subjects={availableSubjects}
                            teamMembers={teamMembers}
                        />
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
                <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />
            )}
        </div>
    );
}
