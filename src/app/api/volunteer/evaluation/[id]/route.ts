import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { NilaiOffline } from "@/models/Relawan";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
  if (type === "TUGAS" || type === "KUIS") {
    const c = scoreConcept ?? 0;
    const q = scoreQuiz ?? 0;
    const a = scoreAttitude ?? 0;
    return Math.round((c + q + a) / 3);
  }
  return rawScore ?? 0;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  const body = await request.json();
  const {
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

  if (!rawType || !semester) {
    return NextResponse.json({ error: "Data penilaian tidak lengkap" }, { status: 400 });
  }

  const type = String(rawType).toUpperCase() as EvalType;
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `Type tidak valid. Pilihan: ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  if (type === "TUGAS" && !week) {
    return NextResponse.json({ error: "week wajib diisi untuk tipe TUGAS" }, { status: 400 });
  }
  if (type === "TRYOUT") {
    if (!tryoutNumber || !week) {
      return NextResponse.json({ error: "week & tryoutNumber wajib diisi untuk TRYOUT" }, { status: 400 });
    }
  }
  if (type === "UAS") {
    if (!subject || !VALID_SUBJECTS.includes(subject)) {
      return NextResponse.json(
        { error: `subject UAS wajib diisi dengan salah satu: ${VALID_SUBJECTS.join(", ")}` },
        { status: 400 }
      );
    }
    if (maxScore === undefined || maxScore === null || Number(maxScore) <= 0) {
      return NextResponse.json({ error: "maxScore wajib diisi untuk UAS" }, { status: 400 });
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

  const nilai = await NilaiOffline.findOne({ _id: id, relawanId: session.id });
  if (!nilai) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  if (nilai.semester !== getCurrentSemester()) {
    return NextResponse.json(
      { error: "Tidak dapat mengubah data semester lampau (Arsip)" },
      { status: 403 }
    );
  }

  nilai.type = type;
  nilai.week = week ?? null;
  nilai.score = finalScore;
  nilai.scoreConcept = scoreConcept ?? nilai.scoreConcept;
  nilai.scoreQuiz = scoreQuiz ?? nilai.scoreQuiz;
  nilai.scoreAttitude = scoreAttitude ?? nilai.scoreAttitude;
  nilai.subject = type === "UAS" ? subject : null;
  nilai.maxScore = type === "UAS" ? maxScore : null;
  nilai.tryoutNumber = type === "TRYOUT" ? tryoutNumber : null;
  nilai.title = title ?? nilai.title;
  nilai.notes = notes ?? nilai.notes;
  nilai.moduleId = moduleId ?? nilai.moduleId;
  nilai.semester = semester;
  await nilai.save();

  return NextResponse.json({ message: "Nilai berhasil diperbarui", nilai });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  await connectDB();

  const existingNilai = await NilaiOffline.findOne({ _id: id, relawanId: session.id });
  if (!existingNilai) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  if (existingNilai.semester !== getCurrentSemester()) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus data semester lampau (Arsip)" },
      { status: 403 }
    );
  }

  const result = await NilaiOffline.findOneAndDelete({ _id: id, relawanId: session.id });
  if (!result) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  return NextResponse.json({ message: "Nilai berhasil dihapus" });
}
