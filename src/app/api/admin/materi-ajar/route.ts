import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withModuleManager } from "@/lib/apiAuth";
import { MateriAjar } from "@/models/MateriAjar";
import { Settings } from "@/models/Settings";
import { isHttpUrl } from "@/lib/uploadthingFiles";
import { canonicalConfiguredValue } from "@/lib/learningMaterialImport";
import mongoose from "mongoose";


async function getAvailableLevels(): Promise<Set<string>> {
  const doc = await Settings.findOne({ key: "faseConfig" }).lean<{
    value: Record<string, unknown>;
  }>();
  if (doc && doc.value && typeof doc.value === "object") {
    return new Set(Object.keys(doc.value).map((k) => k.trim().toUpperCase()));
  }
  return new Set();
}

async function getAvailableSubjects(): Promise<string[]> {
  const doc = await Settings.findOne({ key: "availableSubjects" }).lean<{
    value?: unknown;
  }>();
  return Array.isArray(doc?.value)
    ? doc.value.filter((subject): subject is string => typeof subject === "string")
    : [];
}

async function getAvailableSemesters(): Promise<string[]> {
  const doc = await Settings.findOne({ key: "availableSemesters" }).lean<{
    value?: unknown;
  }>();
  return Array.isArray(doc?.value)
    ? doc.value.filter((semester): semester is string => typeof semester === "string")
    : [];
}

/**
 * Normalisasi & validasi payload materi ajar.
 * - fileUrl WAJIB (hasil upload atau tautan eksternal)
 * - programType diturunkan dari learningLocation
 * - OFFLINE: fase wajib & cocok faseConfig

 */
function normalizePayload(
  data: Record<string, unknown>,
  validLevels: Set<string>,
  validSubjects: string[],
  validSemesters: string[],
): { ok: true; doc: Record<string, unknown> } | { ok: false; error: string } {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Payload tidak valid." };
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const fileUrl = typeof data.fileUrl === "string" ? data.fileUrl.trim() : "";
  const learningLocation =
    typeof data.learningLocation === "string" ? data.learningLocation.trim() : "";
  const programType = "OFFLINE" as const;
  const semester = typeof data.semester === "string" ? data.semester.trim() : "";

  if (!title) return { ok: false, error: "Judul materi wajib diisi." };
  if (!semester) return { ok: false, error: "Semester wajib diisi." };
  const canonicalSemester = validSemesters.length > 0
    ? canonicalConfiguredValue(semester, validSemesters)
    : semester;
  if (!canonicalSemester) {
    return { ok: false, error: `Semester "${semester}" tidak terdaftar.` };
  }
  if (!fileUrl || !isHttpUrl(fileUrl)) {
    return { ok: false, error: "Upload file atau link materi yang valid wajib diisi." };
  }

  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  if (!subject) return { ok: false, error: "Mata Pelajaran wajib diisi." };
  const canonicalSubject = validSubjects.length > 0
    ? canonicalConfiguredValue(subject, validSubjects)
    : subject;
  if (!canonicalSubject) {
    return { ok: false, error: `Mata Pelajaran "${subject}" tidak terdaftar.` };
  }

  const doc: Record<string, unknown> = {
    title,
    description,
    fileUrl,
    learningLocation,
    programType,
    subject: canonicalSubject,
    semester: canonicalSemester,
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
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { ok: false, error: "Bulan tidak valid (harus 1-12)." };
    }
    doc.month = m;
  } else {
    doc.month = null;
  }

  // Validasi Fase — wajib untuk materi offline.
  const fase = String(data.fase || "").trim().toUpperCase();
  if (!fase) return { ok: false, error: "Fase wajib diisi." };
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
    if (!data || typeof data !== "object") {
      return NextResponse.json({ error: "Payload tidak valid." }, { status: 400 });
    }
    await connectDB();
    const [validLevels, validSubjects, validSemesters] = await Promise.all([
      getAvailableLevels(),
      getAvailableSubjects(),
      getAvailableSemesters(),
    ]);

    if (Array.isArray(data.items)) {
      if (data.items.length === 0 || data.items.length > 500) {
        return NextResponse.json(
          { error: "Jumlah data impor harus 1-500 baris." },
          { status: 400 },
        );
      }

      const docs: Record<string, unknown>[] = [];
      for (const [index, item] of data.items.entries()) {
        const validated = normalizePayload(item, validLevels, validSubjects, validSemesters);
        if (!validated.ok) {
          const row = Number(item?._excelRow) || index + 2;
          return NextResponse.json(
            { error: `Baris ${row}: ${validated.error}` },
            { status: 400 },
          );
        }
        docs.push(validated.doc);
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(() => MateriAjar.insertMany(docs, { session }));
      } finally {
        await session.endSession();
      }
      return NextResponse.json(
        { message: `${docs.length} materi ajar berhasil diimpor`, inserted: docs.length },
        { status: 201 },
      );
    }

    const validated = normalizePayload(data, validLevels, validSubjects, validSemesters);
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
