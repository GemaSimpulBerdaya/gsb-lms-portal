"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./teamAttendance.module.css";
import {
  getCurrentSemester,
  formatSemester,
  dateToIso,
  formatKbmDateShort,
  isFutureDate,
} from "@/utils/formatters";
import { useSemesterLabels } from "@/hooks/useSemesterLabels";
import TeamAttendanceBlock from "@/components/volunteer/TeamAttendanceBlock";

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
        <div style={{ padding: 40, textAlign: "center" }}>Memuat...</div>
      }
    >
      <TeamAttendanceContent />
    </Suspense>
  );
}

function TeamAttendanceContent() {
  const semesterLabels = useSemesterLabels();
  const searchParams = useSearchParams();
  const qsScheduleId = searchParams.get("scheduleId");
  const qsWeek = searchParams.get("week");
  const qsDate = searchParams.get("date");

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [week, setWeek] = useState<number>(qsWeek ? parseInt(qsWeek, 10) : 1);
  const [date, setDate] = useState(() => qsDate || dateToIso(new Date()));
  const [semester, setSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);

  const fetchSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/volunteer/schedule");
      const data = await res.json();
      if (res.ok && data.schedules) {
        setSchedules(data.schedules);
        const derived = Array.from(new Set([...data.schedules.map((s: Schedule) => s.semester), getCurrentSemester()])).sort().reverse();
        setAvailableSemesters(derived);
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
          const stored = localStorage.getItem("activeSemester");
          if (
            data.activeSemester &&
            (!stored || stored === getCurrentSemester())
          ) {
            setSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };

    fetchGlobalSemester();
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
    const activeSchedules = schedules.filter((s) => s.semester === semester);

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
      const fromQuery = activeSchedules.find((s) => s._id === qsScheduleId);
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

    if (activeSchedules.length > 0) {
      const current = activeSchedules[0];
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
  }, [semester, schedules, qsScheduleId, qsWeek]);

  const sched = schedules.find((s) => s._id === selectedScheduleId);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Presensi Tim Relawan</h1>
        <p className={styles.subtitle}>
          Catat kehadiran tiap anggota tim per pertemuan KBM. Dokumentasi KBM
          bisa dilengkapi terpisah.
        </p>
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label className={styles.label}>Jadwal Mengajar</label>
          <select
            className={styles.select}
            value={selectedScheduleId}
            onChange={(e) => {
              setSelectedScheduleId(e.target.value);
              const s = schedules.find((x) => x._id === e.target.value);
              if (s) {
                setSemester(s.semester);
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
          >
            <option value="">-- Pilih Jadwal --</option>
            {schedules.map((s) => (
              <option key={s._id} value={s._id}>
                {s.region} — {s.fase}
              </option>
            ))}
          </select>
        </div>

        {availableSemesters.length > 1 && (
          <div className={styles.filterGroup}>
            <label className={styles.label}>Semester</label>
            <select
              className={styles.select}
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
            >
              {availableSemesters.length > 0 ? (
                availableSemesters.map((sem) => (
                  <option key={sem} value={sem}>
                    {formatSemester(sem, semesterLabels)}
                  </option>
                ))
              ) : (
                <option value={semester}>
                  {formatSemester(semester, semesterLabels)}
                </option>
              )}
            </select>
          </div>
        )}

        <div className={styles.filterGroup}>
          <label className={styles.label}>Pertemuan</label>
          <select
            className={styles.select}
            value={
              selectedScheduleId && week && date ? `${week}|${date}` : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              const [w, d] = v.split("|");
              setWeek(parseInt(w, 10));
              setDate(d);
            }}
            disabled={!selectedScheduleId}
          >
            {(() => {
              const list = sched?.kbmDates ?? [];
              if (!sched) return <option value="">-- Pilih jadwal dulu --</option>;
              if (list.length === 0)
                return <option value="">-- Belum ada pertemuan --</option>;
              const sorted = [...list].sort(
                (a, b) =>
                  new Date(a.date).getTime() - new Date(b.date).getTime(),
              );
              const monthFmt = new Intl.DateTimeFormat("id-ID", {
                timeZone: "Asia/Jakarta",
                month: "long",
                year: "numeric",
              });
              const groups: { month: string; items: typeof sorted }[] = [];
              for (const k of sorted) {
                const monthLabel = monthFmt.format(new Date(k.date));
                const last = groups[groups.length - 1];
                if (last && last.month === monthLabel) last.items.push(k);
                else groups.push({ month: monthLabel, items: [k] });
              }
              return (
                <>
                  <option value="">-- Pilih Pertemuan --</option>
                  {groups.map((g) => (
                    <optgroup key={g.month} label={g.month}>
                      {g.items.map((k) => {
                        const iso = dateToIso(k.date);
                        const future = isFutureDate(k.date);
                        return (
                          <option
                            key={`${k.week}-${iso}`}
                            value={`${k.week}|${iso}`}
                            disabled={future}
                          >
                            Pekan {k.week} · {formatKbmDateShort(k.date)}
                            {future ? " · belum mulai" : ""}
                          </option>
                        );
                      })}
                    </optgroup>
                  ))}
                </>
              );
            })()}
          </select>
        </div>
      </div>

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
