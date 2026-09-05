import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withModuleManager } from "@/lib/apiAuth";
import { Module } from "@/models/Module";
import { Settings } from "@/models/Settings";
import mongoose from "mongoose";
import { isHttpUrl } from "@/lib/uploadthingFiles";
import { canonicalConfiguredValue, slugifyImportTitle } from "@/lib/learningMaterialImport";

function deriveProgramType() { return "OFFLINE" as const; }

/**
 * Ambil daftar fase aktif dari faseConfig (single source of truth).
 * Dipakai untuk validasi field `fase` saat tambah modul OFFLINE.
 */
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
 * Normalisasi & validasi payload modul.
 * - Lokasi Belajar menjadi input utama kategori modul.
 * - OFFLINE: wajib `fase` (nama fase) yang ada di faseConfig.

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
  const rawSlug = typeof data.slug === "string" ? data.slug.trim() : "";
  const slug = slugifyImportTitle(rawSlug);
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const learningLocation = typeof data.learningLocation === "string" ? data.learningLocation.trim() : "";
  const programType = deriveProgramType();
  const semester = typeof data.semester === "string" ? data.semester.trim() : "";

  if (!title) return { ok: false, error: "Judul modul wajib diisi." };
  if (!slug) return { ok: false, error: "Slug modul wajib diisi." };
  if (!semester) return { ok: false, error: "Semester wajib diisi." };
  const canonicalSemester = validSemesters.length > 0
    ? canonicalConfiguredValue(semester, validSemesters)
    : semester;
  if (!canonicalSemester) {
    return { ok: false, error: `Semester "${semester}" tidak terdaftar.` };
  }
  const fileUrl = typeof data.fileUrl === "string" ? data.fileUrl.trim() : "";
  if (!fileUrl || !isHttpUrl(fileUrl)) {
    return { ok: false, error: "Upload file atau link materi yang valid wajib diisi." };
  }

  const doc: Record<string, unknown> = {
    title,
    slug,
    description,
    programType,
    learningLocation,
    semester: canonicalSemester,
    order: typeof data.order === "number" ? data.order : 0,
    fileUrl,
  };

  // week (legacy, opsional, OFFLINE)
  if (data.week !== undefined && data.week !== null && data.week !== "") {
    const w = Number(data.week);
    if (!Number.isFinite(w) || w < 1) {
      return { ok: false, error: "week tidak valid." };
    }
    doc.week = Math.floor(w);
  } else {
    doc.week = null;
  }

  // month (1-12). Form baru pakai dropdown nama bulan, value disimpen sbg int.
  if (data.month !== undefined && data.month !== null && data.month !== "") {
    const m = Number(data.month);
    if (!Number.isInteger(m) || m < 1 || m > 12) {
      return { ok: false, error: "Bulan tidak valid (harus 1-12)." };
    }
    doc.month = m;
  } else {
    doc.month = null;
  }

  // prerequisite (opsional)
  if (data.prerequisiteModule && typeof data.prerequisiteModule === "string") {
    if (mongoose.Types.ObjectId.isValid(data.prerequisiteModule)) {
      doc.prerequisiteModule = data.prerequisiteModule;
    }
  } else {
    doc.prerequisiteModule = null;
  }

  // Validasi Fase — wajib untuk modul offline.
  const fase = String(data.fase || "").trim().toUpperCase();
  if (!fase) {
    return { ok: false, error: "Fase wajib diisi." };
  }
  if (validLevels.size > 0 && !validLevels.has(fase)) {
    return {
      ok: false,
      error: `Fase "${fase}" tidak terdaftar di faseConfig. Tambahkan dulu lewat /admin/settings.`,
    };
  }
  doc.fase = fase;
  
  // Validasi Mata Pelajaran
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  if (!subject) return { ok: false, error: "Mata Pelajaran wajib diisi." };
  const canonicalSubject = validSubjects.length > 0
    ? canonicalConfiguredValue(subject, validSubjects)
    : subject;
  if (!canonicalSubject) {
    return { ok: false, error: `Mata Pelajaran "${subject}" tidak terdaftar.` };
  }
  doc.subject = canonicalSubject;

  return { ok: true, doc };
}

/**
 * POST /api/admin/modules
 * Menambah modul baru
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

      const slugs = docs.map((doc) => String(doc.slug));
      const duplicateSlug = slugs.find((slug, index) => slugs.indexOf(slug) !== index);
      if (duplicateSlug) {
        return NextResponse.json(
          { error: `Impor dibatalkan. Slug "${duplicateSlug}" duplikat di file.` },
          { status: 409 },
        );
      }

      const existing = await Module.findOne({ slug: { $in: slugs } }).select({ slug: 1 }).lean();
      if (existing) {
        return NextResponse.json(
          { error: `Impor dibatalkan. Slug "${existing.slug}" sudah dipakai modul lain.` },
          { status: 409 },
        );
      }

      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          const conflicting = await Module.findOne({ slug: { $in: slugs } })
            .select({ slug: 1 })
            .session(session)
            .lean();
          if (conflicting) throw new Error(`DUPLICATE_SLUG:${conflicting.slug}`);
          await Module.insertMany(docs, { session });
        });
      } finally {
        await session.endSession();
      }
      return NextResponse.json(
        { message: `${docs.length} modul berhasil diimpor`, inserted: docs.length },
        { status: 201 },
      );
    }

    const validated = normalizePayload(data, validLevels, validSubjects, validSemesters);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const newModule = await Module.create(validated.doc);
    return NextResponse.json(
      { message: "Modul berhasil dibuat", module: newModule },
      { status: 201 }
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.startsWith("DUPLICATE_SLUG:")) {
      return NextResponse.json(
        { error: `Impor dibatalkan. Slug "${error.message.slice(15)}" sudah dipakai modul lain.` },
        { status: 409 },
      );
    }
    if (error && typeof error === "object" && "code" in error && error.code === 11000) {
      const keyValue = "keyValue" in error ? (error as { keyValue?: { slug?: string } }).keyValue : undefined;
      return NextResponse.json(
        { error: `Slug "${keyValue?.slug}" sudah dipakai modul lain.` },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

/**
 * GET /api/admin/modules
 * Mengambil semua modul untuk manajemen (tanpa filter programType)
 */
export const GET = withModuleManager(async () => {
  try {
    await connectDB();
    const modules = await Module.find({}).sort({ learningLocation: 1, programType: 1, fase: 1, week: 1, order: 1 }).lean();

    return NextResponse.json({ modules });
  } catch (error: unknown) {
    console.error("Error in GET /api/admin/modules:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const stack = error instanceof Error ? error.stack : undefined;
    return NextResponse.json(
      {
        error: message,
        stack: process.env.NODE_ENV === "development" ? stack : undefined,
      },
      { status: 500 }
    );
  }
});
