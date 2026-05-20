import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Schedule } from "@/models/Schedule";
import { Settings } from "@/models/Settings";
import { computeActiveWeek, generateKbmDates, KbmDateInput } from "@/lib/schedule";

// ── Util ────────────────────────────────────────────────────────────────────

async function loadValidLevels(): Promise<string[]> {
  // availableLevels sekarang derived dari faseConfig (Object.keys), bukan disimpan terpisah.
  // SNBT EXCLUDED — SNBT itu kelas online-only, gak punya jadwal KBM.
  const faseDoc = await Settings.findOne({ key: "faseConfig" });
  return faseDoc?.value
    ? Object.keys(faseDoc.value as Record<string, unknown>)
    : ["DISABILITAS", "FASE PUCUK", "FASE A", "FASE B", "FASE C", "FASE D", "FASE E"];
}

interface IncomingKbm {
  week?: number;
  date: string | Date;
  topic?: string;
  materialLink?: string;
  documentationLink?: string;
}

/**
 * Normalisasi input kbmDates:
 *  - Validasi tanggal valid
 *  - Sort by date ascending
 *  - Re-assign week 1..N berurutan (volunteer gak perlu kirim week, sistem yg atur)
 */
function normalizeKbmDates(raw: unknown): KbmDateInput[] {
  if (!Array.isArray(raw)) return [];
  const list: KbmDateInput[] = [];
  for (const item of raw as IncomingKbm[]) {
    if (!item || !item.date) continue;
    const d = new Date(item.date);
    if (isNaN(d.getTime())) continue;
    d.setHours(0, 0, 0, 0);
    list.push({
      week: 0, // diatur ulang setelah sort
      date: d,
      topic: typeof item.topic === "string" ? item.topic.trim() : "",
      materialLink:
        typeof item.materialLink === "string" ? item.materialLink.trim() : "",
      documentationLink:
        typeof item.documentationLink === "string"
          ? item.documentationLink.trim()
          : "",
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

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const schedules = await Schedule.find({ relawanId: session.id }).sort({
      createdAt: -1,
    });

    // Re-derive activeWeek dari kbmDates supaya FE selalu dapat nilai segar
    // tanpa perlu cron. Kalau kbmDates kosong → fallback ke nilai tersimpan.
    const enriched = schedules.map((s) => {
      const obj = s.toObject();
      if (obj.kbmDates && obj.kbmDates.length > 0) {
        obj.activeWeek = computeActiveWeek(obj.kbmDates);
      }
      return obj;
    });

    return NextResponse.json({ schedules: enriched });
  } catch (err) {
    console.error("GET /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── POST: create ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { region, level, semester } = body;
    const generate: GenerateOpts | undefined = body.generate;

    if (!region || !level) {
      return NextResponse.json(
        { error: "Region dan level wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();
    const validLevels = await loadValidLevels();
    if (!validLevels.includes(level.toUpperCase())) {
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

    const sem = semester || "2026-1";

    const existing = await Schedule.findOne({
      relawanId: session.id,
      region: region.trim(),
      level: level.toUpperCase(),
      semester: sem,
    });

    if (existing) {
      return NextResponse.json(
        {
          error: `Jadwal untuk ${region} - ${level} sudah terdaftar di semester ini.`,
        },
        { status: 400 }
      );
    }

    const activeWeek =
      kbmDates.length > 0 ? computeActiveWeek(kbmDates) : 1;

    const schedule = await Schedule.create({
      relawanId: session.id,
      region: region.trim(),
      level: level.toUpperCase(),
      semester: sem,
      activeWeek,
      kbmDates: kbmDates.map((k) => ({ ...k, date: new Date(k.date) })),
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    console.error("POST /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ── PUT: update ─────────────────────────────────────────────────────────────

export async function PUT(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, region, level, semester } = body;
    const generate: GenerateOpts | undefined = body.generate;

    if (!id) {
      return NextResponse.json({ error: "ID jadwal diperlukan" }, { status: 400 });
    }
    if (!region || !level) {
      return NextResponse.json(
        { error: "Region dan level wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();
    const validLevels = await loadValidLevels();
    if (!validLevels.includes(level.toUpperCase())) {
      return NextResponse.json(
        { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
        { status: 400 }
      );
    }

    const sem = semester || "2026-1";

    const conflict = await Schedule.findOne({
      _id: { $ne: id },
      relawanId: session.id,
      region: region.trim(),
      level: level.toUpperCase(),
      semester: sem,
    });

    if (conflict) {
      return NextResponse.json(
        { error: `Kombinasi wilayah dan jenjang ini sudah digunakan di jadwal lain.` },
        { status: 400 }
      );
    }

    // Update kbmDates kalau body include (explicit array atau generate)
    interface ScheduleUpdate {
      region: string;
      level: string;
      semester: string;
      kbmDates?: KbmDateInput[];
      activeWeek?: number;
    }

    const update: ScheduleUpdate = {
      region: region.trim(),
      level: level.toUpperCase(),
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
      update.kbmDates = kbmDates;
      update.activeWeek =
        kbmDates.length > 0 ? computeActiveWeek(kbmDates) : 1;
    }

    const schedule = await Schedule.findOneAndUpdate(
      { _id: id, relawanId: session.id },
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
}

// ── DELETE ──────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID jadwal diperlukan" }, { status: 400 });
    }

    await connectDB();

    const deleted = await Schedule.findOneAndDelete({
      _id: id,
      relawanId: session.id,
    });

    if (!deleted) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Jadwal berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
