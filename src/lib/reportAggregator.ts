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

import AnakDidik from "@/models/AnakDidik";
import { NilaiOffline } from "@/models/Relawan";
import { Attendance } from "@/models/Attendance";
import { Schedule } from "@/models/Schedule";
import { Settings } from "@/models/Settings";
import StudentPortfolio from "@/models/StudentPortfolio";
import { Report } from "@/models/Report";
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

export type AggregateFilter = {
  semester: string;
  region?: string | null;
  level?: string | null;
  /** Batasi ke satu siswa (dipakai endpoint PDF). */
  studentId?: string | null;
};

export async function aggregateReports(
  filter: AggregateFilter
): Promise<ReportPayload[]> {
  const { semester, region, level, studentId } = filter;

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
      studentFilter.region = { $regex: new RegExp(`^${region.trim()}$`, "i") };
    }
    if (level && level !== "ALL") {
      studentFilter.category = { $regex: new RegExp(`^${level.trim()}$`, "i") };
    }
  }

  const students = await AnakDidik.find(studentFilter).sort({ name: 1 }).lean();
  const studentIds = students.map((s) => s._id);

  const [grades, attendance, schedules, portfolio, reports] = await Promise.all([
    NilaiOffline.find({ anakDidikId: { $in: studentIds }, semester }).lean(),
    Attendance.find({ anakDidikId: { $in: studentIds }, semester }).lean(),
    Schedule.find({ semester }).lean(),
    StudentPortfolio.find({ anakDidikId: { $in: studentIds }, semester })
      .sort({ week: 1, date: 1, createdAt: 1 })
      .lean(),
    // Dokumentasi KBM (foto kelas) — scope per region+level+semester.
    // Filter di JS karena field optional & casing bisa beda di legacy data.
    Report.find({ semester }).sort({ date: 1, createdAt: 1 }).lean(),
  ]);

  const scheduleMap = new Map<string, (typeof schedules)[number]>();
  for (const s of schedules) {
    scheduleMap.set(
      `${(s.region || "").toLowerCase()}|${(s.level || "").toLowerCase()}`,
      s
    );
  }

  const findFaseConfig = (levelStr: string): FaseConfig | null => {
    if (!levelStr) return null;
    const target = levelStr.trim().toUpperCase();
    const direct = faseConfig[target];
    if (direct) return direct;
    const found = Object.entries(faseConfig).find(
      ([k]) => k.trim().toUpperCase() === target
    );
    return found?.[1] ?? null;
  };

  return students.map((student): ReportPayload => {
    const studentGrades = grades.filter(
      (g) => g.anakDidikId.toString() === student._id.toString()
    );
    const studentAttendance = attendance.filter(
      (a) => a.anakDidikId.toString() === student._id.toString()
    );

    const studentPortfolio: PortfolioItem[] = portfolio
      .filter((p: any) => p.anakDidikId.toString() === student._id.toString())
      .map((p: any) => ({
        _id: String(p._id),
        title: p.title,
        description: p.description || undefined,
        fileUrl: p.fileUrl,
        thumbnailUrl: p.thumbnailUrl || undefined,
        week: typeof p.week === "number" ? p.week : undefined,
        date: p.date || undefined,
      }));

    // Dokumentasi KBM untuk kelas siswa ini (region+level match, case-insensitive).
    // Setiap report bisa punya 1+ foto — kita "explode" jadi 1 entri per foto
    // supaya semua foto kepakai di lampiran rapor.
    const studentRegion = (student.region || "").trim().toLowerCase();
    const studentLevel = (student.category || "").trim().toLowerCase();
    const studentDocs: DocumentationItem[] = (reports as any[])
      .filter((r) => {
        if (!r.region || !r.level) return false;
        return (
          r.region.trim().toLowerCase() === studentRegion &&
          r.level.trim().toLowerCase() === studentLevel
        );
      })
      .flatMap((r) => {
        // Kompatibel: photoUrls (array) primary, photoUrl (legacy) fallback.
        // Report tanpa foto: skip dari lampiran rapor (gak banyak guna di sana).
        const photos: string[] = Array.isArray(r.photoUrls) && r.photoUrls.length > 0
          ? r.photoUrls.filter(Boolean)
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

    const fase = findFaseConfig(student.category || "");

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
    let utsScore = 0;

    const uasLiterasiKognitif: UasComponent[] = [];
    const uasLiterasiAfektif: UasComponent[] = [];
    const uasBahasaInggris: UasComponent[] = [];
    const tryouts: Array<{ week: number; tryoutNumber: number; score: number }> = [];

    for (const g of studentGrades as any[]) {
      const titleUpper = (g.title || "").toUpperCase();
      if (g.type === "TUGAS" && g.week) {
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
      } else if (g.type === "UTS" || titleUpper === "UTS") {
        utsScore = g.score;
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
            ? g.rubricItems.map((r: any) => ({
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
      } else if (g.type === "TRYOUT") {
        tryouts.push({
          week: g.week || 0,
          tryoutNumber: g.tryoutNumber || 1,
          score: g.score,
        });
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
          date: a.date,
          status: a.status,
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
    const totalKbmMax =
      pertemuanCount > 0 ? pertemuanCount * 100 * 3 : kbmMaxPerComponent * 3;

    const totalUasMax = kognitifMax + afektifMax + bingMax;
    const totalPoinMax = totalKbmMax + totalUasMax;
    const totalPoin = totalKbm + kognitifSiswa + afektifSiswa + bingSiswa;
    const pct = totalPoinMax > 0 ? Math.round((totalPoin / totalPoinMax) * 100) : 0;

    const predikat = derivePredikat(pct, reportRubric);
    const narasi = reportRubric.narasi[predikat.code];
    const kehadiranNarasi =
      hadirPct >= reportRubric.kehadiran.target
        ? reportRubric.kehadiran.narasiTinggi
        : reportRubric.kehadiran.narasiRendah;

    const schedKey = `${(student.region || "").toLowerCase()}|${(student.category || "").toLowerCase()}`;
    const sched = scheduleMap.get(schedKey);
    const kbmDates = sched?.kbmDates || [];

    return {
      _id: String(student._id),
      name: student.name,
      category: student.category,
      region: student.region,
      parentName: student.parentName,
      profile: {
        gender: student.gender || "",
        birthPlace: student.birthPlace || "",
        birthDate: student.birthDate || null,
        schoolOrigin: student.schoolOrigin || "",
        phone: student.phone || "",
        address: student.address || "",
        studentCode: student.studentCode || "",
        kodeKelas: student.kodeKelas || "",
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
      },
      weeklyGrades,
      meetings: meetings.sort(
        (a, b) => a.week - b.week || a.meetingIndex - b.meetingIndex
      ),
      utsScore,
      tryouts,
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
