/**
 * Agregator rapor — fungsi murni yang menggabungkan data siswa/nilai/
 * absensi/jadwal/settings menjadi payload rapor siap cetak
 * (`ReportPayload[]`).
 *
 * Dipakai oleh:
 *  - `GET /api/admin/grades` — return list raport.
 *  - `GET /api/admin/grades/pdf` — render PDF untuk 1 siswa.
 *
 * Tidak ada dependency ke Next.js supaya mudah diuji dan dipakai ulang.
 */

import Student, { IStudent } from "@/models/Student";
import { NilaiOffline } from "@/models/NilaiOffline";
import { Attendance } from "@/models/Attendance";
import { Schedule } from "@/models/Schedule";
import { Settings } from "@/models/Settings";
import StudentPortfolio, { IStudentPortfolio } from "@/models/StudentPortfolio";
import { Report } from "@/models/Report";
import type { Types } from "mongoose";
import { escapeRegex } from "@/lib/regex";
import {
  DEFAULT_FASE_CONFIG,
  DEFAULT_REPORT_RUBRIC,
  derivePredikat,
  type FaseConfig,
  type ReportRubric,
  type UasComponent as FaseComponent,
} from "@/lib/reportDefaults";
import type {
  ReportPayload,
  UasComponent,
  WeeklyGrade,
  Meeting,
  AttendanceDay,
  PortfolioItem,
  DocumentationItem,
} from "@/lib/pdf/reportTypes";

/**
 * Local interfaces for lean() results
 */
interface INilaiOffline {
  _id: Types.ObjectId | string;
  studentId: Types.ObjectId | string;
  type: "TUGAS" | "UAS" | "TUGAS_SNBT" | "TRYOUT";
  week?: number | null;
  score: number;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
  title?: string;
  subject?: string | null;
  subTest?: string | null;
  maxScore?: number | null;
  rubricItems?: Array<{ criterion: string; score: number; maxScore: number }>;
  notes?: string;
  semester: string;
}

interface IAttendance {
  _id: Types.ObjectId | string;
  studentId: Types.ObjectId | string;
  week: number;
  semester: string;
  date: Date;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS";
  notes?: string;
}

interface ISchedule {
  _id: Types.ObjectId | string;
  region: string;
  fase: string;
  semester: string;
  kbmDates: Array<{
    week: number;
    date: Date;
    topic?: string;
    materialLink?: string;
    documentationLink?: string;
  }>;
}

interface IReport {
  _id: Types.ObjectId | string;
  region?: string;
  fase?: string;
  title: string;
  description: string;
  date: Date;
  photoUrl?: string;
  photoUrls?: string[];
  location?: string;
  semester?: string;
}

export type AggregateFilter = {
  semester: string;
  region?: string | null;
  fase?: string | null;
  /** Backward-compat query lama dari endpoint/admin UI. */
  level?: string | null;
  /** Batasi ke satu siswa (dipakai endpoint PDF). */
  studentId?: string | null;
};

export async function aggregateReports(
  filter: AggregateFilter
): Promise<ReportPayload[]> {
  const { semester, region, studentId } = filter;
  const faseFilter = filter.fase ?? filter.level;

  // Rubric & fase config
  const [faseConfigDoc, reportRubricDoc] = await Promise.all([
    Settings.findOne({ key: "faseConfig" }).lean<{ value: Record<string, FaseConfig> }>(),
    Settings.findOne({ key: "reportRubric" }).lean<{ value: ReportRubric }>(),
  ]);
  const faseConfig: Record<string, FaseConfig> =
    faseConfigDoc?.value ?? DEFAULT_FASE_CONFIG;
  const reportRubric: ReportRubric =
    reportRubricDoc?.value ?? DEFAULT_REPORT_RUBRIC;

  // Filter siswa
  const studentFilter: Record<string, unknown> = {};
  if (studentId) {
    studentFilter._id = studentId;
  } else {
    if (region && region !== "ALL") {
      studentFilter.region = { $regex: new RegExp(`^${escapeRegex(region.trim())}$`, "i") };
    }
    if (faseFilter && faseFilter !== "ALL") {
      studentFilter.fase = { $regex: new RegExp(`^${escapeRegex(faseFilter.trim())}$`, "i") };
    }
  }

  const students = await Student.find(studentFilter).sort({ name: 1 }).lean<IStudent[]>();
  const studentIds = students.map((s) => s._id);

  const [grades, attendance, schedules, portfolio, reports] = await Promise.all([
    NilaiOffline.find({ studentId: { $in: studentIds }, semester }).lean<INilaiOffline[]>(),
    Attendance.find({ studentId: { $in: studentIds }, semester }).lean<IAttendance[]>(),
    Schedule.find({ semester }).lean<ISchedule[]>(),
    StudentPortfolio.find({ studentId: { $in: studentIds }, semester })
      .sort({ week: 1, date: 1, createdAt: 1 })
      .lean<IStudentPortfolio[]>(),
    // Dokumentasi KBM (foto kelas) — scope per region+fase+semester.
    // Filter di JS karena field optional & casing bisa beda di legacy data.
    Report.find({ semester }).sort({ date: 1, createdAt: 1 }).lean<IReport[]>(),
  ]);

  const scheduleMap = new Map<string, ISchedule>();
  for (const s of schedules) {
    scheduleMap.set(
      `${(s.region || "").toLowerCase()}|${(s.fase || "").toLowerCase()}`,
      s
    );
  }

  const findFaseConfig = (faseStr: string): FaseConfig | null => {
    if (!faseStr) return null;
    const target = faseStr.trim().toUpperCase();
    const direct = faseConfig[target];
    if (direct) return direct;
    const found = Object.entries(faseConfig).find(
      ([k]) => k.trim().toUpperCase() === target
    );
    return found?.[1] ?? null;
  };

  return students.map((student): ReportPayload => {
    const studentGrades = grades.filter(
      (g) => g.studentId.toString() === student._id.toString()
    );
    const studentAttendance = attendance.filter(
      (a) => a.studentId.toString() === student._id.toString()
    );

    const studentPortfolio: PortfolioItem[] = portfolio
      .filter((p) => p.studentId.toString() === student._id.toString())
      .flatMap((p) => {
        const urls = p.fileUrls?.length ? p.fileUrls : [p.fileUrl];
        return urls.map((fileUrl, index) => ({
          _id: `${String(p._id)}-${index}`,
          title: p.title,
          description: p.description || undefined,
          fileUrl,
          fileUrls: urls,
          thumbnailUrl: fileUrl,
          week: typeof p.week === "number" ? p.week : undefined,
          date: p.date instanceof Date ? p.date : undefined,
        }));
      });

    // Dokumentasi KBM untuk kelas siswa ini (region+fase match, case-insensitive).
    // Setiap report bisa punya 1+ foto — kita "explode" jadi 1 entri per foto
    // supaya semua foto kepakai di lampiran rapor.
    const studentRegion = (student.region || "").trim().toLowerCase();
    const studentFase = (student.fase || "").trim().toLowerCase();
    const studentDocs: DocumentationItem[] = (reports)
      .filter((r) => {
        if (!r.region || !r.fase) return false;
        return (
          r.region.trim().toLowerCase() === studentRegion &&
          r.fase.trim().toLowerCase() === studentFase
        );
      })
      .flatMap((r) => {
        // Kompatibel: photoUrls (array) primary, photoUrl (legacy) fallback.
        // Report tanpa foto: skip dari lampiran rapor (gak banyak guna di sana).
        const photos: string[] = Array.isArray(r.photoUrls) && r.photoUrls.length > 0
          ? r.photoUrls.filter(Boolean) as string[]
          : (r.photoUrl ? [r.photoUrl] : []);
        if (photos.length === 0) return [];
        return photos.map((photo, idx) => ({
          _id: photos.length > 1 ? `${String(r._id)}_${idx}` : String(r._id),
          title: photos.length > 1 ? `${r.title} (${idx + 1}/${photos.length})` : r.title,
          description: r.description || undefined,
          date: r.date,
          photoUrl: photo,
          location: r.location || undefined,
        }));
      });

    const fase = findFaseConfig(student.fase || "");

    const subjectBucket = new Map<
      string,
      { bucket: "KOGNITIF" | "AFEKTIF"; label: string; maxScoreCfg: number }
    >();
    if (fase) {
      fase.uasKognitif.forEach((c: FaseComponent) =>
        subjectBucket.set(c.subject, {
          bucket: "KOGNITIF",
          label: c.label,
          maxScoreCfg: c.maxScore,
        })
      );
      fase.uasAfektif.forEach((c: FaseComponent) =>
        subjectBucket.set(c.subject, {
          bucket: "AFEKTIF",
          label: c.label,
          maxScoreCfg: c.maxScore,
        })
      );
    }

    const weeklyGradesMap: Record<number, WeeklyGrade> = {};
    const weeklyCountMap: Record<number, number> = {};
    // Raw list semua pertemuan TUGAS tanpa merge — dipakai di lampiran rapor
    // supaya tiap pertemuan tampil sebagai baris terpisah (lebih jelas
    // ketimbang menjumlahkan konsep/kuis/sikap dua pertemuan jadi satu angka).
    const meetings: Meeting[] = [];
    let tugasCount = 0;

    const uasLiterasiKognitif: UasComponent[] = [];
    const uasLiterasiAfektif: UasComponent[] = [];
    const uasBahasaInggris: UasComponent[] = [];

    // ── SNBT-only buckets ──────────────────────────────────
    // Fase "Fase E (SNBT)" pakai format penilaian beda: per pertemuan ada
    // TO1 (sebelum KBM) → KBM SNBT → TO2 (sesudah KBM), angka 0-100.
    // Buckets ini tetap dialokasikan untuk semua siswa (cheap), tapi cuma
    // diserialize ke payload kalau fase student = SNBT — supaya non-SNBT
    // payload-nya bersih (`penilaian.snbt` undefined → konsumer skip).
    // TRYOUT bisa punya sub-tes (record per subTest, Juli 2026) — dikumpulkan
    // raw dulu, lalu di-collapse per pekan: nilai TO = rata-rata sub-tes.
    type SnbtEntry = {
      week: number;
      score: number;
      title?: string;
      subTests?: Array<{ code: string; score: number }>;
    };
    type TryoutRaw = { week: number; score: number; title?: string; subTest?: string | null };
    // KBM SNBT (Juli 2026): sumber utama = record Minggu Cerdas (TUGAS) —
    // `score`-nya sudah rata-rata Konsep/Kuis/Sikap (computeFinalScore).
    // TUGAS_SNBT (1-skor lama) tetap dibaca sebagai fallback per pekan.
    const snbtKbmLegacy: SnbtEntry[] = [];
    const tugasKbmRaw: SnbtEntry[] = [];
    const tryOut1Raw: TryoutRaw[] = [];
    const tryOut2Raw: TryoutRaw[] = [];

    for (const g of studentGrades) {
      const titleUpper = (g.title || "").toUpperCase();
      // Cabang SNBT diutamakan supaya gak mungkin ke-fall-through ke logic
      // TUGAS reguler (yang nge-touch scoreConcept/Quiz/Attitude — gak relevan utk SNBT).
      if (g.type === "TUGAS_SNBT") {
        // KBM SNBT legacy: skor tunggal di `g.score`, week wajib (ditegakkan
        // di pre-save validator NilaiOffline). Kalau week null tetap lolos di
        // sini (lean() bypass validator) — fallback ke 0 supaya gak crash;
        // entry week=0 nanti gampang kelihatan di UI sebagai data invalid.
        snbtKbmLegacy.push({
          week: g.week ?? 0,
          score: g.score || 0,
          title: g.title || undefined,
        });
        continue;
      }
      if (g.type === "TRYOUT") {
        // Subject "TO1"/"TO2" yang menentukan bucket (case-insensitive,
        // input bisa lowercase dari script lama). Default kalau aneh: TO1.
        const subj = (g.subject || "").trim().toUpperCase();
        const entry: TryoutRaw = {
          week: g.week ?? 0,
          score: g.score || 0,
          title: g.title || undefined,
          subTest: g.subTest || null,
        };
        if (subj === "TO2") tryOut2Raw.push(entry);
        else tryOut1Raw.push(entry);
        continue;
      }
      if (g.type === "TUGAS" && g.week) {
        // Untuk siswa fase SNBT, record Minggu Cerdas ini juga jadi nilai KBM
        // SNBT pekanan (dipakai di merge setelah loop; non-SNBT mengabaikan).
        tugasKbmRaw.push({
          week: g.week,
          score: g.score || 0,
          title: g.title || undefined,
        });
        const meetingIndex = (weeklyCountMap[g.week] || 0) + 1;
        const meeting: Meeting = {
          week: g.week,
          scoreConcept: g.scoreConcept || 0,
          scoreQuiz: g.scoreQuiz || 0,
          scoreAttitude: g.scoreAttitude || 0,
          score: g.score || 0,
          title: g.title || `KBM #${g.week}`,
          meetingIndex,
        };
        meetings.push(meeting);

        // Akumulasi juga ke weeklyGradesMap (by week) — dipakai untuk
        // attendance day lookup & shape legacy `weeklyGrades` di API.
        // Dengan ini total poin tetap akurat kalau di minggu yang sama
        // ada lebih dari satu pertemuan.
        const existing = weeklyGradesMap[g.week];
        if (existing) {
          existing.scoreConcept += meeting.scoreConcept;
          existing.scoreQuiz += meeting.scoreQuiz;
          existing.scoreAttitude += meeting.scoreAttitude;
          existing.score += meeting.score;
          if (g.title && !existing.title.includes(g.title)) {
            existing.title = `${existing.title} + ${g.title}`;
          }
        } else {
          weeklyGradesMap[g.week] = { ...meeting };
        }
        weeklyCountMap[g.week] = meetingIndex;
        tugasCount += 1;
      } else if (g.type === "UAS") {
        const subject = g.subject || "LAIN";
        const cfg = subjectBucket.get(subject);
        const comp: UasComponent = {
          subject,
          label: cfg?.label || subject,
          title: g.title || "",
          score: g.score,
          maxScore: g.maxScore || cfg?.maxScoreCfg || 100,
          rubricItems: Array.isArray(g.rubricItems)
            ? g.rubricItems.map((r) => ({
                criterion: r.criterion,
                score: Number(r.score) || 0,
                maxScore: Number(r.maxScore) || 0,
              }))
            : [],
          notes: g.notes,
        };
        if (cfg?.bucket === "KOGNITIF") uasLiterasiKognitif.push(comp);
        else if (cfg?.bucket === "AFEKTIF") uasLiterasiAfektif.push(comp);
        else if (subject === "BING" || /BAHASA.?INGGRIS|ENGLISH/i.test(g.title || "")) {
          uasBahasaInggris.push(comp);
        } else if (titleUpper !== "UAS") {
          uasLiterasiKognitif.push(comp);
        }
      }
    }

    const weeklyGrades: WeeklyGrade[] = Object.values(weeklyGradesMap).sort(
      (a, b) => a.week - b.week
    );

    const attendanceSummary = {
      HADIR: studentAttendance.filter((a) => a.status === "HADIR").length,
      IZIN: studentAttendance.filter((a) => a.status === "IZIN").length,
      SAKIT: studentAttendance.filter((a) => a.status === "SAKIT").length,
      ALFA: studentAttendance.filter((a) => a.status === "ALFA").length,
      ASINKRONUS: studentAttendance.filter((a) => a.status === "ASINKRONUS").length,
      total: studentAttendance.length,
    };
    const totalLuring = attendanceSummary.total - attendanceSummary.ASINKRONUS;
    const hadirPct =
      totalLuring > 0 ? Math.round((attendanceSummary.HADIR / totalLuring) * 100) : 0;

    const attendanceDays: AttendanceDay[] = studentAttendance
      .sort((a, b) => (a.week || 0) - (b.week || 0))
      .map((a) => {
        const wk = a.week;
        const wg = wk ? weeklyGradesMap[wk] : null;
        return {
          week: wk,
          date: a.date instanceof Date ? a.date.toISOString() : String(a.date),
          status: a.status,
          notes: a.notes || undefined,
          scoreConcept: wg?.scoreConcept,
          scoreQuiz: wg?.scoreQuiz,
          scoreAttitude: wg?.scoreAttitude,
        };
      });

    const totalKbmConcept = weeklyGrades.reduce((a, t) => a + t.scoreConcept, 0);
    const totalKbmQuiz = weeklyGrades.reduce((a, t) => a + t.scoreQuiz, 0);
    const totalKbmAttitude = weeklyGrades.reduce((a, t) => a + t.scoreAttitude, 0);
    const totalKbm = totalKbmConcept + totalKbmQuiz + totalKbmAttitude;

    const sumScore = (arr: UasComponent[]) =>
      arr.reduce((acc, c) => acc + c.score, 0);
    const sumMax = (arr: UasComponent[]) =>
      arr.reduce((acc, c) => acc + c.maxScore, 0);

    const kognitifSiswa = sumScore(uasLiterasiKognitif);
    const kognitifMax = sumMax(uasLiterasiKognitif);
    const afektifSiswa = sumScore(uasLiterasiAfektif);
    const afektifMax = sumMax(uasLiterasiAfektif);
    const bingSiswa = sumScore(uasBahasaInggris);
    const bingMax = sumMax(uasBahasaInggris);

    const pertemuanCount = tugasCount;
    const kbmMaxPerComponent = fase?.kbmMaxPerComponent ?? 1400;
    // Total max KBM = jumlah pertemuan × 3 komponen × 100 poin.
    // Kalau belum ada TUGAS sama sekali, fallback ke `kbmMaxPerComponent × 3`
    // dari faseConfig supaya persentase tidak 0/0.
    const totalKbmMaxReguler =
      pertemuanCount > 0 ? pertemuanCount * 100 * 3 : kbmMaxPerComponent * 3;

    // ── SNBT branch ────────────────────────────────────────
    // Detect dengan case-insensitive substring "SNBT" supaya cocok untuk
    // "Fase E (SNBT)" (DB) maupun varian uppercase di faseConfig key.
    // Sengaja gak strict-equal — kalau di masa depan ada "Fase E (SNBT) 2026",
    // tetap masuk cabang SNBT.
    const isSnbtFase = /SNBT/i.test(student.fase || "");

    // Collapse record TRYOUT per pekan: kalau ada record sub-tes, nilai TO
    // pekan itu = rata-rata sub-tes (dibulatkan) dan rinciannya disimpan di
    // `subTests`; kalau tidak, pakai record legacy 1-skor (subTest null).
    // Kalau dua-duanya ada (data campuran), sub-tes menang — legacy diabaikan.
    const collapseTryout = (raw: TryoutRaw[]): SnbtEntry[] => {
      const byWeek = new Map<
        number,
        { subs: Array<{ code: string; score: number }>; legacy: TryoutRaw | null; title?: string }
      >();
      for (const e of raw) {
        let slot = byWeek.get(e.week);
        if (!slot) {
          slot = { subs: [], legacy: null };
          byWeek.set(e.week, slot);
        }
        if (e.subTest) {
          slot.subs.push({ code: e.subTest, score: e.score });
          if (!slot.title) slot.title = e.title;
        } else {
          slot.legacy = e;
        }
      }
      return Array.from(byWeek.entries())
        .map(([week, slot]): SnbtEntry => {
          if (slot.subs.length > 0) {
            const avg = Math.round(
              slot.subs.reduce((acc, s) => acc + s.score, 0) / slot.subs.length
            );
            return { week, score: avg, title: slot.title, subTests: slot.subs };
          }
          return { week, score: slot.legacy?.score ?? 0, title: slot.legacy?.title };
        })
        .sort((a, b) => a.week - b.week);
    };
    const snbtTryOut1 = collapseTryout(tryOut1Raw);
    const snbtTryOut2 = collapseTryout(tryOut2Raw);

    // KBM SNBT per pekan: record Minggu Cerdas (TUGAS, skor = rata-rata
    // Konsep/Kuis/Sikap) menang atas TUGAS_SNBT legacy di pekan yang sama.
    // Merge hanya untuk siswa fase SNBT — siswa reguler tetap pakai jalur
    // KBM/UAS biasa dan bucket ini tinggal legacy kosong.
    const kbmByWeek = new Map<number, SnbtEntry>();
    for (const e of snbtKbmLegacy) kbmByWeek.set(e.week, e);
    if (isSnbtFase) {
      for (const e of tugasKbmRaw) kbmByWeek.set(e.week, e);
    }
    const snbtKbm = Array.from(kbmByWeek.values()).sort((a, b) => a.week - b.week);

    const hasSnbtData =
      snbtKbm.length > 0 || snbtTryOut1.length > 0 || snbtTryOut2.length > 0;

    // Default 15 pertemuan × 100 × 3 komponen (TO1+KBM+TO2) = 4500.
    const SNBT_DEFAULT_MAX = 15 * 100 * 3;
    const sumScoreEntries = (arr: Array<{ score: number }>) =>
      arr.reduce((acc, e) => acc + (e.score || 0), 0);
    const totalTryOut1 = sumScoreEntries(snbtTryOut1);
    const totalKbmSnbt = sumScoreEntries(snbtKbm);
    const totalTryOut2 = sumScoreEntries(snbtTryOut2);
    const totalSnbt = totalTryOut1 + totalKbmSnbt + totalTryOut2;

    // Final totals: SNBT path override-nya bersih (0 untuk komponen reguler)
    // sehingga konsumer yang baca `kbm/uasLiterasi/uasBahasaInggris` dapat
    // angka 0 — bukan angka acak yg mungkin nyangkut dari TUGAS reguler
    // kalau (misal) data legacy masih ada untuk siswa SNBT.
    let totalKbmMax: number;
    let totalPoinMax: number;
    let totalPoin: number;
    let snbtPayload: ReportPayload["penilaian"]["snbt"] | undefined;

    if (isSnbtFase && hasSnbtData) {
      totalKbmMax = 0;
      totalPoinMax = SNBT_DEFAULT_MAX;
      totalPoin = totalSnbt;
      snbtPayload = {
        tryOut1: snbtTryOut1.sort((a, b) => a.week - b.week),
        kbm: snbtKbm.sort((a, b) => a.week - b.week),
        tryOut2: snbtTryOut2.sort((a, b) => a.week - b.week),
        totalTryOut1,
        totalKbm: totalKbmSnbt,
        totalTryOut2,
        totalSnbt,
        maxSnbt: SNBT_DEFAULT_MAX,
      };
    } else {
      totalKbmMax = totalKbmMaxReguler;
      const totalUasMax = kognitifMax + afektifMax + bingMax;
      totalPoinMax = totalKbmMax + totalUasMax;
      totalPoin = totalKbm + kognitifSiswa + afektifSiswa + bingSiswa;
    }
    const pct = totalPoinMax > 0 ? Math.round((totalPoin / totalPoinMax) * 100) : 0;

    const predikat = derivePredikat(pct, reportRubric);
    const narasi = reportRubric.narasi[predikat.code];
    const kehadiranNarasi =
      hadirPct >= reportRubric.kehadiran.target
        ? reportRubric.kehadiran.narasiTinggi
        : reportRubric.kehadiran.narasiRendah;

    const schedKey = `${(student.region || "").toLowerCase()}|${(student.fase || "").toLowerCase()}`;
    const sched = scheduleMap.get(schedKey);
    const kbmDates = sched?.kbmDates || [];

    return {
      _id: String(student._id),
      name: student.name,
      fase: student.fase,
      region: student.region,
      parentName: student.parentName || "",
      profile: {
        gender: student.gender || "",
        birthPlace: student.birthPlace || "",
        birthDate: student.birthDate || null,
        schoolOrigin: student.schoolOrigin || "",
        phone: student.phone || "",
        address: student.address || "",
        studentCode: student.studentCode || "",
        pic: student.pic || "",
      },
      faseConfig: fase
        ? {
            jenjang: fase.jenjang,
            kbmMaxPerComponent: fase.kbmMaxPerComponent,
            uasKognitifSubjects: fase.uasKognitif,
            uasAfektifSubjects: fase.uasAfektif,
            uasBInggris: fase.uasBInggris,
          }
        : null,
      penilaian: {
        kbm: {
          konsep: { siswa: totalKbmConcept, max: totalKbmMax / 3 },
          kuis: { siswa: totalKbmQuiz, max: totalKbmMax / 3 },
          sikap: { siswa: totalKbmAttitude, max: totalKbmMax / 3 },
        },
        uasLiterasi: {
          kognitif: uasLiterasiKognitif,
          afektif: uasLiterasiAfektif,
          kognitifTotal: { siswa: kognitifSiswa, max: kognitifMax },
          afektifTotal: { siswa: afektifSiswa, max: afektifMax },
        },
        uasBahasaInggris,
        uasBahasaInggrisTotal: { siswa: bingSiswa, max: bingMax },
        totalPoin,
        totalPoinMax,
        persentase: pct,
        predikat: {
          code: predikat.code,
          label: predikat.label,
          description: predikat.description,
        },
        narasi: {
          kognitif: narasi.kognitif,
          sikap: narasi.sikap,
          rekomendasiSiswa: narasi.rekomendasiSiswa,
          rekomendasiOrtu: narasi.rekomendasiOrtu,
        },
        // Hanya di-set untuk siswa fase SNBT yang punya data nilai SNBT;
        // konsumer (PDF/UI) branch via `if (penilaian.snbt) { render SNBT layout }`.
        snbt: snbtPayload,
      },
      weeklyGrades,
      meetings: meetings.sort(
        (a, b) => a.week - b.week || a.meetingIndex - b.meetingIndex
      ),
      kbmDates,
      portfolio: studentPortfolio,
      documentations: studentDocs,
      attendanceSummary,
      attendanceDays,
      kehadiran: {
        totalLuring,
        hadirPct,
        target: reportRubric.kehadiran.target,
        narasi: kehadiranNarasi,
      },
      semester,
    };
  });
}
