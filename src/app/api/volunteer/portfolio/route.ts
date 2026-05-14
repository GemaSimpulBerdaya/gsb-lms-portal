import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import StudentPortfolio from "@/models/StudentPortfolio";
import { Schedule } from "@/models/Schedule";
import { Settings } from "@/models/Settings";

const VALID_STORAGE = ["EXTERNAL_LINK", "CLOUDINARY", "S3"] as const;

/**
 * Validasi URL ringan: harus http(s) dan tidak boleh kosong.
 * Untuk EXTERNAL_LINK kita longgar — yang penting parse-able.
 */
function isValidUrl(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const s = raw.trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

async function getActiveSemester(): Promise<string> {
  const setting = await Settings.findOne({ key: "activeSemester" });
  if (setting?.value && typeof setting.value === "string") return setting.value;
  const d = new Date();
  return `${d.getFullYear()}-1`;
}

/**
 * GET /api/volunteer/portfolio
 *   ?anakDidikId=...    filter satu siswa
 *   ?scheduleId=...     filter satu jadwal
 *   ?semester=...       default: semua semester milik relawan
 *   ?type=KARYA|DOKUMENTASI
 *   ?week=N
 *
 * Response: { total, portfolio: [...] } — populate `anakDidikId` (name).
 */
export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const anakDidikId = searchParams.get("anakDidikId");
  const scheduleId = searchParams.get("scheduleId");
  const semester = searchParams.get("semester");
  const week = searchParams.get("week");

  const filter: Record<string, unknown> = { relawanId: session.id };
  if (anakDidikId) filter.anakDidikId = anakDidikId;
  if (scheduleId) filter.scheduleId = scheduleId;
  if (semester) filter.semester = semester;
  if (week) {
    const w = parseInt(week, 10);
    if (Number.isFinite(w) && w > 0) filter.week = w;
  }

  await connectDB();

  const items = await StudentPortfolio.find(filter)
    .populate("anakDidikId", "name region category")
    .sort({ date: -1, createdAt: -1 });

  return NextResponse.json({ total: items.length, portfolio: items });
}

/**
 * POST /api/volunteer/portfolio
 * Body: {
 *   anakDidikId, scheduleId, type, title, fileUrl,
 *   description?, week?, date?, thumbnailUrl?, mimeHint?,
 *   storageType?         // default EXTERNAL_LINK
 * }
 *
 * Server otomatis ambil semester/region/level dari Schedule milik relawan.
 * Hanya semester aktif yang bisa di-write.
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const {
    anakDidikId,
    scheduleId,
    title,
    fileUrl,
    description,
    week,
    date,
    thumbnailUrl,
    mimeHint,
    storageType: rawStorage,
  } = body as Record<string, unknown>;

  // --- Validasi field wajib ---
  if (!anakDidikId || typeof anakDidikId !== "string" || !Types.ObjectId.isValid(anakDidikId)) {
    return NextResponse.json({ error: "anakDidikId tidak valid" }, { status: 400 });
  }
  if (!scheduleId || typeof scheduleId !== "string" || !Types.ObjectId.isValid(scheduleId)) {
    return NextResponse.json({ error: "scheduleId tidak valid" }, { status: 400 });
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "title wajib diisi" }, { status: 400 });
  }
  if (!isValidUrl(fileUrl)) {
    return NextResponse.json(
      { error: "fileUrl wajib berupa URL http/https" },
      { status: 400 }
    );
  }

  const storageType = (typeof rawStorage === "string"
    ? rawStorage.toUpperCase()
    : "EXTERNAL_LINK") as (typeof VALID_STORAGE)[number];
  if (!VALID_STORAGE.includes(storageType)) {
    return NextResponse.json(
      { error: `storageType tidak valid. Pilihan: ${VALID_STORAGE.join(", ")}` },
      { status: 400 }
    );
  }

  if (thumbnailUrl !== undefined && thumbnailUrl !== "" && !isValidUrl(thumbnailUrl)) {
    return NextResponse.json({ error: "thumbnailUrl tidak valid" }, { status: 400 });
  }

  await connectDB();

  // Ambil schedule untuk derivasi region/level/semester — sekaligus pastikan
  // schedule itu memang milik relawan ini (cegah cross-volunteer write).
  const schedule = await Schedule.findOne({
    _id: scheduleId,
    relawanId: session.id,
  });
  if (!schedule) {
    return NextResponse.json(
      { error: "Schedule tidak ditemukan atau bukan milik Anda" },
      { status: 404 }
    );
  }

  const activeSemester = await getActiveSemester();
  if (schedule.semester !== activeSemester) {
    return NextResponse.json(
      { error: "Tidak dapat menambahkan portofolio untuk semester non-aktif" },
      { status: 403 }
    );
  }

  // Parse week & date opsional
  let parsedWeek: number | undefined;
  if (week !== undefined && week !== null && week !== "") {
    const w = Number(week);
    if (!Number.isFinite(w) || w < 1) {
      return NextResponse.json({ error: "week tidak valid" }, { status: 400 });
    }
    parsedWeek = Math.floor(w);
  }
  let parsedDate: Date | undefined;
  if (date !== undefined && date !== null && date !== "") {
    const d = new Date(date as string);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "date tidak valid" }, { status: 400 });
    }
    parsedDate = d;
  }

  const item = await StudentPortfolio.create({
    anakDidikId,
    scheduleId,
    relawanId: session.id,
    semester: schedule.semester,
    region: schedule.region,
    level: schedule.level,
    title: title.trim(),
    description: typeof description === "string" ? description.trim() : undefined,
    storageType,
    fileUrl: (fileUrl as string).trim(),
    thumbnailUrl:
      typeof thumbnailUrl === "string" && thumbnailUrl.trim()
        ? thumbnailUrl.trim()
        : undefined,
    mimeHint: typeof mimeHint === "string" ? mimeHint.trim() : undefined,
    week: parsedWeek,
    date: parsedDate,
  });

  return NextResponse.json({ message: "Portofolio tersimpan", item }, { status: 201 });
}
