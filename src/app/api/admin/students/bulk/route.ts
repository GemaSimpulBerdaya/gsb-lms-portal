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

type RawStudent = Record<string, unknown>;

function pickAllowed(body: RawStudent) {
  const out: Record<string, unknown> = {};
  for (const f of ALLOWED_FIELDS) {
    if (body[f] !== undefined && body[f] !== null && body[f] !== "") out[f] = body[f];
  }
  return out;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { students } = body as { students: RawStudent[] };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "Data siswa tidak valid" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    // Filter dan sanitasi ke field yang diperbolehkan.
    // Minimal harus punya name + category.
    const validStudents = students
      .map(pickAllowed)
      .filter((s) => s.name && s.category);

    if (validStudents.length === 0) {
      return NextResponse.json({ error: "Tidak ada data siswa valid untuk diimpor" }, { status: 400 });
    }

    // Insert many
    const result = await AnakDidik.insertMany(validStudents);

    return NextResponse.json({
      message: `${result.length} data siswa berhasil diimpor`,
      count: result.length,
    });
  } catch (error) {
    console.error("Bulk Create Students Error:", error);
    return NextResponse.json({ error: "Gagal mengimpor data siswa" }, { status: 500 });
  }
}
