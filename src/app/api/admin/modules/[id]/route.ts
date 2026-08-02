import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withModuleManager } from "@/lib/apiAuth";
import { Module } from "@/models/Module";
import { Settings } from "@/models/Settings";
import mongoose from "mongoose";
import { deleteUploadThingFile, isHttpUrl } from "@/lib/uploadthingFiles";


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
 * fase/subCategoryId sesuai programType baru.
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
  if (typeof data.fileUrl === "string") {
    const fileUrl = data.fileUrl.trim();
    if (!fileUrl || !isHttpUrl(fileUrl)) {
      return { ok: false, error: "Upload file atau link materi yang valid wajib diisi." };
    }
    out.fileUrl = fileUrl;
  }
  if (typeof data.order === "number") out.order = data.order;
  if (typeof data.learningLocation === "string") out.learningLocation = data.learningLocation.trim();

  if (data.week !== undefined) {
    if (data.week === null || data.week === "") {
      out.week = null;
    } else {
      const w = Number(data.week);
      if (!Number.isFinite(w) || w < 1) return { ok: false, error: "week tidak valid." };
      out.week = Math.floor(w);
    }
  }

  if (data.month !== undefined) {
    if (data.month === null || data.month === "") {
      out.month = null;
    } else {
      const m = Number(data.month);
      if (!Number.isFinite(m) || m < 1 || m > 12) {
        return { ok: false, error: "Bulan tidak valid (harus 1-12)." };
      }
      out.month = Math.floor(m);
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

  // Penanganan lokasi belajar + programType + fase.
  // Fase wajib untuk modul offline.
  if (data.programType !== undefined || data.learningLocation !== undefined) {
    out.programType = "OFFLINE";

    const fase = String(data.fase || "").trim().toUpperCase();
    if (!fase) {
      return { ok: false, error: "Fase wajib diisi." };
    }
    const validLevels = await getAvailableLevels();
    if (validLevels.size > 0 && !validLevels.has(fase)) {
      return {
        ok: false,
        error: `Fase "${fase}" tidak terdaftar di faseConfig.`,
      };
    }
    out.fase = fase;
    out.subject = typeof data.subject === "string" ? data.subject.trim() : "";
  } else {
    // ProgramType tidak diubah — terima fase / subject bila dikirim.
    if (typeof data.fase === "string") {
      const fase = data.fase.trim().toUpperCase();
      if (fase) {
        const validLevels = await getAvailableLevels();
        if (validLevels.size > 0 && !validLevels.has(fase)) {
          return {
            ok: false,
            error: `Fase "${fase}" tidak terdaftar di faseConfig.`,
          };
        }
      }
      out.fase = fase;
    }
    if (typeof data.subject === "string") {
      out.subject = data.subject.trim();
    }
  }

  return { ok: true, doc: out };
}

export const PUT = withModuleManager<{ params: Promise<{ id: string }> }>(
  async (request, _session, { params }) => {
  try {
    const { id } = await params;
    const data = await request.json();
    await connectDB();

    const validated = await buildUpdate(data);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }

    const existing = await Module.findById(id).select("fileUrl").lean<{ fileUrl?: string }>();
    const updated = await Module.findByIdAndUpdate(id, { $set: validated.doc }, { new: true });
    if (!updated) {
      return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });
    }
    const newFileUrl = typeof validated.doc.fileUrl === "string" ? validated.doc.fileUrl : undefined;
    if (existing?.fileUrl && newFileUrl && existing.fileUrl !== newFileUrl) {
      await deleteUploadThingFile(existing.fileUrl).catch((error) => {
        console.error("Gagal menghapus file modul lama:", error);
      });
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
});

export const DELETE = withModuleManager<{ params: Promise<{ id: string }> }>(
  async (_request, _session, { params }) => {
  try {
    const { id } = await params;
    await connectDB();
    const deleted = await Module.findByIdAndDelete(id);

    if (!deleted) return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });

    await deleteUploadThingFile(deleted.fileUrl).catch((error) => {
      console.error("Gagal menghapus file modul:", error);
    });

    return NextResponse.json({ message: "Modul berhasil dihapus" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
