import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Schedule } from "@/models/Schedule";

export async function GET() {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const schedule = await Schedule.findOne({ relawanId: session.id });
  if (!schedule) {
    return NextResponse.json({ schedule: null });
  }

  return NextResponse.json({ schedule });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { region, level, activeWeek } = await request.json();

  if (!region || !level) {
    return NextResponse.json({ error: "region dan level wajib diisi" }, { status: 400 });
  }

  const validLevels = ["DISABILITAS", "TK", "SD", "SMP"];
  if (!validLevels.includes(level.toUpperCase())) {
    return NextResponse.json(
      { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
      { status: 400 }
    );
  }

  await connectDB();

  const schedule = await Schedule.findOneAndUpdate(
    { relawanId: session.id },
    {
      relawanId: session.id,
      region,
      level: level.toUpperCase(),
      ...(activeWeek !== undefined && { activeWeek }),
    },
    { upsert: true, new: true }
  );

  return NextResponse.json({ message: "Jadwal berhasil disimpan", schedule });
}
