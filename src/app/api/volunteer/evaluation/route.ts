import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { NilaiOffline } from "@/models/Relawan";

const VALID_TYPES = ["TUGAS", "UJIAN", "KUIS", "UTS", "UAS", "TRYOUT"] as const;
const VALID_SUBJECTS = [
  "NUMERASI",
  "SAINS",
  "BINDO",
  "BING",
  "MANDIRI",
  "BERNALAR_KRITIS",
  "KREATIF",
] as const;

type EvalType = typeof VALID_TYPES[number];

const getCurrentSemester = () => {
  const d = new Date();
  return `${d.getFullYear()}-1`;
};

function computeFinalScore(params: {
  type: EvalType;
  rawScore?: number;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
}) {
  const { type, rawScore, scoreConcept, scoreQuiz, scoreAttitude } = params;
  // TUGAS/KUIS = rata-rata 3 skor harian (Konsep/Kuis/Sikap)
  if (type === "TUGAS" || type === "KUIS") {
    const c = scoreConcept ?? 0;
    const q = scoreQuiz ?? 0;
    const a = scoreAttitude ?? 0;
    return Math.round((c + q + a) / 3);
  }
  // UTS/UAS/TRYOUT/UJIAN = skor langsung (bisa out-of-maxScore untuk UAS)
  return rawScore ?? 0;
}

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const anakDidikId = searchParams.get("anakDidikId");
  const week = searchParams.get("week");
  const type = searchParams.get("type");
  const semester = searchParams.get("semester");
  const title = searchParams.get("title");
  const subject = searchParams.get("subject");
  const tryoutNumber = searchParams.get("tryoutNumber");

  const filter: Record<string, unknown> = { relawanId: session.id };

  if (anakDidikId) filter.anakDidikId = anakDidikId;
  if (week) filter.week = parseInt(week, 10);
  if (type) filter.type = type.toUpperCase();
  if (semester) filter.semester = semester;
  if (title) filter.title = title;
  if (subject) filter.subject = subject;
  if (tryoutNumber) filter.tryoutNumber = parseInt(tryoutNumber, 10);

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

  const body = await request.json();
  const {
    anakDidikId,
    type: rawType,
    week,
    score,
    notes,
    moduleId,
    semester,
    title,
    scoreConcept,
    scoreQuiz,
    scoreAttitude,
    subject,
    maxScore,
    tryoutNumber,
  } = body ?? {};

  if (semester !== getCurrentSemester()) {
    return NextResponse.json(
      { error: "Tidak dapat mengubah data semester lampau" },
      { status: 403 }
    );
  }

  if (!anakDidikId || !rawType || !semester) {
    return NextResponse.json({ error: "Data penilaian tidak lengkap" }, { status: 400 });
  }

  const type = String(rawType).toUpperCase() as EvalType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Type tidak valid. Pilihan: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Validasi per-type
  if (type === "TUGAS" && !week) {
    return NextResponse.json({ error: "week wajib diisi untuk tipe TUGAS" }, { status: 400 });
  }
  if (type === "TRYOUT" && (!tryoutNumber || !week)) {
    return NextResponse.json(
      { error: "week & tryoutNumber wajib diisi untuk TRYOUT" },
      { status: 400 }
    );
  }
  if (type === "UAS") {
    if (!subject || !VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json(
        { error: `subject UAS wajib diisi dengan salah satu: ${VALID_SUBJECTS.join(", ")}` },
        { status: 400 }
      );
    }
    if (maxScore === undefined || maxScore === null || Number(maxScore) <= 0) {
      return NextResponse.json(
        { error: "maxScore wajib diisi untuk UAS" },
        { status: 400 }
      );
    }
    if (Number(score) > Number(maxScore)) {
      return NextResponse.json(
        { error: "Nilai tidak boleh melebihi nilai maksimal" },
        { status: 400 }
      );
    }
  }

  const finalScore = computeFinalScore({
    type,
    rawScore: score,
    scoreConcept,
    scoreQuiz,
    scoreAttitude,
  });

  await connectDB();

  const nilai = await NilaiOffline.create({
    anakDidikId,
    relawanId: session.id,
    moduleId: moduleId ?? null,
    title: title || "",
    type,
    week: week ?? null,
    score: finalScore,
    scoreConcept: scoreConcept ?? 0,
    scoreQuiz: scoreQuiz ?? 0,
    scoreAttitude: scoreAttitude ?? 0,
    subject: type === "UAS" ? subject : null,
    maxScore: type === "UAS" ? maxScore : null,
    tryoutNumber: type === "TRYOUT" ? tryoutNumber : null,
    notes,
    semester,
  });

  return NextResponse.json({ message: "Nilai berhasil disimpan", nilai }, { status: 201 });
}
