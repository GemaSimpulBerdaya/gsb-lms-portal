import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import Student from "@/models/Student";
import { Settings } from "@/models/Settings";
import { DEFAULT_FASE_CONFIG } from "@/lib/reportDefaults";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withVolunteer(async (request) => {
  const { searchParams } = request.nextUrl;
  const region = searchParams.get("region");
  // Terima `fase` (canonical) ATAU `level` (legacy alias) — biar FE lama
  // yang masih kirim `level` gak break sampai semua page selesai dipatch.
  const fase = searchParams.get("fase") || searchParams.get("level");

  if (!region || !fase) {
    return NextResponse.json(
      { error: "Parameter lokasi belajar dan fase wajib diisi" },
      { status: 400 }
    );
  }

  await connectDB();
  // Daftar fase valid di-derive dari faseConfig (single source of truth,
  // di-CRUD via /admin/semesters?tab=lokasi-belajar), fallback ke DEFAULT_FASE_CONFIG.
  // Key legacy `availableLevels` sudah dihapus migrasi — jangan dibaca lagi.

  const faseDoc = await Settings.findOne({ key: "faseConfig" }).lean<{
    value: Record<string, unknown>;
  }>();
  const faseConfig =
    faseDoc?.value && typeof faseDoc.value === "object"
      ? faseDoc.value
      : DEFAULT_FASE_CONFIG;
  const validLevels = Object.keys(faseConfig);

  if (!validLevels.includes(fase.toUpperCase())) {
    return NextResponse.json(
      { error: `Fase tidak valid. Pilihan: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  // Query students by region+fase. Tambah alias `category = fase` di hasil
  // untuk backward-compat dengan FE lama yang masih baca student.category.
  const studentsRaw = await Student.find({
    region: { $regex: new RegExp(`^${escapeRegex(region.trim())}$`, "i") },
    fase: { $regex: new RegExp(`^${escapeRegex(fase.trim())}$`, "i") },
  })
    .select("name region fase parentName studentCode")
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
});
