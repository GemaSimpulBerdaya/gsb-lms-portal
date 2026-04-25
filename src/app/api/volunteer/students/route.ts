import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { AnakDidik } from "@/models/Relawan";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const region = searchParams.get("region");
  const level = searchParams.get("level");

  if (!region || !level) {
    return NextResponse.json({ error: "Parameter region dan level wajib diisi" }, { status: 400 });
  }

  const validLevels = ["DISABILITAS", "TK", "SD", "SMP"];
  if (!validLevels.includes(level.toUpperCase())) {
    return NextResponse.json(
      { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  await connectDB();

  const students = await AnakDidik.find({
    region: { $regex: new RegExp(`^${region}$`, "i") },
    category: level.toUpperCase(),
  }).select("name region category parentName").sort({ name: 1 });

  return NextResponse.json({
    total: students.length,
    region,
    level: level.toUpperCase(),
    students,
  });
}
