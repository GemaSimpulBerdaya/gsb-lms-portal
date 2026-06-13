import { NextResponse } from "next/server";
import mongoose from "mongoose";
import AnakDidik from "@/models/AnakDidik";
import { withAdmin } from "@/lib/apiAuth";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

const ALLOWED_FIELDS = [
  "name",
  "region",
  "fase",
  "parentName",
  "studentCode",
  "kodeKelas",
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

export const GET = withAdmin(async () => {
  try {
    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");

    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    // Ambil semua anak didik, urutkan berdasarkan yang terbaru
    const students = await AnakDidik.find({}).sort({ createdAt: -1 });

    return NextResponse.json({ students });
  } catch (error) {
    console.error("Fetch Students Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data anak didik" }, { status: 500 });
  }
});

export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const payload = pickAllowed(body);
    const { name, fase } = payload as { name?: string; fase?: string };

    if (!name || !fase) {
      return NextResponse.json({ error: "Nama dan Kategori wajib diisi" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const newStudent = new AnakDidik(payload);

    await newStudent.save();

    return NextResponse.json({ message: "Anak didik berhasil ditambahkan", student: newStudent });
  } catch (error) {
    console.error("Create Student Error:", error);
    return NextResponse.json({ error: "Gagal menambah anak didik" }, { status: 500 });
  }
});
