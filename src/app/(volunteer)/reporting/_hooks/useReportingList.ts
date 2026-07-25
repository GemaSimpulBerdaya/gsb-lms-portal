import { useCallback, useEffect, useState } from "react";
import { getCurrentSemester } from "@/utils/formatters";
import type { Report, Schedule, Toast } from "../_lib/reportingTypes";

const getReportsPerPage = () => {
  if (typeof window === "undefined") return 12;
  return window.matchMedia("(max-width: 640px)").matches ? 10 : 12;
};

type UseReportingListArgs = {
  setToast: (toast: Toast) => void;
};

export function useReportingList({ setToast }: UseReportingListArgs) {
  const [mounted, setMounted] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [keywordFilter, setKeywordFilter] = useState("");
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [reportsPerPage, setReportsPerPage] = useState(() => getReportsPerPage());
  const [selectedSemester, setSelectedSemester] = useState(() => {
    return getCurrentSemester();
  });

  const fetchReports = useCallback(async (pg = 1, append = false) => {
    setLoading(append ? false : true);
    if (!append && typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    try {
      const query = new URLSearchParams({
        page: pg.toString(),
        limit: reportsPerPage.toString(),
        semester: selectedSemester,
      });
      const selectedSchedule = schedules.find((schedule) => String(schedule._id) === String(searchQuery));
      if (selectedSchedule) {
        query.set("scheduleId", selectedSchedule._id);
        query.set("region", selectedSchedule.region);
        query.set("fase", selectedSchedule.fase);
      }
      if (monthFilter) {
        query.set("month", monthFilter);
      }
      if (keywordFilter.trim()) {
        query.set("q", keywordFilter.trim());
      }

      const res = await fetch(`/api/reports/me?${query.toString()}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setReports((prev) => (append ? [...prev, ...data.reports] : data.reports));
      setPage(data.page);
      setTotalPages(data.totalPages);
      setTotal(data.total);
    } catch {
      setToast({ type: "error", message: "Gagal memuat laporan. Silakan coba lagi." });
      setTimeout(() => setToast(null), 3500);
    } finally {
      setLoading(false);
    }
  }, [keywordFilter, monthFilter, reportsPerPage, schedules, searchQuery, selectedSemester, setToast]);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      if (res.ok) {
        const data = await res.json();
        setSchedules(data.schedules || []);
      }
    } catch (err) {
      console.error("Gagal memuat jadwal:", err);
    }
  }, []);

  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/settings/public");
        if (res.ok) {
          const data = await res.json();
          if (data.activeSemester) {
            setSelectedSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };

    fetchGlobalSemester();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setMounted(true);
      fetchSchedules();
    }, 30);
    return () => clearTimeout(timer);
  }, [fetchSchedules]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchReports(1, false);
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchReports]);

  useEffect(() => {
    const updateReportsPerPage = () => {
      setReportsPerPage(getReportsPerPage());
    };

    window.addEventListener("resize", updateReportsPerPage);
    return () => window.removeEventListener("resize", updateReportsPerPage);
  }, []);

  const isReadOnly = false;
  const selectedScheduleFilter = schedules.find((schedule) => String(schedule._id) === String(searchQuery));
  const selectedScheduleLabel = selectedScheduleFilter
    ? `${selectedScheduleFilter.region} - ${selectedScheduleFilter.fase}`
    : "";

  return {
    mounted,
    reports,
    setReports,
    loading,
    page,
    totalPages,
    total,
    setTotal,
    searchQuery,
    setSearchQuery,
    monthFilter,
    setMonthFilter,
    keywordFilter,
    setKeywordFilter,
    schedules,
    selectedSemester,
    setSelectedSemester,
    reportsPerPage,
    fetchReports,
    isReadOnly,
    selectedScheduleLabel,
  };
}
