import mongoose, { type ClientSession } from "mongoose";
import { Schedule } from "@/models/Schedule";
import { TeamAttendance } from "@/models/TeamAttendance";
import { Volunteer } from "@/models/Volunteer";

interface AssignmentMeeting {
  week: number;
  petugas?: readonly unknown[];
}

interface AssignmentSchedule {
  region: string;
  fase: string;
  kbmDates?: AssignmentMeeting[];
}

export function removeVolunteerAssignment(
  schedule: { kbmDates?: AssignmentMeeting[] },
  week: number,
  volunteerId: string
): boolean {
  const meeting = schedule.kbmDates?.find((item) => item.week === week);
  if (!meeting) return false;

  const current = meeting.petugas ?? [];
  const next = current.filter((id) => String(id) !== volunteerId);
  if (next.length === current.length) return false;

  meeting.petugas = next;
  return true;
}

export interface VolunteerWeekConflict {
  volunteerId: string;
  volunteerName: string;
  week: number;
  region: string;
  fase: string;
}

export interface VolunteerAssignmentMove {
  volunteerId: string;
  week: number;
  sourceScheduleId: string;
}

export class ScheduleAssignmentError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

export function normalizeAssignmentMoves(raw: unknown): VolunteerAssignmentMove[] {
  if (raw == null) return [];
  if (!Array.isArray(raw)) {
    throw new ScheduleAssignmentError("Data pemindahan relawan tidak valid", 400);
  }

  const unique = new Map<string, VolunteerAssignmentMove>();
  for (const item of raw) {
    const move = item as Partial<VolunteerAssignmentMove>;
    const volunteerId = String(move.volunteerId ?? "");
    const sourceScheduleId = String(move.sourceScheduleId ?? "");
    const week = Number(move.week);
    if (
      !mongoose.Types.ObjectId.isValid(volunteerId) ||
      !mongoose.Types.ObjectId.isValid(sourceScheduleId) ||
      !Number.isInteger(week) ||
      week < 1
    ) {
      throw new ScheduleAssignmentError("Data pemindahan relawan tidak valid", 400);
    }
    unique.set(`${volunteerId}:${week}:${sourceScheduleId}`, {
      volunteerId,
      week,
      sourceScheduleId,
    });
  }
  return [...unique.values()];
}

export async function applyVolunteerAssignmentMoves({
  moves,
  targetMeetings,
  semester,
  targetScheduleId,
  session,
}: {
  moves: VolunteerAssignmentMove[];
  targetMeetings: AssignmentMeeting[];
  semester: string;
  targetScheduleId?: string;
  session: ClientSession;
}): Promise<void> {
  for (const move of moves) {
    const assignedAtTarget = targetMeetings.some(
      (meeting) =>
        meeting.week === move.week &&
        (meeting.petugas ?? []).some((id) => String(id) === move.volunteerId)
    );
    if (!assignedAtTarget) {
      throw new ScheduleAssignmentError(
        "Relawan tujuan pemindahan tidak ditemukan di jadwal baru",
        400
      );
    }
    if (move.sourceScheduleId === targetScheduleId) {
      throw new ScheduleAssignmentError("Jadwal asal dan tujuan tidak boleh sama", 400);
    }

    const attendanceExists = await TeamAttendance.exists({
      scheduleId: move.sourceScheduleId,
      week: move.week,
      volunteerId: move.volunteerId,
    }).session(session);
    if (attendanceExists) {
      throw new ScheduleAssignmentError(
        `Relawan tidak bisa dipindahkan dari pekan ${move.week} karena Presensi pada jadwal asal sudah tersimpan.`
      );
    }

    const result = await Schedule.updateOne(
      {
        _id: move.sourceScheduleId,
        semester,
        kbmDates: {
          $elemMatch: {
            week: move.week,
            petugas: new mongoose.Types.ObjectId(move.volunteerId),
          },
        },
      },
      {
        $pull: {
          "kbmDates.$[meeting].petugas": new mongoose.Types.ObjectId(
            move.volunteerId
          ),
        },
      },
      {
        arrayFilters: [{ "meeting.week": move.week }],
        session,
      }
    );
    if (result.modifiedCount !== 1) {
      throw new ScheduleAssignmentError(
        `Penugasan asal relawan pada pekan ${move.week} tidak ditemukan. Muat ulang jadwal lalu coba lagi.`
      );
    }
  }
}

export function findVolunteerWeekConflict(
  meetings: AssignmentMeeting[],
  schedules: AssignmentSchedule[]
): Omit<VolunteerWeekConflict, "volunteerName"> | null {
  const requestedByWeek = new Map<number, Set<string>>();
  for (const meeting of meetings) {
    requestedByWeek.set(
      meeting.week,
      new Set((meeting.petugas ?? []).map(String))
    );
  }

  for (const schedule of schedules) {
    for (const meeting of schedule.kbmDates ?? []) {
      const requestedIds = requestedByWeek.get(meeting.week);
      if (!requestedIds) continue;

      const volunteerId = (meeting.petugas ?? [])
        .map(String)
        .find((id) => requestedIds.has(id));
      if (volunteerId) {
        return {
          volunteerId,
          week: meeting.week,
          region: schedule.region,
          fase: schedule.fase,
        };
      }
    }
  }

  return null;
}

export async function findSavedVolunteerWeekConflict({
  semester,
  meetings,
  excludeScheduleId,
  session,
}: {
  semester: string;
  meetings: AssignmentMeeting[];
  excludeScheduleId?: string;
  session?: ClientSession;
}): Promise<VolunteerWeekConflict | null> {
  const volunteerIds = Array.from(
    new Set(meetings.flatMap((meeting) => (meeting.petugas ?? []).map(String)))
  ).filter((id) => mongoose.Types.ObjectId.isValid(id));
  if (volunteerIds.length === 0) return null;

  const query: Record<string, unknown> = {
    semester,
    "kbmDates.petugas": {
      $in: volunteerIds.map((id) => new mongoose.Types.ObjectId(id)),
    },
  };
  if (excludeScheduleId) query._id = { $ne: excludeScheduleId };

  const scheduleQuery = Schedule.find(query)
    .select({ region: 1, fase: 1, kbmDates: 1 })
    .lean<AssignmentSchedule[]>();
  if (session) scheduleQuery.session(session);
  const schedules = await scheduleQuery;
  const conflict = findVolunteerWeekConflict(meetings, schedules);
  if (!conflict) return null;

  const volunteerQuery = Volunteer.findById(conflict.volunteerId)
    .select({ name: 1 })
    .lean<{ name?: string }>();
  if (session) volunteerQuery.session(session);
  const volunteer = await volunteerQuery;

  return {
    ...conflict,
    volunteerName: volunteer?.name || "Relawan",
  };
}

export function volunteerWeekConflictMessage(
  conflict: VolunteerWeekConflict
): string {
  return `${conflict.volunteerName} sudah bertugas di jadwal ${conflict.region} - ${conflict.fase} pada pekan ${conflict.week}. Satu relawan hanya boleh memiliki satu jadwal per pekan.`;
}
