import { Types } from "mongoose";
import { Schedule } from "@/models/Schedule";
import type { IKbmDate } from "@/models/Schedule";
import { dateToIso, formatKbmDate, isFutureDate } from "@/utils/formatters";

/**
 * Parse skor dari body request. Ketat:
 *  - `null` / `""` / non-number-non-string DITOLAK (return null), bukan
 *    di-coerce jadi 0 — mencegah PUT dengan `score: null` menimpa nilai
 *    tersimpan dengan 0 secara diam-diam.
 *  - `max` mengikuti maxScore per-record untuk UAS (bisa != 100).
 */
export function parseScore(value: unknown, max = 100): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const score = Number(value);
  return Number.isFinite(score) && score >= 0 && score <= max ? score : null;
}

const NO_MEETINGS_ERROR =
  "Jadwal ini belum memiliki daftar pertemuan. Lengkapi tanggal pertemuan (KBM) di halaman Jadwal terlebih dahulu.";

/**
 * Ambil jadwal milik tim + cek semester. Dipakai bersama oleh validasi
 * pertemuan mingguan dan validasi jendela UAS supaya aturan ownership /
 * semester tidak duplikat dan tidak bisa drift.
 * Return: pesan error (string) atau daftar kbmDates yang dijamin non-empty.
 */
async function loadOwnedSchedule({
  scheduleId,
  teamAccountId,
  semester,
}: {
  scheduleId: unknown;
  teamAccountId: string;
  semester: string;
}): Promise<string | IKbmDate[]> {
  if (typeof scheduleId !== "string" || !Types.ObjectId.isValid(scheduleId)) {
    return "Jadwal wajib dipilih";
  }

  const schedule = await Schedule.findOne({ _id: scheduleId, teamAccountId })
    .select("semester kbmDates")
    .lean();
  if (!schedule) return "Jadwal tidak ditemukan atau bukan milik tim ini";
  if (schedule.semester !== semester) return "Semester penilaian tidak sesuai jadwal";

  const kbmDates = schedule.kbmDates ?? [];
  if (kbmDates.length === 0) return NO_MEETINGS_ERROR;

  return kbmDates;
}

/**
 * Validasi nilai mingguan (TUGAS / TUGAS_SNBT / TRYOUT): pertemuan `week`
 * harus terdaftar di kbmDates jadwal milik tim DAN tanggalnya sudah tercapai.
 * `week` yang divalidasi harus nilai yang sama dengan yang dipersist caller.
 */
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
  const parsedWeek = Number(week);
  if (!Number.isInteger(parsedWeek) || parsedWeek < 1) return "Pekan tidak valid";

  const kbmDates = await loadOwnedSchedule({ scheduleId, teamAccountId, semester });
  if (typeof kbmDates === "string") return kbmDates;

  const meeting = kbmDates.find((item) => item.week === parsedWeek);
  if (!meeting) return "Pertemuan tidak ditemukan di jadwal";
  if (isFutureDate(meeting.date)) {
    return `Pertemuan pekan ${parsedWeek} belum dimulai`;
  }

  return null;
}

/**
 * Validasi jendela input UAS: nilai UAS baru bisa diisi setelah tanggal
 * pertemuan TERAKHIR pada jadwal tercapai (akhir semester). UAS tidak
 * terikat pekan tertentu, jadi tidak memakai `week`.
 */
export async function validateUasWindow({
  scheduleId,
  teamAccountId,
  semester,
}: {
  scheduleId: unknown;
  teamAccountId: string;
  semester: string;
}): Promise<string | null> {
  const kbmDates = await loadOwnedSchedule({ scheduleId, teamAccountId, semester });
  if (typeof kbmDates === "string") return kbmDates;

  const lastMeeting = kbmDates.reduce((latest, item) =>
    dateToIso(item.date) > dateToIso(latest.date) ? item : latest
  );
  if (isFutureDate(lastMeeting.date)) {
    return `Nilai UAS baru bisa diisi mulai pertemuan terakhir, ${formatKbmDate(lastMeeting.date)}`;
  }

  return null;
}
