import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import AnakDidik from "@/models/AnakDidik";
import { Settings } from "@/models/Settings";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const region = searchParams.get("region");
  // Terima `fase` (canonical) ATAU `level` (legacy alias) — biar FE lama
  // yang masih kirim `level` gak break sampai semua page selesai dipatch.
  const fase = searchParams.get("fase") || searchParams.get("level");

  if (!region || !fase) {
    return NextResponse.json(
      { error: "Parameter region dan fase wajib diisi" },
      { status: 400 }
    );
  }

  await connectDB();
  const levelsSetting = await Settings.findOne({ key: "availableLevels" });
  const validLevels = levelsSetting?.value || [
    "DISABILITAS",
    "FASE PUCUK",
    "FASE A",
    "FASE B",
    "FASE C",
    "FASE D",
    "FASE E",
    "SNBT",
  ];

  if (!validLevels.includes(fase.toUpperCase())) {
    return NextResponse.json(
      { error: `Fase tidak valid. Pilihan: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  // Query students by region+fase. Tambah alias `category = fase` di hasil
  // untuk backward-compat dengan FE lama yang masih baca student.category.
  const studentsRaw = await AnakDidik.find({
    region: { $regex: new RegExp(`^${region.trim()}$`, "i") },
    fase: { $regex: new RegExp(`^${fase.trim()}$`, "i") },
  })
    .select("name region fase parentName")
    .sort({ name: 1 })
    .lean();

  const students = studentsRaw.map((s) => ({
    ...s,
    category: (s as { fase?: string }).fase,
  }));

  return NextResponse.json({
    total: students.length,
    region,
    fase: fase.toUpperCase(),
    // Alias `level` untuk backward-compat FE lama
    level: fase.toUpperCase(),
    students,
  });
}
