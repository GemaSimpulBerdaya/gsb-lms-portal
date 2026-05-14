import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Module } from "@/models/Core";
import { Settings } from "@/models/Settings";
import mongoose from "mongoose";

const VALID_CATEGORIES = ["SNBT", "OFFLINE"] as const;
type ModuleCategory = (typeof VALID_CATEGORIES)[number];

/**
 * Ambil daftar fase aktif dari faseConfig (single source of truth).
 * Dipakai untuk validasi field `level` saat tambah modul OFFLINE.
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
 * - OFFLINE: wajib `level` (nama fase) yang ada di faseConfig.
 * - SNBT: wajib `subCategory` (string non-empty); `level` di-clear.
 */
async function normalizePayload(data: any): Promise<{ ok: true; doc: Record<string, unknown> } | { ok: false; error: string }> {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Payload tidak valid." };
  }

  const title = typeof data.title === "string" ? data.title.trim() : "";
  const slug = typeof data.slug === "string" ? data.slug.trim() : "";
  const description = typeof data.description === "string" ? data.description.trim() : "";
  const category = String(data.category || "").toUpperCase() as ModuleCategory;

  if (!title) return { ok: false, error: "Judul modul wajib diisi." };
  if (!slug) return { ok: false, error: "Slug modul wajib diisi." };
  if (!VALID_CATEGORIES.includes(category)) {
    return {
      ok: false,
      error: `Category wajib salah satu dari ${VALID_CATEGORIES.join(", ")}.`,
    };
  }

  const doc: Record<string, unknown> = {
    title,
    slug,
    description,
    category,
    semester: typeof data.semester === "string" ? data.semester : "2025-1",
    order: typeof data.order === "number" ? data.order : 0,
    fileUrl: typeof data.fileUrl === "string" ? data.fileUrl : "",
  };

  // week (opsional, OFFLINE)
  if (data.week !== undefined && data.week !== null && data.week !== "") {
    const w = Number(data.week);
    if (!Number.isFinite(w) || w < 1) {
      return { ok: false, error: "week tidak valid." };
    }
    doc.week = Math.floor(w);
  } else {
    doc.week = null;
  }

  // prerequisite (opsional)
  if (data.prerequisiteModule && typeof data.prerequisiteModule === "string") {
    if (mongoose.Types.ObjectId.isValid(data.prerequisiteModule)) {
      doc.prerequisiteModule = data.prerequisiteModule;
    }
  } else {
    doc.prerequisiteModule = null;
  }

  if (category === "OFFLINE") {
    const level = String(data.level || "").trim().toUpperCase();
    if (!level) {
      return {
        ok: false,
        error: "Modul OFFLINE wajib pilih fase. Daftar fase di-derive dari Konfigurasi Raport.",
      };
    }
    const validLevels = await getAvailableLevels();
    if (validLevels.size > 0 && !validLevels.has(level)) {
      return {
        ok: false,
        error: `Fase "${level}" tidak terdaftar di faseConfig. Tambahkan dulu lewat /admin/report-config.`,
      };
    }
    doc.level = level;
    doc.subCategory = "";
  } else {
    // SNBT — pakai subCategory bebas
    const subCategory = typeof data.subCategory === "string" ? data.subCategory.trim() : "";
    doc.level = "";
    doc.subCategory = subCategory;
  }

  return { ok: true, doc };
}

/**
 * POST /api/admin/modules
 * Menambah modul baru
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

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
  } catch (error: any) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { error: `Slug "${error.keyValue?.slug}" sudah dipakai modul lain.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/modules
 * Mengambil semua modul untuk manajemen (tanpa filter category)
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    await connectDB();
    const modules = await Module.find({}).sort({ category: 1, level: 1, week: 1, order: 1 }).lean();

    // Use the model name to avoid dynamic import issues if possible
    let quizzes: any[] = [];
    try {
      const Quiz = mongoose.models.Quiz || (await import("@/models/SMA")).Quiz;
      const moduleIds = modules.map((m) => m._id);
      quizzes = await Quiz.find({ moduleId: { $in: moduleIds } }).select("moduleId").lean();
    } catch (qError) {
      console.warn("Quiz model not yet registered or error fetching quizzes:", qError);
    }

    const quizMap = new Set(quizzes.map((q: any) => q.moduleId.toString()));

    const modulesWithQuiz = modules.map((m) => ({
      ...m,
      hasQuiz: quizMap.has(m._id.toString()),
    }));

    return NextResponse.json({ modules: modulesWithQuiz });
  } catch (error: any) {
    console.error("Error in GET /api/admin/modules:", error);
    return NextResponse.json(
      {
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      },
      { status: 500 }
    );
  }
}
