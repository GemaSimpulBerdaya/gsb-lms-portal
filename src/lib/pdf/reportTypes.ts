/**
 * Tipe payload rapor siap cetak.
 * Dipakai oleh:
 *  - `/api/admin/grades` (produsen) — menghasilkan array dari tipe ini.
 *  - `src/lib/pdf/ReportTemplate.tsx` (konsumer) — render ke PDF.
 *
 * Shape mengikuti struktur rapor PDF di `public/raport/*.pdf`
 * (lihat SYSTEM_FLOW.md §9).
 */

export type RubricItem = {
  criterion: string;
  score: number;
  maxScore: number;
};

export type UasComponent = {
  subject: string;
  label: string;
  title: string;
  score: number;
  maxScore: number;
  rubricItems: RubricItem[];
  notes?: string;
};

export type WeeklyGrade = {
  week: number;
  scoreConcept: number;
  scoreQuiz: number;
  scoreAttitude: number;
  score: number;
  title: string;
};

/** Satu pertemuan TUGAS (raw, tanpa merge per-minggu). */
export type Meeting = WeeklyGrade & { meetingIndex: number };

export type AttendanceDay = {
  week: number;
  date: string;
  status: string;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
};

export type KbmDate = {
  week: number;
  date: string | Date;
  topic?: string;
  materialLink?: string;
  documentationLink?: string;
};

/**
 * Item portofolio karya siswa untuk Lampiran rapor.
 * Disimpan di koleksi `student_portfolio` (lihat `src/models/StudentPortfolio.ts`).
 * Di rapor ditampilkan di section "Karya Siswa".
 */
export type PortfolioItem = {
  _id: string;
  title: string;
  description?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  week?: number;
  date?: string | Date;
};

/**
 * Item dokumentasi KBM (foto kelas) untuk Lampiran rapor.
 * Diambil dari koleksi `reports` (lihat `src/models/Report.ts`).
 * Scope per kelas (region+level+semester), bukan per siswa — sehingga
 * 1 foto dokumentasi muncul di semua rapor siswa kelas itu.
 */
export type DocumentationItem = {
  _id: string;
  title: string;
  description?: string;
  date: string | Date;
  photoUrl?: string;
  location?: string;
};

export type ReportPayload = {
  _id: string;
  name: string;
  category: string; // level / fase
  region: string;
  parentName: string;

  profile: {
    gender: string;
    birthPlace: string;
    birthDate: string | Date | null;
    schoolOrigin: string;
    phone: string;
    address: string;
    studentCode: string;
    kodeKelas: string;
    pic: string;
  };

  faseConfig: {
    jenjang: string;
    kbmMaxPerComponent: number;
    uasKognitifSubjects: Array<{ subject: string; label: string; maxScore: number }>;
    uasAfektifSubjects: Array<{ subject: string; label: string; maxScore: number }>;
    uasBInggris: { maxScore: number } | null;
  } | null;

  penilaian: {
    kbm: {
      konsep: { siswa: number; max: number };
      kuis: { siswa: number; max: number };
      sikap: { siswa: number; max: number };
    };
    uasLiterasi: {
      kognitif: UasComponent[];
      afektif: UasComponent[];
      kognitifTotal: { siswa: number; max: number };
      afektifTotal: { siswa: number; max: number };
    };
    uasBahasaInggris: UasComponent[];
    uasBahasaInggrisTotal: { siswa: number; max: number };
    totalPoin: number;
    totalPoinMax: number;
    persentase: number;
    predikat: {
      code: "A" | "B" | "C";
      label: string;
      description: string;
    };
    narasi: {
      kognitif: string;
      sikap: string;
      rekomendasiSiswa: string;
      rekomendasiOrtu: string;
    };
  };

  weeklyGrades: WeeklyGrade[];
  /** Raw list semua pertemuan TUGAS (mempertahankan >1 pertemuan per minggu). */
  meetings: Meeting[];
  utsScore: number;

  tryouts: Array<{ week: number; tryoutNumber: number; score: number }>;

  kbmDates: KbmDate[];

  /**
   * Karya siswa (KARYA) untuk semester ini, scoped per anak didik.
   * Sudah di-sort ascending by week/date. Bisa kosong.
   */
  portfolio: PortfolioItem[];

  /**
   * Dokumentasi KBM (foto kelas) yang dishare antar siswa di kelas yang sama.
   * Diambil dari koleksi `reports` filter region+level+semester.
   * Sudah di-sort ascending by date. Bisa kosong.
   */
  documentations: DocumentationItem[];

  attendanceSummary: {
    HADIR: number;
    IZIN: number;
    SAKIT: number;
    ALFA: number;
    ASINKRONUS: number;
    total: number;
  };
  attendanceDays: AttendanceDay[];
  kehadiran: {
    totalLuring: number;
    hadirPct: number;
    target: number;
    narasi: string;
  };

  /** Semester, diisi dari API route, bukan per siswa. */
  semester?: string;
};
