import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { NilaiOffline } from "@/models/Relawan";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const anakDidikId = searchParams.get("anakDidikId");
  const week = searchParams.get("week");
  const type = searchParams.get("type");

  const filter: Record<string, unknown> = { relawanId: session.id };

  if (anakDidikId) filter.anakDidikId = anakDidikId;
  if (week) filter.week = parseInt(week, 10);
  if (type) filter.type = type.toUpperCase();

  await connectDB();

  const nilai = await NilaiOffline.find(filter)
    .populate("anakDidikId", "name region category")
    .sort({ week: 1, createdAt: -1 });

  return NextResponse.json({ total: nilai.length, nilai });
}

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { anakDidikId, type, week, score, notes, moduleId, semester } = await request.json();

  if (!anakDidikId || !type || score === undefined || !semester) {
    return NextResponse.json(
      { error: "anakDidikId, type, score, dan semester wajib diisi" },
      { status: 400 }
    );
  }

  const validTypes = ["TUGAS", "UJIAN", "KUIS"];
  if (!validTypes.includes(type.toUpperCase())) {
    return NextResponse.json(
      { error: `Type tidak valid. Pilihan: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  if (type.toUpperCase() === "TUGAS" && !week) {
    return NextResponse.json({ error: "week wajib diisi untuk tipe TUGAS" }, { status: 400 });
  }

  await connectDB();

  const nilai = await NilaiOffline.create({
    anakDidikId,
    relawanId: session.id,
    moduleId: moduleId ?? null,
    type: type.toUpperCase(),
    week: week ?? null,
    score,
    notes,
    semester,
  });

  return NextResponse.json({ message: "Nilai berhasil disimpan", nilai }, { status: 201 });
}
