import { Types } from "mongoose";
import { Schedule } from "@/models/Schedule";
import { dateToIso } from "@/utils/formatters";

export function parseScore(value: unknown, max = 100): number | null {
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= max ? score : null;
}

export async function validateEvaluationMeeting({
  scheduleId,
  teamAccountId,
  semester,
  week,
}: {
  scheduleId: unknown;
  teamAccountId: string;
  semester: string;
  week: unknown;
}): Promise<string | null> {
  if (typeof scheduleId !== "string" || !Types.ObjectId.isValid(scheduleId)) {
    return "Jadwal wajib dipilih";
  }

  const parsedWeek = Number(week);
  if (!Number.isInteger(parsedWeek) || parsedWeek < 1) return "Pekan tidak valid";

  const schedule = await Schedule.findOne({ _id: scheduleId, teamAccountId })
    .select("semester kbmDates")
    .lean();
  if (!schedule) return "Jadwal tidak ditemukan atau bukan milik tim ini";
  if (schedule.semester !== semester) return "Semester penilaian tidak sesuai jadwal";

  const meeting = schedule.kbmDates?.find((item) => item.week === parsedWeek);
  if (!meeting) return "Pertemuan tidak ditemukan di jadwal";
  if (dateToIso(meeting.date) > dateToIso(new Date())) {
    return `Pertemuan pekan ${parsedWeek} belum dimulai`;
  }

  return null;
}
