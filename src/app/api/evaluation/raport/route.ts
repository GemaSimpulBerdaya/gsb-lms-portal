import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { NilaiOffline, AnakDidik } from "@/models/Relawan";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const anakDidikId = searchParams.get("anakDidikId");
  const semester = searchParams.get("semester");

  if (!anakDidikId || !semester) {
    return NextResponse.json(
      { error: "anakDidikId dan semester wajib diisi" },
      { status: 400 }
    );
  }

  await connectDB();

  const [anakDidik, semuaNilai] = await Promise.all([
    AnakDidik.findById(anakDidikId).select("name region category parentName"),
    NilaiOffline.find({ anakDidikId, relawanId: session.id, semester }),
  ]);

  if (!anakDidik) {
    return NextResponse.json({ error: "Anak didik tidak ditemukan" }, { status: 404 });
  }

  const nilaiTugas = semuaNilai.filter((n) => n.type === "TUGAS");
  const nilaiUjian = semuaNilai.filter((n) => n.type === "UJIAN");

  const rataRataTugas =
    nilaiTugas.length > 0
      ? Math.round(nilaiTugas.reduce((sum, n) => sum + n.score, 0) / nilaiTugas.length)
      : null;

  const rataRataUjian =
    nilaiUjian.length > 0
      ? Math.round(nilaiUjian.reduce((sum, n) => sum + n.score, 0) / nilaiUjian.length)
      : null;

  const nilaiAkhir =
    rataRataTugas !== null && rataRataUjian !== null
      ? Math.round(rataRataTugas * 0.6 + rataRataUjian * 0.4)
      : null;

  return NextResponse.json({
    anakDidik,
    semester,
    raport: {
      rataRataTugas,
      rataRataUjian,
      nilaiAkhir,
      totalPertemuanTugas: nilaiTugas.length,
      detailTugas: nilaiTugas.sort((a, b) => (a.week ?? 0) - (b.week ?? 0)),
      detailUjian: nilaiUjian,
    },
  });
}
