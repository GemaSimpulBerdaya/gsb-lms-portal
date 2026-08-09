"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import TeamAttendanceBlock from "@/components/volunteer/TeamAttendanceBlock";
import Spinner from "@/components/ui/Spinner/Spinner";
import { dateToIso, formatKbmDateShort, isFutureDate, limitToStartedMeetings } from "@/utils/formatters";
import styles from "./AdminTeamAttendanceInput.module.css";

type KbmDate = { week: number; date: string; topic?: string };
type Schedule = {
  _id: string;
  teamAccountId: string;
  region: string;
  fase: string;
  semester: string;
  kbmDates?: KbmDate[];
};

interface Props {
  semester: string;
  semesterOptions: { value: string; label: string }[];
  onSemesterChange: (semester: string) => void;
}

export default function AdminTeamAttendanceInput({
  semester,
  semesterOptions,
  onSemesterChange,
}: Props) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleId, setScheduleId] = useState("");
  const [meetingValue, setMeetingValue] = useState("");

  const fetchSchedules = useCallback(async () => {
    if (!semester) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/schedules?semester=${encodeURIComponent(semester)}`);
      const body = await res.json();
      setSchedules(res.ok && Array.isArray(body.schedules) ? body.schedules : []);
    } catch {
      setSchedules([]);
    } finally {
      setLoading(false);
    }
  }, [semester]);

  useEffect(() => {
    const timer = setTimeout(fetchSchedules, 0);
    return () => clearTimeout(timer);
  }, [fetchSchedules]);

  useEffect(() => {
    setScheduleId("");
    setMeetingValue("");
  }, [semester]);

  const selectedSchedule = schedules.find((item) => item._id === scheduleId);
  const meetingOptions = useMemo(
    () =>
      limitToStartedMeetings(selectedSchedule?.kbmDates ?? []).map((meeting) => {
        const date = dateToIso(meeting.date);
        const future = isFutureDate(meeting.date);
        return {
          value: `${meeting.week}|${date}`,
          label: `Pekan ${meeting.week} · ${formatKbmDateShort(meeting.date)}${meeting.topic ? ` · ${meeting.topic}` : ""}${future ? " · belum mulai" : ""}`,
          disabled: future,
        };
      }),
    [selectedSchedule],
  );
  const selectedWeek = Number(meetingValue.split("|")[0]);

  return (
    <section className={styles.section}>
      <div className={styles.heading}>
        <div>
          <h2>Input Presensi Relawan</h2>
          <p>Admin mencatat presensi berdasarkan petugas yang dipilih di jadwal pertemuan.</p>
        </div>
      </div>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label>Semester</label>
          <AdminFilterSelect
            width="fluid"
            value={semester}
            onChange={onSemesterChange}
            options={semesterOptions}
          />
        </div>
        <div className={styles.field}>
          <label>Jadwal</label>
          <AdminFilterSelect
            width="fluid"
            value={scheduleId}
            onChange={(value) => {
              setScheduleId(value);
              setMeetingValue("");
            }}
            placeholder={loading ? "Memuat jadwal..." : "Pilih jadwal"}
            disabled={loading || !semester}
            options={schedules.map((schedule) => ({
              value: schedule._id,
              label: `${schedule.region} · ${schedule.fase}`,
            }))}
          />
        </div>
        <div className={styles.field}>
          <label>Pertemuan</label>
          <AdminFilterSelect
            width="fluid"
            value={meetingValue}
            onChange={setMeetingValue}
            placeholder={!scheduleId ? "Pilih jadwal dulu" : "Pilih pertemuan"}
            disabled={!scheduleId}
            options={meetingOptions}
          />
        </div>
        {loading && <Spinner size="sm" />}
      </div>

      {scheduleId && selectedWeek > 0 ? (
        <TeamAttendanceBlock scheduleId={scheduleId} week={selectedWeek} />
      ) : (
        <div className={styles.empty}>Pilih jadwal dan pertemuan untuk mulai input Presensi Relawan.</div>
      )}
    </section>
  );
}
