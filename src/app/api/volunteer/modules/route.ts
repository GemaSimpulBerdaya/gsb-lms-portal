import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Module } from "@/models/Core";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const level = searchParams.get("level");
  const weekParam = searchParams.get("week");

  if (!level) {
    return NextResponse.json({ error: "Parameter level wajib diisi" }, { status: 400 });
  }

  const validLevels = ["DISABILITAS", "TK", "SD", "SMP"];
  if (!validLevels.includes(level.toUpperCase())) {
    return NextResponse.json(
      { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  await connectDB();

  const filter: Record<string, unknown> = {
    category: "OFFLINE",
    subCategory: level.toUpperCase(),
  };

  if (weekParam) {
    const week = parseInt(weekParam, 10);
    if (isNaN(week) || week < 1) {
      return NextResponse.json({ error: "Parameter week harus berupa angka positif" }, { status: 400 });
    }
    filter.week = week;
  }

  const modules = await Module.find(filter)
    .select("title slug description week fileUrl order")
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
      level: level.toUpperCase(),
      totalModules: modules.length,
      weeks: grouped,
    });
  }

  return NextResponse.json({
    level: level.toUpperCase(),
    week: parseInt(weekParam, 10),
    totalModules: modules.length,
    modules,
  });
}
