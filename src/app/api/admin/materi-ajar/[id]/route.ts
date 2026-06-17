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

async function buildUpdate(
  data: Record<string, unknown>
): Promise<{ ok: true; doc: Record<string, unknown> } | { ok: false; error: string }> {
  if (!data || typeof data !== "object") return { ok: false, error: "Payload tidak valid." };

  const out: Record<string, unknown> = {};

  if (typeof data.title === "string") out.title = data.title.trim();
  if (typeof data.description === "string") out.description = data.description.trim();
  if (typeof data.fileUrl === "string") out.fileUrl = data.fileUrl.trim();
  if (typeof data.semester === "string") out.semester = data.semester;
  if (typeof data.subject === "string") out.subject = data.subject.trim();
  if (typeof data.uploadedBy === "string") out.uploadedBy = data.uploadedBy.trim();

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

  // learningLocation + programType + fase coupling.
  // CATATAN: Fase wajib utk SEMUA tipe (SNBT skrg juga punya fase).
  if (data.programType !== undefined || data.learningLocation !== undefined) {
    const learningLocation =
      typeof data.learningLocation === "string" ? data.learningLocation.trim() : "";
    const programType = deriveProgramType(learningLocation, data.programType);
    out.learningLocation = learningLocation;
    out.programType = programType;

    const fase = String(data.fase || "").trim().toUpperCase();
    if (!fase) return { ok: false, error: "Fase wajib diisi." };
    const validLevels = await getAvailableLevels();
    if (validLevels.size > 0 && !validLevels.has(fase)) {
      return { ok: false, error: `Fase "${fase}" tidak terdaftar di faseConfig.` };
    }
    out.fase = fase;
  } else if (typeof data.fase === "string") {
    const fase = data.fase.trim().toUpperCase();
    if (fase) {
      const validLevels = await getAvailableLevels();
      if (validLevels.size > 0 && !validLevels.has(fase)) {
        return { ok: false, error: `Fase "${fase}" tidak terdaftar di faseConfig.` };
      }
    }
    out.fase = fase;
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

      const updated = await MateriAjar.findByIdAndUpdate(
        id,
        { $set: validated.doc },
        { new: true }
      );
      if (!updated) {
        return NextResponse.json({ error: "Materi ajar tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json({ message: "Materi ajar berhasil diperbarui", item: updated });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);

export const DELETE = withModuleManager<{ params: Promise<{ id: string }> }>(
  async (_request, _session, { params }) => {
    try {
      const { id } = await params;
      await connectDB();
      const deleted = await MateriAjar.findByIdAndDelete(id);
      if (!deleted) {
        return NextResponse.json({ error: "Materi ajar tidak ditemukan" }, { status: 404 });
      }
      return NextResponse.json({ message: "Materi ajar berhasil dihapus" });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }
);
