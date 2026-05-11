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
  const level = searchParams.get("level");

  if (!region || !level) {
    return NextResponse.json(
      { error: "Parameter region dan level wajib diisi" },
      { status: 400 }
    );
  }

  await connectDB();
  const levelsSetting = await Settings.findOne({ key: "availableLevels" });
  const validLevels = levelsSetting?.value || ["DISABILITAS", "FASE PUCUK", "FASE A", "FASE B", "FASE C", "FASE D", "FASE E", "SNBT"];

  if (!validLevels.includes(level.toUpperCase())) {
    return NextResponse.json(
      { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  await connectDB();

  // 🔥 CEK SEMUA DATA DI DB
  const allData = await AnakDidik.find();
  console.log("ALL DATA:", allData);

  // 🔥 QUERY FILTER + SELECT + SORT (BENAR)
  const students = await AnakDidik.find({
    region: { $regex: new RegExp(`^${region.trim()}$`, "i") },
    category: { $regex: new RegExp(`^${level.trim()}$`, "i") },
  })
    .select("name region category parentName")
    .sort({ name: 1 });

  console.log("FILTERED:", students);

  return NextResponse.json({
    total: students.length,
    region,
    level: level.toUpperCase(),
    students,
  });
}