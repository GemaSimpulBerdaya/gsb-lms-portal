import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { Relawan, TEAM_MEMBER_ROLES, type TeamMemberRole } from "@/models/Relawan";
import { Volunteer } from "@/models/Volunteer";
import { Schedule } from "@/models/Schedule";
import { Report } from "@/models/Report";
import {
  TeamAttendance,
  TEAM_ATTENDANCE_STATUSES,
  type TeamAttendanceStatus,
} from "@/models/TeamAttendance";
import { getSessionUser } from "@/lib/session";
import {
  checkAttendanceWindow,
  formatWindowReason,
  extractAuditMeta,
} from "@/lib/teamAttendance";

/**
 * Endpoint kehadiran tim untuk facilitator (PIC-led flow).
 *
 * GET  → preview state untuk satu pertemuan (window status, foto status,
 *        list anggota tim, record attendance yang sudah ada).
 * POST → bulk save attendance semua anggota tim untuk 1 pertemuan.
 *        Validasi L1 (time window), L2 (foto KBM ada), L3 (audit log push).
 */

interface MemberInput {
  volunteerId: string;
  role: TeamMemberRole;
  status: TeamAttendanceStatus;
  notes?: string;
}

function isValidStatus(s: unknown): s is TeamAttendanceStatus {
  return typeof s === "string" && (TEAM_ATTENDANCE_STATUSES as string[]).includes(s);
}
function isValidRole(s: unknown): s is TeamMemberRole {
  return typeof s === "string" && (TEAM_MEMBER_ROLES as string[]).includes(s);
}

/**
 * GET /api/volunteer/team-attendance?scheduleId=...&week=N
 * Preview state pertemuan + records existing.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "RELAWAN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduleId = searchParams.get("scheduleId");
    const week = Number(searchParams.get("week"));
    if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
      return NextResponse.json(
        { error: "scheduleId tidak valid" },
        { status: 400 },
      );
    }
    if (!Number.isFinite(week) || week < 1) {
      return NextResponse.json(
        { error: "week harus angka >= 1" },
        { status: 400 },
      );
    }

    await connectDB();

    const schedule = await Schedule.findById(scheduleId).lean();
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule tidak ditemukan" },
        { status: 404 },
      );
    }
    // Pastikan akun login adalah pemilik schedule.
    if (String((schedule as { relawanId: unknown }).relawanId) !== user.id) {
      return NextResponse.json(
        { error: "Akun ini bukan pemilik schedule" },
        { status: 403 },
      );
    }

    const kbm = (schedule as { kbmDates?: { week: number; date: Date }[] }).kbmDates?.find(
      (k) => k.week === week,
    );
    if (!kbm) {
      return NextResponse.json(
        { error: `Pekan ${week} tidak ditemukan di schedule ini` },
        { status: 404 },
      );
    }

    const window = checkAttendanceWindow(new Date(kbm.date));

    // Cek foto KBM (Layer 2). Treat photoUrl OR photoUrls[0] sebagai bukti.
    const reportWithPhoto = await Report.findOne({
      relawanId: user.id,
      scheduleId,
      semester: (schedule as { semester: string }).semester,
      $or: [
        { photoUrl: { $exists: true, $ne: "" } },
        { photoUrls: { $exists: true, $not: { $size: 0 } } },
      ],
      // Tanggal report harus sama dengan tanggal pertemuan ini.
      date: {
        $gte: new Date(new Date(kbm.date).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(kbm.date).setHours(23, 59, 59, 999)),
      },
    }).select({ _id: 1 });

    const team = await Relawan.findById(user.id)
      .select({ members: 1, teamName: 1, region: 1 })
      .lean();
    const rawMembers =
      ((team as { members?: { volunteerId: unknown; role: TeamMemberRole; joinedAt?: Date }[] })?.members ?? []);

    // Lookup nama dari registry sekali (server-side) supaya client tidak
    // perlu hit endpoint admin yang akan nolak akun volunteer.
    const volunteerIds = rawMembers.map((m) =>
      typeof m.volunteerId === "object" && m.volunteerId !== null
        ? (m.volunteerId as { toString(): string }).toString()
        : String(m.volunteerId),
    );
    const volunteerDocs = await Volunteer.find({
      _id: { $in: volunteerIds },
    })
      .select({ name: 1 })
      .lean();
    const nameByVolunteerId = new Map<string, string>();
    for (const v of volunteerDocs as { _id: unknown; name?: string }[]) {
      nameByVolunteerId.set(String(v._id), v.name ?? "");
    }
    const members = rawMembers.map((m) => ({
      volunteerId: String(m.volunteerId),
      role: m.role,
      joinedAt: m.joinedAt,
      name: nameByVolunteerId.get(String(m.volunteerId)) ?? "(tanpa nama)",
    }));

    const records = await TeamAttendance.find({
      relawanId: user.id,
      scheduleId,
      week,
      date: kbm.date,
    }).lean();

    return NextResponse.json({
      schedule: {
        id: String((schedule as { _id: unknown })._id),
        semester: (schedule as { semester: string }).semester,
        kbmDate: kbm.date,
        week,
      },
      window: {
        inWindow: window.inWindow,
        reason: window.reason,
        earliest: window.earliest,
        latest: window.latest,
        message: formatWindowReason(window),
      },
      photoUploaded: !!reportWithPhoto,
      members,
      records,
    });
  } catch (err) {
    console.error("GET /api/volunteer/team-attendance error:", err);
    return NextResponse.json(
      { error: "Gagal memuat preview kehadiran tim" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/volunteer/team-attendance
 * Body: { scheduleId, week, members: [{ volunteerId, role, status, notes? }] }
 *
 * Bulk upsert kehadiran tim untuk 1 pertemuan. Idempotent: kalau record sudah
 * ada (compound unique hit), diupdate dan editHistory di-push.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user || user.role !== "RELAWAN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { scheduleId, week, members } = body as {
      scheduleId?: string;
      week?: number;
      members?: MemberInput[];
    };

    if (!scheduleId || !mongoose.Types.ObjectId.isValid(scheduleId)) {
      return NextResponse.json(
        { error: "scheduleId tidak valid" },
        { status: 400 },
      );
    }
    if (typeof week !== "number" || week < 1) {
      return NextResponse.json(
        { error: "week harus angka >= 1" },
        { status: 400 },
      );
    }
    if (!Array.isArray(members) || members.length === 0) {
      return NextResponse.json(
        { error: "members harus array dan tidak boleh kosong" },
        { status: 400 },
      );
    }

    // Validasi tiap entry.
    for (const m of members) {
      if (!mongoose.Types.ObjectId.isValid(m.volunteerId)) {
        return NextResponse.json(
          { error: `volunteerId tidak valid: ${m.volunteerId}` },
          { status: 400 },
        );
      }
      if (!isValidRole(m.role)) {
        return NextResponse.json(
          { error: `Role tidak valid untuk ${m.volunteerId}` },
          { status: 400 },
        );
      }
      if (!isValidStatus(m.status)) {
        return NextResponse.json(
          { error: `Status tidak valid untuk ${m.volunteerId}` },
          { status: 400 },
        );
      }
    }

    await connectDB();

    // Re-validate ownership + ambil pertemuan.
    const schedule = await Schedule.findById(scheduleId).lean();
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule tidak ditemukan" },
        { status: 404 },
      );
    }
    if (String((schedule as { relawanId: unknown }).relawanId) !== user.id) {
      return NextResponse.json(
        { error: "Akun ini bukan pemilik schedule" },
        { status: 403 },
      );
    }

    const kbm = (schedule as { kbmDates?: { week: number; date: Date }[] }).kbmDates?.find(
      (k) => k.week === week,
    );
    if (!kbm) {
      return NextResponse.json(
        { error: `Pekan ${week} tidak ditemukan di schedule ini` },
        { status: 404 },
      );
    }
    const semester = (schedule as { semester: string }).semester;
    const kbmDate = new Date(kbm.date);

    // Pastikan tiap volunteerId di payload memang anggota tim ini (mencegah
    // input liar buat orang yang bukan anggota).
    const team = await Relawan.findById(user.id).select({ members: 1 }).lean();
    const memberSet = new Set<string>(
      ((team as { members?: { volunteerId: unknown }[] })?.members ?? []).map(
        (m) => String(m.volunteerId),
      ),
    );
    for (const m of members) {
      if (!memberSet.has(m.volunteerId)) {
        return NextResponse.json(
          {
            error: `Volunteer ${m.volunteerId} bukan anggota tim ini`,
          },
          { status: 400 },
        );
      }
    }

    // ── Layer 1: Time window ────────────────────────────────────
    // Cek window. Kalau ada record existing yang `unlockedByAdmin=true`,
    // bypass khusus untuk record tsb. Untuk simplifikasi: kalau salah satu
    // record di pertemuan ini sudah di-unlock admin, izinkan POST.
    const window = checkAttendanceWindow(kbmDate);
    let bypassWindow = false;
    if (!window.inWindow) {
      const unlocked = await TeamAttendance.findOne({
        relawanId: user.id,
        scheduleId,
        week,
        date: kbmDate,
        unlockedByAdmin: true,
      }).select({ _id: 1 });
      bypassWindow = !!unlocked;
    }
    if (!window.inWindow && !bypassWindow) {
      return NextResponse.json(
        {
          error: "WINDOW_CLOSED",
          reason: window.reason,
          message: formatWindowReason(window),
          earliest: window.earliest,
          latest: window.latest,
        },
        { status: 403 },
      );
    }

    // ── Layer 2: Foto KBM wajib ─────────────────────────────────
    const reportWithPhoto = await Report.findOne({
      relawanId: user.id,
      scheduleId,
      semester,
      $or: [
        { photoUrl: { $exists: true, $ne: "" } },
        { photoUrls: { $exists: true, $not: { $size: 0 } } },
      ],
      date: {
        $gte: new Date(new Date(kbmDate).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(kbmDate).setHours(23, 59, 59, 999)),
      },
    }).select({ _id: 1 });

    if (!reportWithPhoto) {
      return NextResponse.json(
        {
          error: "PHOTO_REQUIRED",
          message:
            "Upload foto KBM dulu di halaman Reporting untuk pertemuan ini sebelum simpan kehadiran tim.",
        },
        { status: 403 },
      );
    }

    // ── Layer 3: Audit metadata ─────────────────────────────────
    const { ip, userAgent } = extractAuditMeta(request);
    const markedAt = new Date();

    // Bulk upsert: untuk tiap member, update existing record (push editHistory)
    // atau create new.
    const results: { volunteerId: string; status: TeamAttendanceStatus; created: boolean }[] = [];
    for (const m of members) {
      const filter = {
        relawanId: new mongoose.Types.ObjectId(user.id),
        scheduleId: new mongoose.Types.ObjectId(scheduleId),
        week,
        date: kbmDate,
        volunteerId: new mongoose.Types.ObjectId(m.volunteerId),
      };
      const existing = await TeamAttendance.findOne(filter);
      if (existing) {
        const changed =
          existing.status !== m.status ||
          (existing.notes ?? "") !== (m.notes ?? "");
        if (changed) {
          existing.editHistory.push({
            at: markedAt,
            by: new mongoose.Types.ObjectId(user.id),
            prevStatus: existing.status,
            newStatus: m.status,
            prevNotes: existing.notes,
            newNotes: m.notes ?? "",
            ip,
            userAgent,
          });
          existing.status = m.status;
          existing.notes = m.notes ?? "";
          existing.role = m.role;
          existing.markedBy = new mongoose.Types.ObjectId(user.id);
          existing.markedAt = markedAt;
          existing.markedFromIp = ip;
          existing.userAgent = userAgent;
          await existing.save();
        }
        results.push({
          volunteerId: m.volunteerId,
          status: m.status,
          created: false,
        });
      } else {
        await TeamAttendance.create({
          ...filter,
          semester,
          role: m.role,
          status: m.status,
          notes: m.notes ?? "",
          markedBy: new mongoose.Types.ObjectId(user.id),
          markedAt,
          markedFromIp: ip,
          userAgent,
          editHistory: [],
        });
        results.push({
          volunteerId: m.volunteerId,
          status: m.status,
          created: true,
        });
      }
    }

    return NextResponse.json({
      message: `Kehadiran tim disimpan: ${results.length} anggota`,
      results,
      bypassWindow,
    });
  } catch (err) {
    console.error("POST /api/volunteer/team-attendance error:", err);
    return NextResponse.json(
      { error: "Gagal menyimpan kehadiran tim" },
      { status: 500 },
    );
  }
}
