"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Calendar,
  ExternalLink,
  FileText,
  Filter,
  Layers,
  MapPin,
  Search,
} from "lucide-react";
import Spinner from "@/components/ui/Spinner/Spinner";
import { formatSemester, getCurrentSemester } from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import styles from "./materials.module.css";

type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  kbmDates?: {
    week: number;
    date: string;
    topic?: string;
  }[];
};

type ResourceItem = {
  _id: string;
  title: string;
  slug?: string;
  description?: string;
  subject?: string;
  learningLocation?: string;
  month?: number | null;
  fileUrl?: string;
  order?: number;
};

type ResourceType = "all" | "materials" | "modules";

type FilterState = {
  semester: string;
  region: string;
  fase: string;
  month: string;
  subject: string;
  week: string;
  search: string;
  tab: ResourceType;
};

const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const DEFAULT_FILTERS: FilterState = {
  semester: getCurrentSemester(),
  region: "",
  fase: "",
  month: "ALL",
  subject: "ALL",
  week: "",
  search: "",
  tab: "all",
};

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function getMonthLabel(month?: number | null) {
  if (!month) return "Tanpa bulan";
  return MONTH_LABELS[month - 1] ?? "Tanpa bulan";
}

function getMeetingMonth(iso: string): number {
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jakarta",
    month: "numeric",
  }).format(new Date(iso));
  return Number(month) || 0;
}

function readInitialFilters(): FilterState {
  if (typeof window === "undefined") return DEFAULT_FILTERS;

  const params = new URLSearchParams(window.location.search);

  return {
    semester: params.get("semester") || getCurrentSemester(),
    region: params.get("region") || "",
    fase: params.get("fase") || "",
    month: params.get("month") || "ALL",
    subject: params.get("subject") || "ALL",
    week: params.get("week") || "",
    search: params.get("search") || "",
    tab: (params.get("tab") as ResourceType) || "all",
  };
}

function hasInitialQuery(key: keyof FilterState) {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).has(key);
}

function subjectMatches(resourceSubject: string | undefined, selectedSubject: string) {
  if (selectedSubject === "ALL") return true;
  const selected = normalize(selectedSubject);
  const resource = normalize(resourceSubject);
  if (!resource) return true;
  return selected === resource || selected.includes(resource) || resource.includes(selected);
}

export default function VolunteerMaterialsPage() {
  const semesterLabels = useSemesterLabels();
  const [filters, setFilters] = useState<FilterState>(() => readInitialFilters());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [modules, setModules] = useState<ResourceItem[]>([]);
  const [teachingMaterials, setTeachingMaterials] = useState<ResourceItem[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(true);
  const [loadingResources, setLoadingResources] = useState(false);
  const [error, setError] = useState("");

  const setFilter = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "semester" ? { region: "", fase: "", week: "" } : {}),
      ...(key === "region" ? { fase: "", week: "" } : {}),
      ...(key === "fase" ? { week: "" } : {}),
    }));
  }, []);

  useEffect(() => {
    let cancelled = false;

    const hydrateSemester = async () => {
      try {
        const res = await fetch("/api/settings/public", { cache: "no-store" });
        const data = res.ok ? await res.json() : {};
        const activeSemester =
          typeof data.activeSemester === "string" && data.activeSemester.trim()
            ? data.activeSemester
            : "";
        if (cancelled || hasInitialQuery("semester")) return;

        const nextSemester = activeSemester || getCurrentSemester();
        setFilters((current) => ({ ...current, semester: nextSemester }));
        localStorage.setItem("activeSemester", nextSemester);
      } catch (err) {
        console.error("Gagal memuat semester aktif", err);
      }
    };

    hydrateSemester();

    return () => {
      cancelled = true;
    };
  }, []);

  const fetchSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    try {
      const res = await fetch("/api/volunteer/schedule", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat jadwal.");
      setSchedules(data.schedules ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat jadwal.");
    } finally {
      setLoadingSchedules(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const availableSemesters = useMemo(() => {
    return Array.from(new Set([...schedules.map((s) => s.semester), filters.semester, getCurrentSemester()]))
      .filter(Boolean)
      .sort()
      .reverse();
  }, [filters.semester, schedules]);

  const availableRegions = useMemo(() => {
    return Array.from(
      new Set(
        schedules
          .filter((s) => s.semester === filters.semester)
          .map((s) => s.region)
          .filter(Boolean)
      )
    ).sort();
  }, [filters.semester, schedules]);

  const availableFases = useMemo(() => {
    return Array.from(
      new Set(
        schedules
          .filter((s) => s.semester === filters.semester)
          .filter((s) => !filters.region || s.region === filters.region)
          .map((s) => s.fase)
          .filter(Boolean)
      )
    ).sort();
  }, [filters.region, filters.semester, schedules]);

  useEffect(() => {
    if (loadingSchedules) return;

    setFilters((current) => {
      const nextRegion =
        current.region && availableRegions.includes(current.region)
          ? current.region
          : availableRegions[0] || "";
      const fasesForRegion = Array.from(
        new Set(
          schedules
            .filter((schedule) => schedule.semester === current.semester)
            .filter((schedule) => !nextRegion || schedule.region === nextRegion)
            .map((schedule) => schedule.fase)
            .filter(Boolean)
        )
      ).sort();
      const nextFase =
        current.fase && fasesForRegion.includes(current.fase)
          ? current.fase
          : fasesForRegion[0] || "";

      if (nextRegion === current.region && nextFase === current.fase) return current;
      return { ...current, region: nextRegion, fase: nextFase };
    });
  }, [availableRegions, loadingSchedules, schedules]);

  const selectedSchedules = useMemo(() => {
    return schedules.filter(
      (schedule) =>
        schedule.semester === filters.semester &&
        (!filters.region || schedule.region === filters.region) &&
        (!filters.fase || schedule.fase === filters.fase)
    );
  }, [filters.fase, filters.region, filters.semester, schedules]);

  const meetingContext = useMemo(() => {
    if (!filters.week) return null;
    const week = Number(filters.week);
    if (!week) return null;
    for (const schedule of selectedSchedules) {
      const meeting = schedule.kbmDates?.find((item) => item.week === week);
      if (meeting) return meeting;
    }
    return null;
  }, [filters.week, selectedSchedules]);

  const scheduleSubjects = useMemo(() => {
    return selectedSchedules.flatMap((schedule) =>
      (schedule.kbmDates ?? []).map((meeting) => meeting.topic?.trim()).filter(Boolean) as string[]
    );
  }, [selectedSchedules]);

  const fetchResources = useCallback(async () => {
    if (!filters.fase) {
      setModules([]);
      setTeachingMaterials([]);
      return;
    }

    setLoadingResources(true);
    setError("");
    try {
      const params = new URLSearchParams({
        fase: filters.fase,
        semester: filters.semester,
      });
      if (filters.region) params.set("region", filters.region);
      if (filters.month !== "ALL") params.set("month", filters.month);

      const res = await fetch(`/api/volunteer/modules?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat materi dan modul.");
      setModules(data.modules ?? []);
      setTeachingMaterials(data.teachingMaterials ?? []);
    } catch (err) {
      setModules([]);
      setTeachingMaterials([]);
      setError(err instanceof Error ? err.message : "Gagal memuat materi dan modul.");
    } finally {
      setLoadingResources(false);
    }
  }, [filters.fase, filters.month, filters.region, filters.semester]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  const subjectOptions = useMemo(() => {
    return Array.from(
      new Set([
        ...scheduleSubjects,
        ...modules.map((item) => item.subject || "").filter(Boolean),
        ...teachingMaterials.map((item) => item.subject || "").filter(Boolean),
      ])
    ).sort((a, b) => a.localeCompare(b));
  }, [modules, scheduleSubjects, teachingMaterials]);

  const filteredMaterials = useMemo(() => {
    const search = normalize(filters.search);
    return teachingMaterials.filter((item) => {
      if (!subjectMatches(item.subject, filters.subject)) return false;
      if (!search) return true;
      return normalize(`${item.title} ${item.description || ""} ${item.subject || ""} ${item.learningLocation || ""}`).includes(search);
    });
  }, [filters.search, filters.subject, teachingMaterials]);

  const filteredModules = useMemo(() => {
    const search = normalize(filters.search);
    return modules.filter((item) => {
      if (!subjectMatches(item.subject, filters.subject)) return false;
      if (!search) return true;
      return normalize(`${item.title} ${item.description || ""} ${item.subject || ""} ${item.learningLocation || ""}`).includes(search);
    });
  }, [filters.search, filters.subject, modules]);

  const visibleResources = useMemo(() => {
    if (filters.tab === "materials") {
      return filteredMaterials.map((item) => ({ item, type: "material" as const }));
    }
    if (filters.tab === "modules") {
      return filteredModules.map((item) => ({ item, type: "module" as const }));
    }
    return [
      ...filteredMaterials.map((item) => ({ item, type: "material" as const })),
      ...filteredModules.map((item) => ({ item, type: "module" as const })),
    ].sort((a, b) => {
      const monthA = a.item.month ?? 0;
      const monthB = b.item.month ?? 0;
      if (monthA !== monthB) return monthA - monthB;
      return a.item.title.localeCompare(b.item.title);
    });
  }, [filteredMaterials, filteredModules, filters.tab]);

  const resourceCount = filteredMaterials.length + filteredModules.length;
  const activeMonth = filters.month !== "ALL" ? Number(filters.month) : null;

  const renderResourceCard = (
    item: ResourceItem,
    type: "material" | "module",
  ) => (
    <article key={`${type}-${item._id}`} className={styles.resourceCard}>
      <div className={styles.resourceIconWrap}>
        {type === "material" ? <FileText size={18} /> : <BookOpen size={18} />}
      </div>
      <div className={styles.resourceBody}>
        <div className={styles.resourceTitleRow}>
          <h3 className={styles.resourceTitle}>{item.title}</h3>
          <span className={`${styles.resourceBadge} ${type === "material" ? styles.badgeMaterial : styles.badgeModule}`}>
            {type === "material" ? "Materi Ajar" : "Modul Siswa"}
          </span>
        </div>
        <div className={styles.resourceMeta}>
          <span>{item.subject || "Semua mapel"}</span>
          <span>{getMonthLabel(item.month)}</span>
          <span>{item.learningLocation || "Semua lokasi"}</span>
        </div>
        {item.description && <p className={styles.resourceDesc}>{item.description}</p>}
      </div>
      {item.fileUrl ? (
        <a
          href={item.fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.openButton}
        >
          <ExternalLink size={14} />
          Buka
        </a>
      ) : (
        <span className={styles.disabledButton}>Belum ada tautan</span>
      )}
    </article>
  );

  return (
    <div className={styles.mainEnter}>
      <section className={styles.hero}>
        <span className={styles.heroLabel}>Library Relawan</span>
        <h1 className={styles.heroTitle}>Materi & Modul.</h1>
        <p className={styles.heroDesc}>
          Cari bahan ajar relawan dan modul siswa berdasarkan semester, lokasi, fase, bulan, dan mata pelajaran.
        </p>
      </section>

      <section className={styles.summaryStrip}>
        <div className={styles.summaryItem}>
          <Layers size={16} />
          <span>{resourceCount} resource cocok</span>
        </div>
        <div className={styles.summaryItem}>
          <MapPin size={16} />
          <span>{filters.region || "Pilih lokasi"}</span>
        </div>
        <div className={styles.summaryItem}>
          <Calendar size={16} />
          <span>
            {meetingContext
              ? `Pekan ${filters.week} - ${getMonthLabel(getMeetingMonth(meetingContext.date))}`
              : activeMonth
                ? getMonthLabel(activeMonth)
                : "Semua bulan"}
          </span>
        </div>
      </section>

      <section className={styles.filterPanel}>
        <div className={styles.filterTitle}>
          <Filter size={16} />
          Filter Resource
        </div>

        <div className={styles.filterGrid}>
          <label className={styles.field}>
            <span>Semester</span>
            <select value={filters.semester} onChange={(e) => setFilter("semester", e.target.value)}>
              {availableSemesters.map((semester) => (
                <option key={semester} value={semester}>
                  {formatSemester(semester, semesterLabels)}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Lokasi</span>
            <select value={filters.region} onChange={(e) => setFilter("region", e.target.value)}>
              {availableRegions.length === 0 ? (
                <option value="">Tidak ada jadwal</option>
              ) : (
                availableRegions.map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className={styles.field}>
            <span>Fase</span>
            <select value={filters.fase} onChange={(e) => setFilter("fase", e.target.value)}>
              {availableFases.length === 0 ? (
                <option value="">Tidak ada fase</option>
              ) : (
                availableFases.map((fase) => (
                  <option key={fase} value={fase}>
                    {fase}
                  </option>
                ))
              )}
            </select>
          </label>

          <label className={styles.field}>
            <span>Bulan</span>
            <select value={filters.month} onChange={(e) => setFilter("month", e.target.value)}>
              <option value="ALL">Semua bulan</option>
              {MONTH_LABELS.map((label, index) => (
                <option key={label} value={String(index + 1)}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          <label className={styles.field}>
            <span>Mapel</span>
            <select value={filters.subject} onChange={(e) => setFilter("subject", e.target.value)}>
              <option value="ALL">Semua mapel</option>
              {subjectOptions.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </select>
          </label>

          <label className={`${styles.field} ${styles.searchField}`}>
            <span>Cari</span>
            <div className={styles.searchBox}>
              <Search size={15} />
              <input
                value={filters.search}
                onChange={(e) => setFilter("search", e.target.value)}
                placeholder="Judul, mapel, lokasi..."
              />
            </div>
          </label>
        </div>
      </section>

      <section className={styles.resourcePanel}>
        <div className={styles.panelTop}>
          <div>
            <h2 className={styles.panelTitle}>Daftar Resource</h2>
            <p className={styles.panelSubtitle}>
              {meetingContext
                ? `Difilter dari Pekan ${filters.week}: ${meetingContext.topic || "Agenda belum diisi"}`
                : `${filteredMaterials.length} materi ajar dan ${filteredModules.length} modul siswa`}
            </p>
          </div>

          <div className={styles.tabs}>
            <button
              className={filters.tab === "all" ? styles.tabActive : ""}
              onClick={() => setFilter("tab", "all")}
              type="button"
            >
              Semua
            </button>
            <button
              className={filters.tab === "materials" ? styles.tabActive : ""}
              onClick={() => setFilter("tab", "materials")}
              type="button"
            >
              Materi
            </button>
            <button
              className={filters.tab === "modules" ? styles.tabActive : ""}
              onClick={() => setFilter("tab", "modules")}
              type="button"
            >
              Modul
            </button>
          </div>
        </div>

        {loadingSchedules || loadingResources ? (
          <div className={styles.loadingState}>
            <Spinner />
            <p>Memuat materi dan modul...</p>
          </div>
        ) : error ? (
          <div className={styles.emptyState}>
            <FileText size={28} />
            <h3>Resource belum bisa dimuat</h3>
            <p>{error}</p>
          </div>
        ) : !filters.fase ? (
          <div className={styles.emptyState}>
            <BookOpen size={28} />
            <h3>Pilih jadwal dulu</h3>
            <p>Belum ada lokasi dan fase yang bisa dipakai untuk mengambil materi.</p>
          </div>
        ) : visibleResources.length === 0 ? (
          <div className={styles.emptyState}>
            <Search size={28} />
            <h3>Tidak ada resource yang cocok</h3>
            <p>Coba ubah bulan, mapel, atau kata kunci pencarian.</p>
          </div>
        ) : (
          <div className={styles.resourceList}>
            {visibleResources.map(({ item, type }) => renderResourceCard(item, type))}
          </div>
        )}
      </section>
    </div>
  );
}
