import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Student from "@/models/Student";
import { withAdmin } from "@/lib/apiAuth";
import { canonicalStudentFase, getConfiguredStudentFases } from "@/lib/studentFase";


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

export const GET = withAdmin(async () => {
  try {
    await connectDB();

    // Ambil semua anak didik, urutkan berdasarkan yang terbaru
    const students = await Student.find({}).sort({ createdAt: -1 });

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
    const name = typeof payload.name === "string" ? payload.name.trim() : "";

    if (!name || !payload.fase) {
      return NextResponse.json({ error: "Nama dan Kategori wajib diisi" }, { status: 400 });
    }

    await connectDB();

    const configuredFases = await getConfiguredStudentFases();
    const fase = canonicalStudentFase(payload.fase, configuredFases);
    if (!fase) {
      return NextResponse.json(
        { error: `Fase tidak valid. Pilihan: ${configuredFases.join(", ")}` },
        { status: 400 },
      );
    }
    payload.name = name;
    payload.fase = fase;

    const newStudent = new Student(payload);

    await newStudent.save();

    return NextResponse.json({ message: "Anak didik berhasil ditambahkan", student: newStudent });
  } catch (error) {
    console.error("Create Student Error:", error);
    return NextResponse.json({ error: "Gagal menambah anak didik" }, { status: 500 });
  }
});
