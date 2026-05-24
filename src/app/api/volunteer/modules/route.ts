import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Module } from "@/models/Module";
import { Settings } from "@/models/Settings";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const fase = searchParams.get("fase");
  const weekParam = searchParams.get("week");
  const semester = searchParams.get("semester");

  if (!fase) {
    return NextResponse.json({ error: "Parameter fase wajib diisi" }, { status: 400 });
  }

  await connectDB();
  const levelsSetting = await Settings.findOne({ key: "availableLevels" });
  const validLevels = levelsSetting?.value || ["DISABILITAS", "FASE PUCUK", "FASE A", "FASE B", "FASE C", "FASE D", "FASE E", "SNBT"];
  
  if (!validLevels.includes(fase.toUpperCase())) {
    return NextResponse.json(
      { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  await connectDB();

  const filter: Record<string, unknown> = {
    programType: "OFFLINE",
  };

  // Handle nested sub-categories (Grades)
  if (fase.toUpperCase() === "SD") {
    filter.subCategoryId = { $in: ["SD", "Kelas 1", "Kelas 2", "Kelas 3", "Kelas 4", "Kelas 5", "Kelas 6"] };
  } else if (fase.toUpperCase() === "SMP") {
    filter.subCategoryId = { $in: ["SMP", "Kelas 7", "Kelas 8", "Kelas 9"] };
  } else {
    filter.subCategoryId = fase.toUpperCase();
  }

  if (semester) {
    filter.$or = [
      { semester: semester },
      { semester: { $exists: false } },
      { semester: "" },
      { semester: "2025-1" } // Allow legacy modules to show up
    ];
  }

  if (weekParam) {
    const week = parseInt(weekParam, 10);
    if (isNaN(week) || week < 1) {
      return NextResponse.json({ error: "Parameter week harus berupa angka positif" }, { status: 400 });
    }
    filter.week = week;
  }

  const modules = await Module.find(filter)
    .select("title slug description week fileUrl order subCategoryId")
    .sort({ week: 1, order: 1 });

  // Kelompokkan per minggu jika tidak ada filter week spesifik
  if (!weekParam) {
    const grouped = modules.reduce<Record<number, typeof modules>>((acc, mod) => {
      const w = mod.week ?? 0;
      if (!acc[w]) acc[w] = [];
      acc[w].push(mod);
      return acc;
    }, {});

    return NextResponse.json({
      fase: fase.toUpperCase(),
      totalModules: modules.length,
      weeks: grouped,
    });
  }

  return NextResponse.json({
    fase: fase.toUpperCase(),
    week: parseInt(weekParam, 10),
    totalModules: modules.length,
    modules,
  });
}
