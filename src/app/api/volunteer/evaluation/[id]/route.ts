import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { NilaiOffline } from "@/models/NilaiOffline";
import mongoose from "mongoose";
import { getActiveSemester } from "@/lib/semester";
import { parseScore, validateEvaluationMeeting, validateUasWindow } from "@/lib/evaluationValidation";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const VALID_TYPES = ["TUGAS", "UAS"] as const;
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
  // UAS — score tunggal langsung.
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
    scheduleId,
  } = body ?? {};

  const activeSemester = await getActiveSemester();
  if (semester !== activeSemester) {
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
  }


  // Batas parse skor UAS ikut maxScore record (bisa != 100, dikonfigurasi
  // admin per fase) — konsisten dengan POST di route.ts utama.
  const uasMax = Number(maxScore);
  const scoreLimit = type === "UAS" && Number.isFinite(uasMax) && uasMax > 0 ? uasMax : 100;
  const parsedScore = parseScore(score, scoreLimit);
  const parsedConcept = parseScore(scoreConcept);
  const parsedQuiz = parseScore(scoreQuiz);
  const parsedAttitude = parseScore(scoreAttitude);
  if (type === "TUGAS" && (parsedConcept === null || parsedQuiz === null || parsedAttitude === null)) {
    return NextResponse.json(
      { error: "Nilai Pemahaman Konsep, Pengerjaan Kuis, dan Sikap Pembelajaran harus 0-100" },
      { status: 400 }
    );
  }
  if (type !== "TUGAS" && parsedScore === null) {
    return NextResponse.json({ error: `Nilai harus 0-${scoreLimit}` }, { status: 400 });
  }

  const finalScore = computeFinalScore({
    type,
    rawScore: parsedScore ?? undefined,
    scoreConcept: parsedConcept ?? undefined,
    scoreQuiz: parsedQuiz ?? undefined,
    scoreAttitude: parsedAttitude ?? undefined,
  });

  await connectDB();

  // Ownership dulu (query ter-index & paling diskriminatif) supaya id yang
  // salah/deleted dapat 404 yang benar, bukan error pertemuan yang menyesatkan.
  const nilai = await NilaiOffline.findOne({ _id: id, teamAccountId: session.id });
  if (!nilai) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  if (nilai.semester !== activeSemester) {
    return NextResponse.json(
      { error: "Tidak dapat mengubah data semester lampau (Arsip)" },
      { status: 403 }
    );
  }

  // Guard konteks pertemuan — WAJIB (bukan opt-in seperti versi lama yang bisa
  // di-bypass dengan menghapus field week dari body). Utamakan scheduleId yang
  // TERSIMPAN di record supaya client tidak bisa menukar jadwal saat edit;
  // record legacy (pra-scheduleId) fallback ke body lalu di-backfill di bawah.
  const effectiveScheduleId = nilai.scheduleId ? String(nilai.scheduleId) : scheduleId;
  const meetingError =
    type === "UAS"
      ? await validateUasWindow({
          scheduleId: effectiveScheduleId,
          teamAccountId: session.id,
          semester,
        })
      : await validateEvaluationMeeting({
          scheduleId: effectiveScheduleId,
          teamAccountId: session.id,
          semester,
          week,
        });
  if (meetingError) {
    return NextResponse.json({ error: meetingError }, { status: 403 });
  }

  // Validasi lolos ⇒ effectiveScheduleId adalah ObjectId string yang valid.
  nilai.scheduleId = new mongoose.Types.ObjectId(String(effectiveScheduleId));
  nilai.type = type;
  nilai.week = week ?? null;
  nilai.score = finalScore;
  nilai.scoreConcept = type === "TUGAS" ? parsedConcept! : 0;
  nilai.scoreQuiz = type === "TUGAS" ? parsedQuiz! : 0;
  nilai.scoreAttitude = type === "TUGAS" ? parsedAttitude! : 0;
  nilai.subject = type === "UAS" ? subject : null;
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

  if (existingNilai.semester !== await getActiveSemester()) {
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
