import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import { withAdmin } from "@/lib/apiAuth";
import { Schedule } from "@/models/Schedule";
import { Relawan } from "@/models/Relawan";
import { Settings } from "@/models/Settings";
import { Attendance } from "@/models/Attendance";
import { NilaiOffline } from "@/models/NilaiOffline";
import { Report } from "@/models/Report";
import AnakDidik from "@/models/AnakDidik";
import { computeActiveWeek, generateKbmDates, KbmDateInput } from "@/lib/schedule";
import { DEFAULT_FASE_CONFIG } from "@/lib/reportDefaults";
import { FIELD_TEAM_ROLES, VOLUNTEER_ROLE } from "@/lib/roles";

/**
 * Konversi Date jadi `YYYY-MM-DD` string TZ-safe (WIB / Asia/Jakarta).
 * Wajib WIB-canonical supaya cross-ref Schedule.kbmDates (local midnight WIB
 * di server) match dengan Report.date (input via `new Date(yyyymmdd)` =
 * UTC midnight) yang dilihat dari kacamata WIB sama-sama jatuh ke tanggal
 * yang sama.
 */
function dateKey(d: Date | string): string {
  const x = new Date(d);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(x);
}

// ── Util ────────────────────────────────────────────────────────────────────

/**
 * Jenjang yang ADA di faseConfig tapi BUKAN kelas KBM tatap muka.
 * - SNBT: kelas online-only, cuma akses modul + kuis, gak ada jadwal
 *   pertemuan relawan mingguan.
 * Harus di-exclude dari validasi level Schedule, baik saat faseConfig dibaca
 * dari DB maupun saat jatuh ke DEFAULT_FASE_CONFIG.
 */
const NON_KBM_LEVELS = new Set(["SNBT"]);

/**
 * Daftar jenjang valid untuk jadwal KBM, di-derive dari faseConfig
 * (single source of truth, di-CRUD via /admin/semesters?tab=lokasi-belajar).
 * Fallback ke DEFAULT_FASE_CONFIG — konstanta kanonik yang sama dipakai untuk
 * nyeed DB di /api/admin/settings, jadi gak akan drift. NON_KBM_LEVELS selalu
 * di-filter belakangan supaya SNBT/DISABILITAS gak pernah lolos walau ada di config.
 */
async function loadValidLevels(): Promise<string[]> {
  const faseDoc = await Settings.findOne({ key: "faseConfig" }).lean<{
    value: Record<string, unknown>;
  }>();
  const config =
    faseDoc?.value && typeof faseDoc.value === "object"
      ? faseDoc.value
      : DEFAULT_FASE_CONFIG;
  return Object.keys(config).filter(
    (level) => !NON_KBM_LEVELS.has(level.trim().toUpperCase())
  );
}

/**
 * Ambil set volunteerId (string) yang merupakan anggota tim akun ini.
 * Dipakai untuk memvalidasi petugas di kbmDates — cegah input id orang yang
 * bukan anggota tim. Kalau tim belum punya members → set kosong.
 */
async function loadTeamMemberIds(relawanId: string): Promise<Set<string>> {
  const team = await Relawan.findById(relawanId).select({ members: 1 }).lean();
  const members =
    ((team as { members?: { volunteerId: unknown }[] })?.members ?? []);
  return new Set(members.map((m) => String(m.volunteerId)));
}

async function resolveTeamByRegion(region: string) {
  const normalizedRegion = region.trim();
  if (!normalizedRegion) return null;

  return Relawan.findOne({
    region: normalizedRegion,
    role: { $in: [VOLUNTEER_ROLE, ...FIELD_TEAM_ROLES] },
  })
    .select({ _id: 1, region: 1, members: 1 })
    .lean<{
      _id: mongoose.Types.ObjectId;
      region?: string;
      members?: { volunteerId: unknown }[];
    }>();
}

/**
 * Buang petugas yang bukan anggota tim dari tiap kbmDate. Non-throwing:
 * id liar di-drop diam-diam (bukan error keras) supaya simpan jadwal tetap
 * jalan walau ada data petugas basi (mis. anggota sudah pindah tim).
 */
function filterPetugasByMembership(
  kbmDates: KbmDateInput[],
  memberIds: Set<string>
): KbmDateInput[] {
  return kbmDates.map((k) => ({
    ...k,
    petugas: (k.petugas ?? []).filter((id) => memberIds.has(id)),
  }));
}

/**
 * Konversi kbmDates ke shape siap-simpan: date jadi Date, petugas string id
 * jadi ObjectId (skip yang bukan ObjectId valid).
 */
function toDbKbmDates(kbmDates: KbmDateInput[]) {
  return kbmDates.map((k) => ({
    ...k,
    date: new Date(k.date),
    petugas: (k.petugas ?? [])
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id)),
  }));
}

interface IncomingKbm {
  week?: number;
  date: string | Date;
  meetingType?: string;
  topic?: string;
  requiresGrades?: unknown;
  materialLink?: string;
  documentationLink?: string;
  petugas?: unknown;
}

const MEETING_TYPES_REQUIRING_GRADES = new Set(["KBM", "ASSESSMENT"]);

function normalizeMeetingType(value: unknown): string {
  const normalized = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!normalized) return "KBM";
  return normalized;
}

function normalizeRequiresGrades(value: unknown, meetingType: string): boolean {
  if (typeof value === "boolean") return value;
  return MEETING_TYPES_REQUIRING_GRADES.has(meetingType);
}

/**
 * Normalisasi input kbmDates:
 *  - Validasi tanggal valid
 *  - Sort by date ascending
 *  - Re-assign week 1..N berurutan (volunteer gak perlu kirim week, sistem yg atur)
 *  - petugas dinormalisasi jadi array string id unik
 */
function normalizeKbmDates(raw: unknown): KbmDateInput[] {
  if (!Array.isArray(raw)) return [];
  const list: KbmDateInput[] = [];
  for (const item of raw as IncomingKbm[]) {
    if (!item || !item.date) continue;
    const d = new Date(item.date);
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    const petugas = Array.isArray(item.petugas)
      ? Array.from(
          new Set(
            item.petugas
              .map((p) => (typeof p === "string" ? p.trim() : String(p ?? "")))
              .filter((p) => p.length > 0)
          )
        )
      : [];
    const meetingType = normalizeMeetingType(item.meetingType);
    list.push({
      week: 0, // diatur ulang setelah sort
      date: d,
      meetingType,
      topic: typeof item.topic === "string" ? item.topic.trim() : "",
      requiresGrades: normalizeRequiresGrades(item.requiresGrades, meetingType),
      materialLink:
        typeof item.materialLink === "string" ? item.materialLink.trim() : "",
      documentationLink:
        typeof item.documentationLink === "string"
          ? item.documentationLink.trim()
          : "",
      petugas,
    });
  }
  list.sort(
    (a, b) =>
      new Date(a.date as Date).getTime() - new Date(b.date as Date).getTime()
  );
  return list.map((it, i) => ({ ...it, week: i + 1 }));
}

interface GenerateOpts {
  startDate?: string | Date;
  count?: number;
  intervalDays?: number;
  skipDates?: (string | Date)[];
}

/**
 * Resolve kbmDates final dari body request.
 * Priority:
 *  1. kbmDates explicit dari user → dipakai apa adanya (after normalize)
 *  2. generate.{startDate,count,intervalDays,skipDates} → auto-generate
 *  3. tidak ada keduanya → []
 */
function resolveKbmDates(
  bodyKbm: unknown,
  generate?: GenerateOpts
): KbmDateInput[] {
  if (Array.isArray(bodyKbm) && bodyKbm.length > 0) {
    return normalizeKbmDates(bodyKbm);
  }
  if (generate?.startDate && generate.count) {
    const generated = generateKbmDates({
      startDate: generate.startDate,
      count: generate.count,
      intervalDays: generate.intervalDays ?? 7,
      skipDates: generate.skipDates ?? [],
    });
    return generated;
  }
  return [];
}

// ── Util: completion status per pertemuan ──────────────────────────────────

interface CompletionEntry {
  attendance: boolean;
  grades: boolean;
  documentation: boolean;
  /** Optional context untuk UI (jumlah siswa hadir, dll). Kosong = belum ada. */
  attendanceCount?: number;
  gradesCount?: number;
  documentationCount?: number;
}

/**
 * Hitung completion status per pekan untuk satu schedule.
 * Cross-ref strategy:
 *  - Attendance: anakDidikId ∈ siswa-schedule + week (dari kbmDate.week)
 *  - NilaiOffline TUGAS: anakDidikId ∈ siswa-schedule + week
 *  - Report: scheduleId match (mandatory — fallback by date dihapus karena
 *    bisa false-positive ke schedule lain di tanggal sama)
 *
 * Penting: Attendance & NilaiOffline schema GAK punya region/fase — jadi
 * filter via siswa-schedule (region+fase match) supaya jadwal lain di
 * pekan yang sama gak ikut kecentang.
 */
async function buildCompletionByWeek(
  relawanId: string,
  scheduleId: string,
  region: string,
  fase: string,
  semester: string,
  kbmDates: { week: number; date: Date }[]
): Promise<Record<number, CompletionEntry>> {
  if (!kbmDates || kbmDates.length === 0) return {};

  const weeks = kbmDates.map((k) => k.week);

  // Ambil siswa untuk schedule ini (cross-ref via region+fase case-insensitive)
  const students = await AnakDidik.find({
    region: { $regex: new RegExp(`^${region.trim()}$`, "i") },
    fase: fase.toUpperCase(),
  })
    .select("_id")
    .lean<{ _id: import("mongoose").Types.ObjectId }[]>();

  const studentIds = students.map((s) => s._id);

  // Kalau gak ada siswa di schedule ini → semua "empty"
  if (studentIds.length === 0) {
    const result: Record<number, CompletionEntry> = {};
    for (const k of kbmDates) {
      result[k.week] = {
        attendance: false,
        grades: false,
        documentation: false,
        attendanceCount: 0,
        gradesCount: 0,
        documentationCount: 0,
      };
    }
    return result;
  }

  const [attendances, grades, reports] = await Promise.all([
    // Attendance: scope ke siswa schedule ini + relawan + semester + week
    Attendance.find({
      relawanId,
      semester,
      anakDidikId: { $in: studentIds },
      week: { $in: weeks },
      $or: [
        { scheduleId },
        { scheduleId: { $exists: false } },
      ],
    })
      .select("week date scheduleId")
      .lean(),

    // NilaiOffline TUGAS: scope ke siswa schedule ini + relawan + semester + week
    NilaiOffline.find({
      relawanId,
      semester,
      type: "TUGAS",
      anakDidikId: { $in: studentIds },
      week: { $in: weeks },
    })
      .select("week")
      .lean(),

    // Report: STRICT scheduleId match. Tanpa scheduleId di doc lama → diabaikan.
    Report.find({ scheduleId, semester })
      .select("date")
      .lean(),
  ]);

  // Index Reports by dateKey untuk match per kbmDate
  const reportsByDate = new Map<string, number>();
  for (const r of reports) {
    const k = dateKey(r.date as Date);
    reportsByDate.set(k, (reportsByDate.get(k) ?? 0) + 1);
  }

  const result: Record<number, CompletionEntry> = {};

  for (const k of kbmDates) {
    const attCount = attendances.filter((a) => {
      const attendance = a as { week: number; date?: Date; scheduleId?: unknown };
      if (attendance.week !== k.week) return false;
      if (attendance.scheduleId) return String(attendance.scheduleId) === scheduleId;
      return attendance.date ? dateKey(attendance.date) === dateKey(k.date) : true;
    }).length;
    const gradeCount = grades.filter((g) => g.week === k.week).length;
    const reportCount = reportsByDate.get(dateKey(k.date)) ?? 0;

    result[k.week] = {
      attendance: attCount > 0,
      grades: gradeCount > 0,
      documentation: reportCount > 0,
      attendanceCount: attCount,
      gradesCount: gradeCount,
      documentationCount: reportCount,
    };
  }

  return result;
}

// ── GET ─────────────────────────────────────────────────────────────────────

export const GET = withAdmin(async (request) => {
  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const semester = searchParams.get("semester");
    const query = semester ? { semester } : {};

    const schedules = await Schedule.find(query).sort({
      createdAt: -1,
    });

    // Re-derive activeWeek dari kbmDates supaya FE selalu dapat nilai segar
    // tanpa perlu cron. Kalau kbmDates kosong → fallback ke nilai tersimpan.
    // Sekaligus attach completionByWeek per schedule untuk timeline UI.
    const enriched = await Promise.all(
      schedules.map(async (s) => {
        const obj = s.toObject();
        if (obj.kbmDates && obj.kbmDates.length > 0) {
          obj.activeWeek = computeActiveWeek(obj.kbmDates);
        }

        // Alias `level` = `fase` untuk backward-compat dengan FE lama yang
        // masih baca `s.level`. Schema canonical pakai `fase`, tapi banyak
        // halaman volunteer (attendance, evaluation, students-data, portfolio,
        // reporting, dst) udah ekspose `level`. Kasih duanya.
        (obj as unknown as Record<string, unknown>).level = obj.fase;

        // Completion check hanya untuk schedule yang punya kbmDates
        if (obj.kbmDates && obj.kbmDates.length > 0) {
          const completion = await buildCompletionByWeek(
            String(obj.relawanId),
            String(obj._id),
            obj.region,
            obj.fase,
            obj.semester,
            obj.kbmDates.map((k: { week: number; date: Date }) => ({
              week: k.week,
              date: k.date,
            }))
          );
          (obj as unknown as Record<string, unknown>).completionByWeek = completion;
        }

        return obj;
      })
    );

    return NextResponse.json({ schedules: enriched });
  } catch (err) {
    console.error("GET /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

// ── POST: create ────────────────────────────────────────────────────────────

export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const { fase, semester } = body;
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const generate: GenerateOpts | undefined = body.generate;

    if (!region) {
      return NextResponse.json(
        { error: "Lokasi Belajar wajib diisi" },
        { status: 400 }
      );
    }
    if (!fase) {
      return NextResponse.json(
        { error: "Fase wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();
    const team = await resolveTeamByRegion(region);
    if (!team) {
      return NextResponse.json(
        { error: "Belum ada akun tim relawan untuk Lokasi Belajar ini." },
        { status: 400 }
      );
    }
    const teamId = String(team._id);
    const scopedRegion = (team.region ?? region).trim();
    const validLevels = await loadValidLevels();
    if (!validLevels.includes(fase.toUpperCase())) {
      return NextResponse.json(
        { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
        { status: 400 }
      );
    }

    // Resolve kbmDates: kalau user kirim explicit array → pakai itu;
    // kalau cuma kirim {generate: {...}} → auto-generate.
    let kbmDates: KbmDateInput[] = [];
    try {
      kbmDates = resolveKbmDates(body.kbmDates, generate);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Gagal generate tanggal";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    // Drop petugas yang bukan anggota tim (data basi / input liar).
    const memberIds = await loadTeamMemberIds(teamId);
    kbmDates = filterPetugasByMembership(kbmDates, memberIds);

    const sem = semester || "2026-1";

    const existing = await Schedule.findOne({
      relawanId: teamId,
      region: scopedRegion,
      fase: fase.toUpperCase(),
      semester: sem,
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `Jadwal untuk ${scopedRegion} - ${fase} sudah terdaftar di semester ini.`,
        },
        { status: 400 }
      );
    }

    const activeWeek =
      kbmDates.length > 0 ? computeActiveWeek(kbmDates) : 1;

    const schedule = await Schedule.create({
      relawanId: teamId,
      region: scopedRegion,
      fase: fase.toUpperCase(),
      semester: sem,
      activeWeek,
      kbmDates: toDbKbmDates(kbmDates),
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    console.error("POST /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

// ── PUT: update ─────────────────────────────────────────────────────────────

export const PUT = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const { id, fase, semester } = body;
    const region = typeof body.region === "string" ? body.region.trim() : "";
    const generate: GenerateOpts | undefined = body.generate;

    if (!id) {
      return NextResponse.json({ error: "ID jadwal diperlukan" }, { status: 400 });
    }
    if (!region) {
      return NextResponse.json(
        { error: "Lokasi Belajar wajib diisi" },
        { status: 400 }
      );
    }
    if (!fase) {
      return NextResponse.json(
        { error: "Fase wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();
    const team = await resolveTeamByRegion(region);
    if (!team) {
      return NextResponse.json(
        { error: "Belum ada akun tim relawan untuk Lokasi Belajar ini." },
        { status: 400 }
      );
    }
    const teamId = String(team._id);
    const scopedRegion = (team.region ?? region).trim();
    const validLevels = await loadValidLevels();
    if (!validLevels.includes(fase.toUpperCase())) {
      return NextResponse.json(
        { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
        { status: 400 }
      );
    }

    const sem = semester || "2026-1";

    const conflict = await Schedule.findOne({
      _id: { $ne: id },
      relawanId: teamId,
      region: scopedRegion,
      fase: fase.toUpperCase(),
      semester: sem,
    });

    if (conflict) {
      return NextResponse.json(
        { error: `Kombinasi lokasi belajar dan jenjang ini sudah digunakan di jadwal lain.` },
        { status: 400 }
      );
    }

    // Update kbmDates kalau body include (explicit array atau generate)
    interface ScheduleUpdate {
      relawanId: mongoose.Types.ObjectId;
      region: string;
      fase: string;
      semester: string;
      kbmDates?: ReturnType<typeof toDbKbmDates>;
      activeWeek?: number;
    }

    const update: ScheduleUpdate = {
      relawanId: team._id,
      region: scopedRegion,
      fase: fase.toUpperCase(),
      semester: sem,
    };

    const hasKbmInput = "kbmDates" in body || generate;
    if (hasKbmInput) {
      let kbmDates: KbmDateInput[] = [];
      try {
        kbmDates = resolveKbmDates(body.kbmDates, generate);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Gagal generate tanggal";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
      // Drop petugas yang bukan anggota tim (data basi / input liar).
      const memberIds = await loadTeamMemberIds(teamId);
      kbmDates = filterPetugasByMembership(kbmDates, memberIds);
      update.kbmDates = toDbKbmDates(kbmDates);
      update.activeWeek =
        kbmDates.length > 0 ? computeActiveWeek(kbmDates) : 1;
    }

    const schedule = await Schedule.findOneAndUpdate(
      { _id: id },
      update,
      { new: true }
    );

    if (!schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ schedule });
  } catch (err) {
    console.error("PUT /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});

// ── DELETE ──────────────────────────────────────────────────────────────────

export const DELETE = withAdmin(async (request) => {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID jadwal diperlukan" }, { status: 400 });
    }

    await connectDB();

    const deleted = await Schedule.findOneAndDelete({ _id: id });

    if (!deleted) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Jadwal berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
});
