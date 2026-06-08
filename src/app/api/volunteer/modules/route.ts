import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { Module } from "@/models/Module";
import { Settings } from "@/models/Settings";
import { DEFAULT_FASE_CONFIG } from "@/lib/reportDefaults";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withVolunteer(async (request) => {
  const { searchParams } = request.nextUrl;
  const fase = searchParams.get("fase");
  const region = searchParams.get("region");
  const weekParam = searchParams.get("week");
  const semester = searchParams.get("semester");

  if (!fase) {
    return NextResponse.json({ error: "Parameter fase wajib diisi" }, { status: 400 });
  }

  await connectDB();
  const faseConfigDoc = await Settings.findOne({ key: "faseConfig" }).lean<{
    value?: Record<string, unknown>;
  }>();
  const faseConfig = faseConfigDoc?.value ?? DEFAULT_FASE_CONFIG;
  const validFases = Object.keys(faseConfig).sort();
  const requestedFase = fase.trim();
  const canonicalFase = validFases.find(
    (f) => f.trim().toUpperCase() === requestedFase.toUpperCase(),
  );

  if (!canonicalFase) {
    return NextResponse.json(
      { error: `Fase tidak valid. Pilihan: ${validFases.join(", ")}` },
      { status: 400 }
    );
  }

  const filter: Record<string, unknown> = {
    programType: "OFFLINE",
    fase: { $regex: new RegExp(`^${canonicalFase.trim()}$`, "i") },
  };

  const locationFilter = region?.trim();
  if (locationFilter) {
    filter.$and = [
      {
        $or: [
          { learningLocation: { $regex: new RegExp(`^${escapeRegex(locationFilter)}$`, "i") } },
          { learningLocation: { $exists: false } },
          { learningLocation: "" },
          { learningLocation: null },
        ],
      },
    ];
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
    .select("title slug description week fileUrl order fase subject learningLocation")
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
      fase: canonicalFase,
      learningLocation: locationFilter || null,
      totalModules: modules.length,
      weeks: grouped,
    });
  }

  return NextResponse.json({
    fase: canonicalFase,
    learningLocation: locationFilter || null,
    week: parseInt(weekParam, 10),
    totalModules: modules.length,
    modules,
  });
});
