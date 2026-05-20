import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getStudentSession } from "@/lib/student-session";
import { Module } from "@/models/Core";

/**
 * GET /api/student/modules
 * Mengambil daftar modul SNBT/Online untuk siswa SMA
 */
export async function GET() {
  const session = await getStudentSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized - Silakan login melalui portal SMA" }, { status: 401 });
  }

  try {
    await connectDB();

    // Ambil semua modul dengan kategori SNBT
    const modules = await Module.find({ category: "SNBT" })
      .select("title slug description category subCategory order fileUrl")
      .sort({ order: 1 });

    // Kelompokkan berdasarkan subCategory (Misal: Matematika, Bahasa Indonesia, dll)
    const groupedModules = modules.reduce<Record<string, typeof modules>>((acc, mod) => {
      const cat = mod.subCategory || "Umum";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(mod);
      return acc;
    }, {});

    return NextResponse.json({
      studentName: session.name,
      totalModules: modules.length,
      categories: groupedModules
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error instanceof Error ? error.message : "Terjadi kesalahan") }, { status: 500 });
  }
}
