"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Spinner from "@/components/ui/Spinner/Spinner";
import { useSearchParams } from "next/navigation";
import styles from "./teamAttendance.module.css";
import {
  getCurrentSemester,
  dateToIso,
  formatSemester,
  formatKbmDateShort,
  isFutureDate,
  limitToStartedMeetings,
} from "@/utils/formatters";
import TeamAttendanceBlock from "@/components/volunteer/TeamAttendanceBlock";
import VolunteerFilterSelect from "@/components/volunteer/VolunteerFilterSelect/VolunteerFilterSelect";
import VolunteerFilterPanel from "@/components/volunteer/VolunteerFilterPanel/VolunteerFilterPanel";

type KbmDate = {
  week: number;
  date: string;
  topic?: string;
};

type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  kbmDates?: KbmDate[];
};

export default function TeamAttendancePage() {
  return (
    <Suspense
      fallback={
        <div className={styles.loading}>
          <Spinner />
          <p>Memuat...</p>
        </div>
      }
    >
      <TeamAttendanceContent />
    </Suspense>
  );
}

function TeamAttendanceContent() {
  const searchParams = useSearchParams();
  const qsScheduleId = searchParams.get("scheduleId");
  const qsWeek = searchParams.get("week");
  const qsDate = searchParams.get("date");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [week, setWeek] = useState<number>(qsWeek ? parseInt(qsWeek, 10) : 1);
  const [date, setDate] = useState(() => qsDate || dateToIso(new Date()));
  const [semester, setSemester] = useState(() => {
    return getCurrentSemester();
  });

  const availableSchedules = useMemo(
    () => schedules.filter((schedule) => schedule.semester === semester),
    [schedules, semester],
  );
  const selectedSchedule = schedules.find(
    (schedule) => schedule._id === selectedScheduleId,
  );
  const meetingOptions = useMemo(() => {
    const meetings = selectedSchedule?.kbmDates ?? [];
    const monthFormatter = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      month: "long",
      year: "numeric",
    });

    // Hanya pekan yang sudah mulai + 1 pekan terdekat berikutnya (disabled) —
    // sembunyikan sisa pekan future biar dropdown gak panjang.
    return limitToStartedMeetings(meetings).map((meeting) => {
      const isoDate = dateToIso(meeting.date);
      const isFuture = isFutureDate(meeting.date);
      return {
        value: `${meeting.week}|${isoDate}`,
        label: `${monthFormatter.format(new Date(meeting.date))} — Pekan ${meeting.week} · ${formatKbmDateShort(meeting.date)}${isFuture ? " · belum mulai" : ""}`,
        disabled: isFuture,
      };
    });
  }, [selectedSchedule]);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      const data = await res.json();
      if (res.ok && data.schedules) {
        setSchedules(data.schedules);
      }
    } catch (err) {
      console.error("Gagal memuat jadwal", err);
    }
  }, []);

  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.activeSemester) {
            setSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal load setting global", err);
      }
    };
    fetchGlobalSemester();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => fetchSchedules(), 0);
    return () => clearTimeout(timer);
  }, [fetchSchedules]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", semester);
    }
  }, [semester]);

  useEffect(() => {
    if (schedules.length === 0) return;
    const pickDefault = (sched: Schedule) => {
      const kbm = sched.kbmDates ?? [];
      const target =
        kbm.find((k) => k.week === sched.activeWeek) ?? kbm[0];
      if (target) {
        return { w: target.week, d: dateToIso(target.date) };
      }
      return null;
    };

    if (qsScheduleId) {
      const fromQuery = availableSchedules.find((s) => s._id === qsScheduleId);
      if (fromQuery) {
        setSelectedScheduleId(fromQuery._id);
        if (!qsWeek) {
          const def = pickDefault(fromQuery);
          if (def) {
            setWeek(def.w);
            setDate(def.d);
          } else {
            setWeek(fromQuery.activeWeek || 1);
          }
        }
        return;
      }
    }

    if (availableSchedules.length > 0) {
      const current = availableSchedules[0];
      setSelectedScheduleId(current._id);
      const def = pickDefault(current);
      if (def) {
        setWeek(def.w);
        setDate(def.d);
      } else {
        setWeek(current.activeWeek || 1);
      }
    } else {
      setSelectedScheduleId("");
    }
  }, [availableSchedules, qsScheduleId, qsWeek, schedules.length]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Presensi Tim Relawan</h1>
        <p className={styles.subtitle}>
          Catat kehadiran tiap anggota tim per pertemuan KBM. Dokumentasi KBM
          bisa dilengkapi terpisah.
        </p>
      </div>

      <VolunteerFilterPanel
        title="Filter Kehadiran Tim"
        description={`Semester aktif: ${formatSemester(semester)}`}
      >
        <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.label}>
            Jadwal Mengajar ({availableSchedules.length})
          </label>
          <VolunteerFilterSelect
            options={availableSchedules.map((schedule) => ({
              value: schedule._id,
              label: `${schedule.region} — ${schedule.fase}`,
            }))}
            value={selectedScheduleId}
            placeholder="-- Pilih Jadwal --"
            onChange={(scheduleId) => {
              setSelectedScheduleId(scheduleId);
              const s = schedules.find((x) => x._id === scheduleId);
              if (s) {
                const kbm = s.kbmDates ?? [];
                const target =
                  kbm.find((k) => k.week === s.activeWeek) ?? kbm[0];
                if (target) {
                  setWeek(target.week);
                  setDate(dateToIso(target.date));
                } else {
                  setWeek(s.activeWeek || 1);
                }
              }
            }}
          />
        </div>

        <div className={styles.filterGroup}>
          <label className={styles.label}>Pertemuan</label>
          <VolunteerFilterSelect
            options={meetingOptions}
            value={
              selectedScheduleId && week && date ? `${week}|${date}` : ""
            }
            placeholder={
              !selectedScheduleId
                ? "-- Pilih jadwal dulu --"
                : meetingOptions.length === 0
                  ? "-- Belum ada pertemuan --"
                  : "-- Pilih Pertemuan --"
            }
            onChange={(meetingValue) => {
              const [w, d] = meetingValue.split("|");
              setWeek(parseInt(w, 10));
              setDate(d);
            }}
            disabled={!selectedScheduleId}
          />
        </div>
        </div>
      </VolunteerFilterPanel>

      {selectedScheduleId && week ? (
        <TeamAttendanceBlock
          scheduleId={selectedScheduleId}
          week={week}
        />
      ) : (
        <div className={styles.empty}>
          Pilih jadwal dan pertemuan untuk mulai mencatat kehadiran tim.
        </div>
      )}
    </div>
  );
}
