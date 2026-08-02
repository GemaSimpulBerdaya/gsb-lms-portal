import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { NilaiOffline } from "@/models/NilaiOffline";
import { getActiveSemester } from "@/lib/semester";
import { parseScore, validateEvaluationMeeting, validateUasWindow } from "@/lib/evaluationValidation";

const VALID_TYPES = ["TUGAS", "UAS"] as const;

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
  // UAS = skor tunggal langsung (0-maxScore).
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


  // UAS boleh punya maxScore != 100 (dikonfigurasi admin per fase via
  // report-config) — batas parse skor harus ikut maxScore record, bukan
  // hardcode 100. Kalau maxScore invalid, guard "maxScore wajib" di bawah
  // yang menolak.
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

  // Guard konteks pertemuan — WAJIB untuk semua tipe, bukan opt-in
  // (versi lama `if (meetingWeek ?? week)` bisa di-bypass cukup dengan
  // menghapus field week dari body, dan memvalidasi week yang berbeda
  // dari yang dipersist).
  //  - TUGAS: `week` yang DISIMPAN harus
  //    ada di kbmDates jadwal milik tim dan tanggalnya sudah tercapai.
  //  - UAS: baru bisa diisi setelah tanggal pertemuan terakhir tercapai.
  const meetingError =
    type === "UAS"
      ? await validateUasWindow({ scheduleId, teamAccountId: session.id, semester })
      : await validateEvaluationMeeting({ scheduleId, teamAccountId: session.id, semester, week });
  if (meetingError) {
    return NextResponse.json({ error: meetingError }, { status: 403 });
  }

  const nilai = await NilaiOffline.create({
    studentId,
    teamAccountId: session.id,
    scheduleId,
    moduleId: moduleId ?? null,
    title: title || "",
    type,
    week: week ?? null,
    score: finalScore,
    scoreConcept: type === "TUGAS" ? parsedConcept! : 0,
    scoreQuiz: type === "TUGAS" ? parsedQuiz! : 0,
    scoreAttitude: type === "TUGAS" ? parsedAttitude! : 0,
    subject: type === "UAS" ? normalizedSubject : null,
    maxScore: type === "UAS" ? maxScore : null,
    rubricItems: type === "UAS" ? validatedRubric : [],
    notes,
    semester,
  });

  return NextResponse.json({ message: "Nilai berhasil disimpan", nilai }, { status: 201 });
});
