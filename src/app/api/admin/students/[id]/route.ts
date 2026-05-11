import { NextResponse } from "next/server";
import mongoose from "mongoose";
import AnakDidik from "@/models/AnakDidik";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

const ALLOWED_FIELDS = [
  "name",
  "region",
  "category",
  "parentName",
  "studentCode",
  "kodeKelas",
  "pic",
  "gender",
  "birthPlace",
  "birthDate",
  "schoolOrigin",
  "phone",
  "address",
] as const;

type AllowedField = typeof ALLOWED_FIELDS[number];

function pickAllowed(body: Record<string, unknown>) {
  const out: Partial<Record<AllowedField, unknown>> = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] !== undefined) out[f] = body[f];
  }
  return out;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const payload = pickAllowed(body);

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const updated = await AnakDidik.findByIdAndUpdate(
      id,
      { $set: payload },
      { new: true }
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const deleted = await AnakDidik.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Data anak didik tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Data anak didik berhasil dihapus" });
  } catch (error) {
    console.error("Delete Student Error:", error);
    return NextResponse.json({ error: "Gagal menghapus data anak didik" }, { status: 500 });
  }
}
