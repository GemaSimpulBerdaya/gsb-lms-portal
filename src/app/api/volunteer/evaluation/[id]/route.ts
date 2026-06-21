import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { NilaiOffline } from "@/models/NilaiOffline";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_TYPES = ["TUGAS", "UAS", "TUGAS_SNBT", "TRYOUT"] as const;
const VALID_SUBJECTS = [
  "NUMERASI",
  "SAINS",
  "BINDO",
  "BING",
  "MANDIRI",
  "BERNALAR_KRITIS",
  "KREATIF",
] as const;
// TRYOUT subject whitelist (lihat route.ts utama untuk rasionalnya).
const VALID_TRYOUT_SUBJECTS = ["TO1", "TO2"] as const;

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
  if (type === "TUGAS") {
    const c = scoreConcept ?? 0;
    const q = scoreQuiz ?? 0;
    const a = scoreAttitude ?? 0;
    return Math.round((c + q + a) / 3);
  }
  // UAS / TUGAS_SNBT / TRYOUT — score tunggal langsung.
  return rawScore ?? 0;
}

export const PUT = withVolunteer<RouteParams>(async (request, session, { params }) => {
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

  // SNBT: KBM SNBT + TRYOUT (TO1/TO2). PUT dipakai FE untuk update record
  // existing — week & subject biasanya gak berubah, tapi tetap validasi.
  if (type === "TUGAS_SNBT" && !week) {
    return NextResponse.json(
      { error: "week wajib diisi untuk tipe TUGAS_SNBT" },
      { status: 400 }
    );
  }
  let normalizedTryoutSubject: string | null = null;
  if (type === "TRYOUT") {
    if (!week) {
      return NextResponse.json(
        { error: "week wajib diisi untuk tipe TRYOUT" },
        { status: 400 }
      );
    }
    const subjRaw = typeof subject === "string" ? subject.trim().toUpperCase() : "";
    if (!VALID_TRYOUT_SUBJECTS.includes(subjRaw as (typeof VALID_TRYOUT_SUBJECTS)[number])) {
      return NextResponse.json(
        {
          error: `subject TRYOUT wajib salah satu dari: ${VALID_TRYOUT_SUBJECTS.join(", ")}`,
        },
        { status: 400 }
      );
    }
    normalizedTryoutSubject = subjRaw;
  }

  const finalScore = computeFinalScore({
    type,
    rawScore: score,
    scoreConcept,
    scoreQuiz,
    scoreAttitude,
  });

  await connectDB();

  const nilai = await NilaiOffline.findOne({ _id: id, teamAccountId: session.id });
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
  // subject ikut tipe: UAS pakai whitelist subject mata pelajaran, TRYOUT
  // pakai whitelist TO1/TO2, sisanya (TUGAS, TUGAS_SNBT) selalu null.
  nilai.subject =
    type === "UAS"
      ? subject
      : type === "TRYOUT"
      ? normalizedTryoutSubject
      : null;
  nilai.maxScore = type === "UAS" ? maxScore : null;
  nilai.title = title ?? nilai.title;
  nilai.notes = notes ?? nilai.notes;
  nilai.moduleId = moduleId ?? nilai.moduleId;
  nilai.semester = semester;
  await nilai.save();

  return NextResponse.json({ message: "Nilai berhasil diperbarui", nilai });
});

export const DELETE = withVolunteer<RouteParams>(async (_request, session, { params }) => {
  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  await connectDB();

  const existingNilai = await NilaiOffline.findOne({ _id: id, teamAccountId: session.id });
  if (!existingNilai) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  if (existingNilai.semester !== getCurrentSemester()) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus data semester lampau (Arsip)" },
      { status: 403 }
    );
  }

  const result = await NilaiOffline.findOneAndDelete({ _id: id, teamAccountId: session.id });
  if (!result) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  return NextResponse.json({ message: "Nilai berhasil dihapus" });
});
