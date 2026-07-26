import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { Module } from "@/models/Module";
import { MateriAjar } from "@/models/MateriAjar";
import { Settings } from "@/models/Settings";
import { DEFAULT_FASE_CONFIG } from "@/lib/reportDefaults";

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export const GET = withVolunteer(async (request) => {
  const { searchParams } = request.nextUrl;
  const fase = searchParams.get("fase");
  const region = searchParams.get("region");
  const monthParam = searchParams.get("month");
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
    fase: { $regex: new RegExp(`^${escapeRegex(canonicalFase.trim())}$`, "i") },
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
      { semester: "" } // Allow legacy resources to show up
    ];
  }

  if (monthParam) {
    const month = parseInt(monthParam, 10);
    if (isNaN(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "Parameter month harus angka 1-12" }, { status: 400 });
    }
    filter.month = month;
  }

  const [modules, teachingMaterials] = await Promise.all([
    Module.find(filter)
      .select("title slug description month fileUrl order fase subject learningLocation")
      .sort({ month: 1, subject: 1, order: 1 })
      .lean(),
    MateriAjar.find(filter)
      .select("title description month fileUrl fase subject learningLocation createdAt")
      .sort({ month: 1, subject: 1, createdAt: -1 })
      .lean(),
  ]);

  const resourcesByMonth: Record<number, {
    modules: typeof modules;
    teachingMaterials: typeof teachingMaterials;
  }> = {};
  for (const mod of modules) {
    const month = mod.month ?? 0;
    if (!resourcesByMonth[month]) resourcesByMonth[month] = { modules: [], teachingMaterials: [] };
    resourcesByMonth[month].modules.push(mod);
  }
  for (const material of teachingMaterials) {
    const month = material.month ?? 0;
    if (!resourcesByMonth[month]) resourcesByMonth[month] = { modules: [], teachingMaterials: [] };
    resourcesByMonth[month].teachingMaterials.push(material);
  }

  return NextResponse.json({
    fase: canonicalFase,
    learningLocation: locationFilter || null,
    totalModules: modules.length,
    totalTeachingMaterials: teachingMaterials.length,
    modules,
    teachingMaterials,
    resourcesByMonth,
  });
});
