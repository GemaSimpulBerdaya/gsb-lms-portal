import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { NilaiOffline } from "@/models/NilaiOffline";
import { getActiveSemester } from "@/lib/semester";
import { parseScore, validateEvaluationMeeting } from "@/lib/evaluationValidation";

// SNBT (Juni 2026): TUGAS_SNBT + TRYOUT ditambahkan di model NilaiOffline
// (lihat NilaiOffline.ts) supaya halaman evaluasi relawan untuk fase
// "Fase E (SNBT)" bisa simpan KBM SNBT + TO1/TO2 lewat endpoint yang sama.
const VALID_TYPES = ["TUGAS", "UAS", "TUGAS_SNBT", "TRYOUT"] as const;
// Subject TRYOUT terbatas: TO1 = sebelum KBM, TO2 = sesudah KBM.
// Tanpa whitelist ini, FE bug bisa nyelipin subject random ke kolom yang
// jadi sumber bucketing aggregator → angka di rapor jadi salah.
const VALID_TRYOUT_SUBJECTS = ["TO1", "TO2"] as const;

type EvalType = typeof VALID_TYPES[number];


function computeFinalScore(params: {
  type: EvalType;
  rawScore?: number;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
}) {
  const { type, rawScore, scoreConcept, scoreQuiz, scoreAttitude } = params;
  // TUGAS = rata-rata 3 skor harian (Konsep/Kuis/Sikap)
  if (type === "TUGAS") {
    const c = scoreConcept ?? 0;
    const q = scoreQuiz ?? 0;
    const a = scoreAttitude ?? 0;
    return Math.round((c + q + a) / 3);
  }
  // UAS / TUGAS_SNBT / TRYOUT = skor tunggal langsung (0-100 / 0-maxScore).
  // SNBT tidak punya breakdown Konsep/Kuis/Sikap — score adalah total final.
  return rawScore ?? 0;
}

// Normalisasi subject UAS: trim + uppercase + replace spasi -> underscore.
// Subject bersifat bebas (String) dan divalidasi di level logic aplikasi via
// `faseConfig` di settings, bukan enum Mongoose. Validator di sini hanya
// memastikan format dasar.
function normalizeSubject(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim().toUpperCase().replace(/\s+/g, "_");
  if (!trimmed) return null;
  // Minimal: huruf, angka, underscore. Hindari karakter aneh yang bisa
  // bikin masalah di UI/PDF.
  if (!/^[A-Z0-9_]+$/.test(trimmed)) return null;
  return trimmed;
}

// Validasi rubricItems untuk UAS.
// Bentuk setiap item: { criterion: string, score: number, maxScore: number }.
// Boleh kosong/absen (untuk UAS ringkas yang cuma pakai 1 skor total).
function validateRubricItems(raw: unknown):
  | { ok: true; items: { criterion: string; score: number; maxScore: number }[] }
  | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, items: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: "rubricItems harus berupa array" };
  }
  const items: { criterion: string; score: number; maxScore: number }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const it = raw[i] as Record<string, unknown> | null;
    if (!it || typeof it !== "object") {
      return { ok: false, error: `rubricItems[${i}] tidak valid` };
    }
    const criterion = typeof it.criterion === "string" ? it.criterion.trim() : "";
    const score = Number(it.score);
    const maxScore = Number(it.maxScore);
    if (!criterion) {
      return { ok: false, error: `rubricItems[${i}].criterion wajib diisi` };
    }
    if (!Number.isFinite(score) || score < 0) {
      return { ok: false, error: `rubricItems[${i}].score tidak valid` };
    }
    if (!Number.isFinite(maxScore) || maxScore <= 0) {
      return { ok: false, error: `rubricItems[${i}].maxScore tidak valid` };
    }
    if (score > maxScore) {
      return {
        ok: false,
        error: `rubricItems[${i}].score (${score}) tidak boleh melebihi maxScore (${maxScore})`,
      };
    }
    items.push({ criterion, score, maxScore });
  }
  return { ok: true, items };
}

export const GET = withVolunteer(async (request, session) => {
  const { searchParams } = request.nextUrl;
  const studentId = searchParams.get("studentId");
  const week = searchParams.get("week");
  const type = searchParams.get("type");
  const semester = searchParams.get("semester");
  const title = searchParams.get("title");
  const subject = searchParams.get("subject");

  const filter: Record<string, unknown> = { teamAccountId: session.id };

  if (studentId) filter.studentId = studentId;
  if (week) filter.week = parseInt(week, 10);
  if (type) filter.type = type.toUpperCase();
  if (semester) filter.semester = semester;
  if (title) filter.title = title;
  if (subject) {
    const normalized = normalizeSubject(subject);
    if (normalized) filter.subject = normalized;
  }

  await connectDB();

  const nilai = await NilaiOffline.find(filter)
    .populate("studentId", "name region fase studentCode")
    .sort({ week: 1, createdAt: -1 });

  return NextResponse.json({ total: nilai.length, nilai });
});

export const POST = withVolunteer(async (request, session) => {
  const body = await request.json();
  const {
    studentId,
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
    rubricItems,
    scheduleId,
    meetingWeek,
  } = body ?? {};

  if (semester !== await getActiveSemester()) {
    return NextResponse.json(
      { error: "Tidak dapat mengubah data semester lampau" },
      { status: 403 }
    );
  }

  if (!studentId || !rawType || !semester) {
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

  // SNBT — validasi minim, score 0-100 sudah dijaga oleh sliderclamp di FE
  // tapi kita tetap reject kalau week absen (aggregator perlu week buat
  // bucketing per pekan).
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
    // TRYOUT subject HARUS TO1/TO2 — pakai whitelist eksak (bukan
    // normalizeSubject regex generik) supaya gak nerima nilai aneh seperti
    // "TO" atau "TO3".
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

  const parsedScore = parseScore(score);
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
    return NextResponse.json({ error: "Nilai harus 0-100" }, { status: 400 });
  }

  let normalizedSubject: string | null = null;
  let validatedRubric: { criterion: string; score: number; maxScore: number }[] = [];

  if (type === "UAS") {
    normalizedSubject = normalizeSubject(subject);
    if (!normalizedSubject) {
      return NextResponse.json(
        {
          error:
            "subject UAS wajib diisi (string, huruf kapital, boleh underscore/angka).",
        },
        { status: 400 }
      );
    }
    if (maxScore === undefined || maxScore === null || Number(maxScore) <= 0) {
      return NextResponse.json(
        { error: "maxScore wajib diisi untuk UAS" },
        { status: 400 }
      );
    }
    if (parsedScore !== null && parsedScore > Number(maxScore)) {
      return NextResponse.json(
        { error: "Nilai tidak boleh melebihi nilai maksimal" },
        { status: 400 }
      );
    }
    const rubricCheck = validateRubricItems(rubricItems);
    if (rubricCheck.ok) {
      validatedRubric = rubricCheck.items;
    } else {
      return NextResponse.json({ error: rubricCheck.error }, { status: 400 });
    }
  }

  const finalScore = computeFinalScore({
    type,
    rawScore: parsedScore ?? undefined,
    scoreConcept: parsedConcept ?? undefined,
    scoreQuiz: parsedQuiz ?? undefined,
    scoreAttitude: parsedAttitude ?? undefined,
  });

  await connectDB();

  if (meetingWeek ?? week) {
    const meetingError = await validateEvaluationMeeting({
      scheduleId,
      teamAccountId: session.id,
      semester,
      week: meetingWeek ?? week,
    });
    if (meetingError) {
      return NextResponse.json({ error: meetingError }, { status: 403 });
    }
  }

  const nilai = await NilaiOffline.create({
    studentId,
    teamAccountId: session.id,
    moduleId: moduleId ?? null,
    title: title || "",
    type,
    week: week ?? null,
    score: finalScore,
    scoreConcept: type === "TUGAS" ? parsedConcept! : 0,
    scoreQuiz: type === "TUGAS" ? parsedQuiz! : 0,
    scoreAttitude: type === "TUGAS" ? parsedAttitude! : 0,
    // subject hanya relevan untuk UAS (NUMERASI/SAINS/...) dan TRYOUT (TO1/TO2).
    // TUGAS dan TUGAS_SNBT pakai null.
    subject:
      type === "UAS"
        ? normalizedSubject
        : type === "TRYOUT"
        ? normalizedTryoutSubject
        : null,
    maxScore: type === "UAS" ? maxScore : null,
    rubricItems: type === "UAS" ? validatedRubric : [],
    notes,
    semester,
  });

  return NextResponse.json({ message: "Nilai berhasil disimpan", nilai }, { status: 201 });
});
