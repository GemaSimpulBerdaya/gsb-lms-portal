import { NextResponse } from "next/server";
import mongoose from "mongoose";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import { withAdmin } from "@/lib/apiAuth";
import { canonicalStudentFaseUpdate, getConfiguredStudentFases } from "@/lib/studentFase";


const ALLOWED_FIELDS = [
  "name",
  "region",
  "fase",
  "parentName",
  "studentCode",
  "pic",
  "program",
  "gender",
  "birthPlace",
  "birthDate",
  "schoolOrigin",
  "phone",
  "parentPhone",
  "address",
  "profil",
] as const;

type AllowedField = typeof ALLOWED_FIELDS[number];

function pickAllowed(body: Record<string, unknown>) {
  const out: Partial<Record<AllowedField, unknown>> = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

export const PUT = withAdmin<{ params: Promise<{ id: string }> }>(
  async (request, _session, { params }) => {
    try {
      const { id } = await params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "ID anak didik tidak valid" }, { status: 400 });
      }
      const body = await request.json();
      const payload = pickAllowed(body);

      await connectDB();

      if (payload.fase !== undefined) {
        const configuredFases = await getConfiguredStudentFases();
        const existing = await Student.findById(id).select({ fase: 1 }).lean<{ fase?: string }>();
        if (!existing) {
          return NextResponse.json({ error: "Data siswa tidak ditemukan" }, { status: 404 });
        }
        const fase = canonicalStudentFaseUpdate(payload.fase, configuredFases, existing.fase);
        if (!fase) {
          return NextResponse.json(
            { error: `Fase tidak valid. Pilihan: ${configuredFases.join(", ")}` },
            { status: 400 },
          );
        }
        payload.fase = fase;
      }

      const updated = await Student.findByIdAndUpdate(
        id,
        { $set: payload },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return NextResponse.json({ error: "Data anak didik tidak ditemukan" }, { status: 404 });
      }

      return NextResponse.json({
        message: "Data anak didik berhasil diperbarui",
        student: updated
      });
    } catch (error) {
      console.error("Update Student Error:", error);
      return NextResponse.json({ error: "Gagal memperbarui data" }, { status: 500 });
    }
  }
);

export const DELETE = withAdmin<{ params: Promise<{ id: string }> }>(
  async (_request, _session, { params }) => {
    try {
      const { id } = await params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return NextResponse.json({ error: "ID anak didik tidak valid" }, { status: 400 });
      }

      await connectDB();

      const deleted = await Student.findByIdAndDelete(id);

      if (!deleted) {
        return NextResponse.json({ error: "Data anak didik tidak ditemukan" }, { status: 404 });
      }

      return NextResponse.json({ message: "Data anak didik berhasil dihapus" });
    } catch (error) {
      console.error("Delete Student Error:", error);
      return NextResponse.json({ error: "Gagal menghapus data anak didik" }, { status: 500 });
    }
  }
);
