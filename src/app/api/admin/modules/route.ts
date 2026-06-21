import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withModuleManager } from "@/lib/apiAuth";
import { Module } from "@/models/Module";
import { Settings } from "@/models/Settings";
import mongoose from "mongoose";

const VALID_CATEGORIES = ["SNBT", "OFFLINE"] as const;
type ModuleProgramType = (typeof VALID_CATEGORIES)[number];

function deriveProgramType(learningLocation: string, fallback?: unknown): ModuleProgramType {
  // Jika programType dikirim eksplisit di payload (form baru tanpa lokasi),
  // utamakan itu. Lokasi lama (legacy) hanya jadi fallback untuk data lama.
  const fromPayload = String(fallback || "").toUpperCase();
  if (VALID_CATEGORIES.includes(fromPayload as ModuleProgramType)) {
    return fromPayload as ModuleProgramType;
  }
  const location = learningLocation.trim().toLowerCase();
  if (location) return location === "online snbt" ? "SNBT" : "OFFLINE";
  return "OFFLINE";
}

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

/**
 * Normalisasi & validasi payload modul.
 * - Lokasi Belajar menjadi input utama kategori modul.
 * - OFFLINE: wajib `fase` (nama fase) yang ada di faseConfig.
 * - SNBT: diturunkan dari Lokasi Belajar "Online SNBT"; `fase` dan `week` di-clear.
 */
async function normalizePayload(data: Record<string, unknown>): Promise<{ ok: true; doc: Record<string, unknown> } | { ok: false; error: string }> {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Payload tidak valid." };
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const slug = typeof data.slug === "string" ? data.slug.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const learningLocation = typeof data.learningLocation === "string" ? data.learningLocation.trim() : "";
  const programType = deriveProgramType(learningLocation, data.programType);

  if (!title) return { ok: false, error: "Judul modul wajib diisi." };
  if (!slug) return { ok: false, error: "Slug modul wajib diisi." };

  const doc: Record<string, unknown> = {
    title,
    slug,
    description,
    programType,
    learningLocation,
    semester: typeof data.semester === "string" ? data.semester : "",
    order: typeof data.order === "number" ? data.order : 0,
    fileUrl: typeof data.fileUrl === "string" ? data.fileUrl : "",
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
    if (!Number.isFinite(m) || m < 1 || m > 12) {
      return { ok: false, error: "Bulan tidak valid (harus 1-12)." };
    }
    doc.month = Math.floor(m);
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

  // Validasi Fase — wajib untuk SEMUA tipe (SNBT & OFFLINE sama-sama punya fase).
  const fase = String(data.fase || "").trim().toUpperCase();
  if (!fase) {
    return { ok: false, error: "Fase wajib diisi." };
  }
  const validLevels = await getAvailableLevels();
  if (validLevels.size > 0 && !validLevels.has(fase)) {
    return {
      ok: false,
      error: `Fase "${fase}" tidak terdaftar di faseConfig. Tambahkan dulu lewat /admin/settings.`,
    };
  }
  doc.fase = fase;
  
  // Validasi Mata Pelajaran
  const subject = typeof data.subject === "string" ? data.subject.trim() : "";
  doc.subject = subject;

  return { ok: true, doc };
}

/**
 * POST /api/admin/modules
 * Menambah modul baru
 */
export const POST = withModuleManager(async (request) => {
  try {
    const data = await request.json();
    await connectDB();

    const validated = await normalizePayload(data);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const newModule = await Module.create(validated.doc);
    return NextResponse.json(
      { message: "Modul berhasil dibuat", module: newModule },
      { status: 201 }
    );
  } catch (error: unknown) {
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

    // Use the model name to avoid dynamic import issues if possible
    let quizzes: Array<{ moduleId: { toString(): string } }> = [];
    try {
      const Quiz = mongoose.models.Quiz || (await import("@/models/Quiz")).Quiz;
      const moduleIds = modules.map((m) => m._id);
      quizzes = await Quiz.find({ moduleId: { $in: moduleIds } }).select("moduleId").lean();
    } catch (qError) {
      console.warn("Quiz model not yet registered or error fetching quizzes:", qError);
    }

    const quizMap = new Set(quizzes.map((q) => q.moduleId.toString()));

    const modulesWithQuiz = modules.map((m) => ({
      ...m,
      hasQuiz: quizMap.has(m._id.toString()),
    }));

    return NextResponse.json({ modules: modulesWithQuiz });
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
