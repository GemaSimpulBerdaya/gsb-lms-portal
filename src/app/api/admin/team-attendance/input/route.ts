import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import {
  TeamAccount,
  normalizeTeamMemberRole,
  type TeamMemberRole,
} from "@/models/TeamAccount";
import { Volunteer } from "@/models/Volunteer";
import { Schedule } from "@/models/Schedule";
import {
  TeamAttendance,
  TEAM_ATTENDANCE_STATUSES,
  type TeamAttendanceStatus,
} from "@/models/TeamAttendance";
import {
  checkAttendanceWindow,
  extractAuditMeta,
  formatWindowReason,
} from "@/lib/teamAttendance";

type MemberInput = {
  volunteerId: string;
  role: TeamMemberRole;
  status: TeamAttendanceStatus;
  notes?: string;
};

function isValidStatus(value: unknown): value is TeamAttendanceStatus {
  return (
    typeof value === "string" &&
    (TEAM_ATTENDANCE_STATUSES as string[]).includes(value)
  );
}

async function getContext(scheduleId: string, week: number) {
  const schedule = await Schedule.findById(scheduleId).lean();
  if (!schedule) return { error: "Jadwal tidak ditemukan", status: 404 } as const;

  const kbm = (
    schedule as {
      kbmDates?: { week: number; date: Date; petugas?: unknown[] }[];
    }
  ).kbmDates?.find((item) => item.week === week);
  if (!kbm) {
    return {
      error: `Pekan ${week} tidak ditemukan di jadwal ini`,
      status: 404,
    } as const;
  }

  const teamAccountId = String(
    (schedule as { teamAccountId: unknown }).teamAccountId,
  );
  const team = await TeamAccount.findById(teamAccountId)
    .select({ members: 1 })
    .lean();
  if (!team) return { error: "Akun tim tidak ditemukan", status: 404 } as const;

  const allMembers =
    (
      team as {
        members?: { volunteerId: unknown; role: TeamMemberRole; joinedAt?: Date }[];
      }
    ).members ?? [];
  const scheduledIds = new Set((kbm.petugas ?? []).map(String));
  const rawMembers = scheduledIds.size
    ? allMembers.filter((member) => scheduledIds.has(String(member.volunteerId)))
    : allMembers;
  const volunteerIds = rawMembers.map((member) => String(member.volunteerId));
  const volunteers = await Volunteer.find({ _id: { $in: volunteerIds } })
    .select({ name: 1 })
    .lean();
  const names = new Map(volunteers.map((item) => [String(item._id), item.name]));

  return {
    schedule,
    kbm,
    teamAccountId,
    members: rawMembers.map((member) => ({
      volunteerId: String(member.volunteerId),
      role: normalizeTeamMemberRole(member.role) ?? "FASILITATOR",
      joinedAt: member.joinedAt,
      name: names.get(String(member.volunteerId)) ?? "(tanpa nama)",
    })),
  };
}

export const GET = withAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId") ?? "";
    const week = Number(searchParams.get("week"));
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return NextResponse.json({ error: "scheduleId tidak valid" }, { status: 400 });
    }
    if (!Number.isFinite(week) || week < 1) {
      return NextResponse.json({ error: "week harus angka >= 1" }, { status: 400 });
    }

    await connectDB();
    const context = await getContext(scheduleId, week);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }
    const window = checkAttendanceWindow(new Date(context.kbm.date));
    const records = await TeamAttendance.find({
      teamAccountId: context.teamAccountId,
      scheduleId,
      week,
      date: context.kbm.date,
    }).lean();

    return NextResponse.json({
      schedule: {
        id: scheduleId,
        semester: (context.schedule as { semester: string }).semester,
        kbmDate: context.kbm.date,
        week,
      },
      window: {
        inWindow: window.inWindow,
        reason: window.reason,
        earliest: window.earliest,
        message: formatWindowReason(window),
      },
      members: context.members,
      records,
    });
  } catch (error) {
    console.error("GET /api/admin/team-attendance/input error:", error);
    return NextResponse.json(
      { error: "Gagal memuat form Presensi Relawan" },
      { status: 500 },
    );
  }
});

export const POST = withAdmin(async (request, user) => {
  try {
    const body = (await request.json()) as {
      scheduleId?: string;
      week?: number;
      members?: MemberInput[];
    };
    const scheduleId = String(body.scheduleId ?? "");
    const week = Number(body.week);
    if (!mongoose.Types.ObjectId.isValid(scheduleId)) {
      return NextResponse.json({ error: "scheduleId tidak valid" }, { status: 400 });
    }
    if (!Number.isFinite(week) || week < 1) {
      return NextResponse.json({ error: "week harus angka >= 1" }, { status: 400 });
    }
    if (!Array.isArray(body.members) || body.members.length === 0) {
      return NextResponse.json({ error: "members tidak boleh kosong" }, { status: 400 });
    }

    await connectDB();
    const context = await getContext(scheduleId, week);
    if ("error" in context) {
      return NextResponse.json({ error: context.error }, { status: context.status });
    }
    const window = checkAttendanceWindow(new Date(context.kbm.date));
    if (!window.inWindow && window.reason === "TOO_EARLY") {
      return NextResponse.json(
        {
          error: "WINDOW_NOT_OPEN",
          message: formatWindowReason(window),
          earliest: window.earliest,
        },
        { status: 403 },
      );
    }

    const allowedIds = new Set(
      context.members.map((member) => member.volunteerId),
    );
    for (const member of body.members) {
      const role = normalizeTeamMemberRole(member.role);
      if (
        !mongoose.Types.ObjectId.isValid(member.volunteerId) ||
        !allowedIds.has(member.volunteerId)
      ) {
        return NextResponse.json(
          { error: `Relawan ${member.volunteerId} tidak bertugas di pertemuan ini` },
          { status: 400 },
        );
      }
      if (!role || !isValidStatus(member.status)) {
        return NextResponse.json(
          { error: `Status atau peran tidak valid untuk ${member.volunteerId}` },
          { status: 400 },
        );
      }
      member.role = role;
    }

    const markedAt = new Date();
    const { ip, userAgent } = extractAuditMeta(request);
    for (const member of body.members) {
      const filter = {
        teamAccountId: new mongoose.Types.ObjectId(context.teamAccountId),
        scheduleId: new mongoose.Types.ObjectId(scheduleId),
        week,
        date: new Date(context.kbm.date),
        volunteerId: new mongoose.Types.ObjectId(member.volunteerId),
      };
      const existing = await TeamAttendance.findOne(filter);
      if (existing) {
        const changed =
          existing.status !== member.status ||
          (existing.notes ?? "") !== (member.notes ?? "");
        if (!changed) continue;
        existing.editHistory.push({
          at: markedAt,
          by: new mongoose.Types.ObjectId(user.id),
          prevStatus: existing.status,
          newStatus: member.status,
          prevNotes: existing.notes,
          newNotes: member.notes ?? "",
          ip,
          userAgent,
        });
        existing.status = member.status;
        existing.notes = member.notes ?? "";
        existing.role = member.role;
        existing.markedBy = new mongoose.Types.ObjectId(user.id);
        existing.markedAt = markedAt;
        existing.markedFromIp = ip;
        existing.userAgent = userAgent;
        await existing.save();
      } else {
        await TeamAttendance.create({
          ...filter,
          semester: (context.schedule as { semester: string }).semester,
          role: member.role,
          status: member.status,
          notes: member.notes ?? "",
          markedBy: new mongoose.Types.ObjectId(user.id),
          markedAt,
          markedFromIp: ip,
          userAgent,
          editHistory: [],
        });
      }
    }

    return NextResponse.json({
      message: `Presensi relawan tersimpan: ${body.members.length} anggota`,
    });
  } catch (error) {
    console.error("POST /api/admin/team-attendance/input error:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan Presensi Relawan" },
      { status: 500 },
    );
  }
});
