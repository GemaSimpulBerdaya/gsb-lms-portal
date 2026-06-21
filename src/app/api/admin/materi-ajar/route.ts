import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withModuleManager } from "@/lib/apiAuth";
import { MateriAjar } from "@/models/MateriAjar";
import { Settings } from "@/models/Settings";

const VALID_PROGRAM_TYPES = ["SNBT", "OFFLINE"] as const;
type ProgramType = (typeof VALID_PROGRAM_TYPES)[number];

function deriveProgramType(learningLocation: string, fallback?: unknown): ProgramType {
  const fromPayload = String(fallback || "").toUpperCase();
  if (VALID_PROGRAM_TYPES.includes(fromPayload as ProgramType)) {
    return fromPayload as ProgramType;
  }
  const location = learningLocation.trim().toLowerCase();
  if (location) return location === "online snbt" ? "SNBT" : "OFFLINE";
  return "OFFLINE";
}

async function getAvailableLevels(): Promise<Set<string>> {
  const doc = await Settings.findOne({ key: "faseConfig" }).lean<{
    value: Record<string, unknown>;
  }>();
  if (doc && doc.value && typeof doc.value === "object") {
    return new Set(Object.keys(doc.value).map((k) => k.trim().toUpperCase()));
  }
  return new Set();
}

/**
 * Normalisasi & validasi payload materi ajar.
 * - fileUrl WAJIB (materi tanpa file = ngapain disimpen)
 * - programType diturunkan dari learningLocation
 * - OFFLINE: fase wajib & cocok faseConfig
 * - SNBT: fase di-clear (sesuai Module convention)
 */
async function normalizePayload(
  data: Record<string, unknown>
): Promise<{ ok: true; doc: Record<string, unknown> } | { ok: false; error: string }> {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Payload tidak valid." };
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const fileUrl = typeof data.fileUrl === "string" ? data.fileUrl.trim() : "";
  const learningLocation =
    typeof data.learningLocation === "string" ? data.learningLocation.trim() : "";
  const programType = deriveProgramType(learningLocation, data.programType);

  if (!title) return { ok: false, error: "Judul materi wajib diisi." };
  if (!fileUrl) return { ok: false, error: "File / URL materi wajib diisi." };

  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  if (!subject) return { ok: false, error: "Mata Pelajaran wajib diisi." };

  const doc: Record<string, unknown> = {
    title,
    description,
    fileUrl,
    learningLocation,
    programType,
    subject,
    semester: typeof data.semester === "string" ? data.semester : "2026-1",
  };

  // week (legacy, opsional)
  if (data.week !== undefined && data.week !== null && data.week !== "") {
    const w = Number(data.week);
    if (!Number.isFinite(w) || w < 1) return { ok: false, error: "week tidak valid." };
    doc.week = Math.floor(w);
  } else {
    doc.week = null;
  }

  // month (1-12, baru — nama bulan di UI, int di DB)
  if (data.month !== undefined && data.month !== null && data.month !== "") {
    const m = Number(data.month);
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      return { ok: false, error: "Bulan tidak valid (harus 1-12)." };
    }
    doc.month = Math.floor(m);
  } else {
    doc.month = null;
  }

  // Validasi Fase — wajib utk SNBT & OFFLINE (SNBT skrg juga punya fase).
  const fase = String(data.fase || "").trim().toUpperCase();
  if (!fase) return { ok: false, error: "Fase wajib diisi." };
  const validLevels = await getAvailableLevels();
  if (validLevels.size > 0 && !validLevels.has(fase)) {
    return { ok: false, error: `Fase "${fase}" tidak terdaftar di faseConfig.` };
  }
  doc.fase = fase;

  if (typeof data.uploadedBy === "string") {
    doc.uploadedBy = data.uploadedBy.trim();
  }

  return { ok: true, doc };
}

/**
 * GET /api/admin/materi-ajar — daftar semua materi ajar (admin / module manager).
 */
export const GET = withModuleManager(async () => {
  try {
    await connectDB();
    const items = await MateriAjar.find({})
      .sort({ programType: 1, learningLocation: 1, fase: 1, subject: 1, week: 1, createdAt: -1 })
      .lean();
    return NextResponse.json({ items });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

/**
 * POST /api/admin/materi-ajar — tambah materi baru.
 */
export const POST = withModuleManager(async (request) => {
  try {
    const data = await request.json();
    await connectDB();

    const validated = await normalizePayload(data);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const created = await MateriAjar.create(validated.doc);
    return NextResponse.json(
      { message: "Materi ajar berhasil dibuat", item: created },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
