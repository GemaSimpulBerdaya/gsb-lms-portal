import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Module } from "@/models/Core";
import { Settings } from "@/models/Settings";
import mongoose from "mongoose";

const VALID_CATEGORIES = ["SNBT", "OFFLINE"] as const;
type ModuleCategory = (typeof VALID_CATEGORIES)[number];

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
 * Build update payload aman untuk PUT.
 * Menghindari overwrite field bukan-bagian-form (createdAt dst.) dan validasi
 * level/subCategory sesuai category baru.
 */
async function buildUpdate(data: Record<string, unknown>): Promise<{ ok: true; doc: Record<string, unknown> } | { ok: false; error: string }> {
  if (!data || typeof data !== "object") {
    return { ok: false, error: "Payload tidak valid." };
  }

  const out: Record<string, unknown> = {};

  if (typeof data.title === "string") out.title = data.title.trim();
  if (typeof data.slug === "string") out.slug = data.slug.trim();
  if (typeof data.description === "string") out.description = data.description.trim();
  if (typeof data.semester === "string") out.semester = data.semester;
  if (typeof data.fileUrl === "string") out.fileUrl = data.fileUrl;
  if (typeof data.order === "number") out.order = data.order;

  if (data.week !== undefined) {
    if (data.week === null || data.week === "") {
      out.week = null;
    } else {
      const w = Number(data.week);
      if (!Number.isFinite(w) || w < 1) return { ok: false, error: "week tidak valid." };
      out.week = Math.floor(w);
    }
  }

  if (data.prerequisiteModule !== undefined) {
    if (
      data.prerequisiteModule &&
      typeof data.prerequisiteModule === "string" &&
      mongoose.Types.ObjectId.isValid(data.prerequisiteModule)
    ) {
      out.prerequisiteModule = data.prerequisiteModule;
    } else {
      out.prerequisiteModule = null;
    }
  }

  // Penanganan category + level/subCategory.
  if (data.category !== undefined) {
    const category = String(data.category).toUpperCase() as ModuleCategory;
    if (!VALID_CATEGORIES.includes(category)) {
      return {
        ok: false,
        error: `Category wajib salah satu dari ${VALID_CATEGORIES.join(", ")}.`,
      };
    }
    out.category = category;

    if (category === "OFFLINE") {
      const level = String(data.level || "").trim().toUpperCase();
      if (!level) {
        return { ok: false, error: "Modul OFFLINE wajib pilih fase." };
      }
      const validLevels = await getAvailableLevels();
      if (validLevels.size > 0 && !validLevels.has(level)) {
        return {
          ok: false,
          error: `Fase "${level}" tidak terdaftar di faseConfig.`,
        };
      }
      out.level = level;
      out.subCategory = "";
    } else {
      // SNBT
      const subCategory = typeof data.subCategory === "string" ? data.subCategory.trim() : "";
      out.level = "";
      out.subCategory = subCategory;
    }
  } else {
    // Category tidak diubah — terima level / subCategory bila dikirim.
    if (typeof data.level === "string") {
      const level = data.level.trim().toUpperCase();
      if (level) {
        const validLevels = await getAvailableLevels();
        if (validLevels.size > 0 && !validLevels.has(level)) {
          return {
            ok: false,
            error: `Fase "${level}" tidak terdaftar di faseConfig.`,
          };
        }
      }
      out.level = level;
    }
    if (typeof data.subCategory === "string") {
      out.subCategory = data.subCategory.trim();
    }
  }

  return { ok: true, doc: out };
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const data = await request.json();
    await connectDB();

    const validated = await buildUpdate(data);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const updated = await Module.findByIdAndUpdate(id, { $set: validated.doc }, { new: true });
    if (!updated) {
      return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ message: "Modul berhasil diperbarui", module: updated });
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
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const { id } = await params;
    await connectDB();
    const deleted = await Module.findByIdAndDelete(id);

    if (!deleted) return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });

    return NextResponse.json({ message: "Modul berhasil dihapus" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
