/**
 * Default konfigurasi rapor GSB.
 *
 * - `DEFAULT_FASE_CONFIG`  -> struktur komponen UAS per fase (kognitif, afektif,
 *   B. Inggris, kbmMaxPerComponent). Disimpan di Settings key `faseConfig`.
 * - `DEFAULT_REPORT_RUBRIC` -> predikat (threshold + label) + narasi 3 tier
 *   (kognitif, sikap, rekomendasi siswa, rekomendasi ortu) + teks kehadiran.
 *   Disimpan di Settings key `reportRubric`.
 *
 * Keduanya dipakai sebagai fallback ketika admin belum pernah meng-override
 * lewat UI `/admin/levels` (atau halaman config rapor yang akan dibuat).
 *
 * Sumber acuan teks & struktur: `public/raport/*.pdf` (8 sampel rapor
 * Semester Ganjil 2025/2026). Lihat SYSTEM_FLOW.md §9 untuk konteks.
 */

export type UasComponent = {
  /** Kode subject (huruf kapital + underscore). Dipakai di `NilaiOffline.subject`. */
  subject: string;
  /** Label yang tampil di rapor ("Literasi Numerasi", "Mandiri", dst). */
  label: string;
  /** Poin maksimal komponen. */
  maxScore: number;
};

export type FaseConfig = {
  /** Label jenjang ("2 SD/MI", "PAUD/TK", dst). */
  jenjang: string;
  /** Komponen kognitif UAS Literasi. */
  uasKognitif: UasComponent[];
  /** Komponen afektif UAS Literasi. */
  uasAfektif: UasComponent[];
  /** UAS Bahasa Inggris. `null` berarti fase ini tidak punya UAS B. Inggris. */
  uasBInggris: { maxScore: number } | null;
  /** Poin maksimal per komponen KBM (Konsep/Kuis/Sikap). */
  kbmMaxPerComponent: number;
};

export type PredikatTier = {
  code: "A" | "B" | "C";
  label: string;
  /** Persentase minimum (inklusif) untuk masuk tier ini. */
  minPct: number;
  description: string;
};

export type NarasiTier = {
  kognitif: string;
  sikap: string;
  rekomendasiSiswa: string;
  rekomendasiOrtu: string;
};

export type ReportRubric = {
  predikat: PredikatTier[];
  narasi: Record<"A" | "B" | "C", NarasiTier>;
  kehadiran: {
    target: number;
    narasiTinggi: string;
    narasiRendah: string;
  };
};

/**
 * Default komponen UAS per fase.
 * Observasi dari rapor:
 *  - Tunas/Pucuk: PAUD/TK, fokus mengenal angka/huruf/bentuk/seni.
 *  - Pelita: 1 SD, 4 aspek literasi bahasa (menyimak/membaca/menulis/berbicara).
 *  - A (2 SD), B (3 SD), C (6 SD): Numerasi/Sains/B.Indo + Mandiri/BernalarKritis/Kreatif + B.Inggris.
 *  - D (9 SMP), E (10 SMA): kognitif serupa tapi afektif berbeda tiap jenjang.
 *
 * Catatan: max score per kognitif/afektif di sampel kadang tidak konsisten
 * (mis. Fase A afektif 20/20/20 vs Fase C 25/25/20). Angka default di bawah
 * diambil dari sampel paling representatif tiap fase; admin wajib verifikasi
 * & override via UI sebelum generate raport resmi.
 */
export const DEFAULT_FASE_CONFIG: Record<string, FaseConfig> = {
  "FASE TUNAS": {
    jenjang: "PAUD/TK",
    uasKognitif: [
      { subject: "MENGENAL_ANGKA", label: "Literasi Mengenal Angka", maxScore: 25 },
      { subject: "MENGENAL_HURUF", label: "Literasi Mengenal Huruf", maxScore: 25 },
      { subject: "MENGENAL_BENTUK", label: "Literasi Mengenal Bentuk", maxScore: 25 },
      { subject: "SENI", label: "Literasi Seni", maxScore: 25 },
    ],
    uasAfektif: [
      { subject: "KEBERANIAN", label: "Keberanian", maxScore: 30 },
      { subject: "EKSPRESI_KREATIF", label: "Ekspresi Kreatif", maxScore: 30 },
      { subject: "KEMANDIRIAN", label: "Kemandirian", maxScore: 10 },
    ],
    uasBInggris: null,
    kbmMaxPerComponent: 1400,
  },
  "FASE PUCUK": {
    jenjang: "PAUD/TK",
    uasKognitif: [
      { subject: "MENGENAL_ANGKA", label: "Literasi Mengenal Angka", maxScore: 25 },
      { subject: "MENGENAL_HURUF", label: "Literasi Mengenal Huruf", maxScore: 25 },
      { subject: "MENGENAL_BENTUK", label: "Literasi Mengenal Bentuk", maxScore: 25 },
      { subject: "SENI", label: "Literasi Seni", maxScore: 25 },
    ],
    uasAfektif: [
      { subject: "KEBERANIAN", label: "Keberanian", maxScore: 30 },
      { subject: "EKSPRESI_KREATIF", label: "Ekspresi Kreatif", maxScore: 30 },
      { subject: "KEMANDIRIAN", label: "Kemandirian", maxScore: 10 },
    ],
    uasBInggris: null,
    kbmMaxPerComponent: 1300,
  },
  "FASE PELITA": {
    jenjang: "1 SD/MI",
    uasKognitif: [
      { subject: "MENYIMAK", label: "Literasi Menyimak", maxScore: 25 },
      { subject: "MEMBACA", label: "Literasi Membaca", maxScore: 25 },
      { subject: "MENULIS", label: "Literasi Menulis", maxScore: 25 },
      { subject: "BERBICARA", label: "Literasi Berbicara", maxScore: 25 },
    ],
    uasAfektif: [
      { subject: "TANGGUNG_JAWAB", label: "Tanggung Jawab", maxScore: 30 },
      { subject: "KEMANDIRIAN", label: "Kemandirian", maxScore: 20 },
      { subject: "EKSPRESI_KREATIF", label: "Ekspresi Kreatif", maxScore: 20 },
    ],
    uasBInggris: null,
    kbmMaxPerComponent: 1400,
  },
  "FASE A": {
    jenjang: "2 SD/MI",
    uasKognitif: [
      { subject: "NUMERASI", label: "Literasi Numerasi", maxScore: 30 },
      { subject: "SAINS", label: "Literasi Sains", maxScore: 35 },
      { subject: "BINDO", label: "Literasi Bahasa Indonesia", maxScore: 35 },
    ],
    uasAfektif: [
      { subject: "MANDIRI", label: "Mandiri", maxScore: 30 },
      { subject: "BERNALAR_KRITIS", label: "Bernalar Kritis", maxScore: 20 },
      { subject: "KREATIF", label: "Kreatif", maxScore: 20 },
    ],
    uasBInggris: { maxScore: 100 },
    kbmMaxPerComponent: 1400,
  },
  "FASE B": {
    jenjang: "3 SD/MI",
    uasKognitif: [
      { subject: "NUMERASI", label: "Literasi Numerasi", maxScore: 30 },
      { subject: "SAINS", label: "Literasi Sains", maxScore: 35 },
      { subject: "BINDO", label: "Literasi Bahasa Indonesia", maxScore: 35 },
    ],
    uasAfektif: [
      { subject: "MANDIRI", label: "Mandiri", maxScore: 30 },
      { subject: "BERNALAR_KRITIS", label: "Bernalar Kritis", maxScore: 20 },
      { subject: "KREATIF", label: "Kreatif", maxScore: 20 },
    ],
    uasBInggris: { maxScore: 100 },
    kbmMaxPerComponent: 1400,
  },
  "FASE C": {
    jenjang: "6 SD/MI",
    uasKognitif: [
      { subject: "NUMERASI", label: "Literasi Numerasi", maxScore: 30 },
      { subject: "SAINS", label: "Literasi Sains", maxScore: 35 },
      { subject: "BINDO", label: "Literasi Bahasa Indonesia", maxScore: 35 },
    ],
    uasAfektif: [
      { subject: "MANDIRI", label: "Mandiri", maxScore: 30 },
      { subject: "BERNALAR_KRITIS", label: "Bernalar Kritis", maxScore: 20 },
      { subject: "KREATIF", label: "Kreatif", maxScore: 20 },
    ],
    uasBInggris: { maxScore: 100 },
    kbmMaxPerComponent: 1400,
  },
  "FASE D": {
    jenjang: "9 SMP/MTs",
    uasKognitif: [
      { subject: "NUMERASI", label: "Literasi Numerasi", maxScore: 30 },
      { subject: "SAINS", label: "Literasi Sains", maxScore: 40 },
      { subject: "BINDO", label: "Literasi Bahasa Indonesia", maxScore: 30 },
    ],
    uasAfektif: [
      { subject: "SIKAP_ILMIAH", label: "Sikap Ilmiah", maxScore: 15 },
      { subject: "RASA_INGIN_TAHU", label: "Rasa Ingin Tahu", maxScore: 30 },
      { subject: "TANGGUNG_JAWAB", label: "Tanggung Jawab", maxScore: 25 },
    ],
    uasBInggris: { maxScore: 100 },
    kbmMaxPerComponent: 1400,
  },
  "FASE E": {
    jenjang: "10 SMA/SMK/MAN",
    uasKognitif: [
      { subject: "NUMERASI", label: "Literasi Numerasi", maxScore: 30 },
      { subject: "SAINS", label: "Literasi Sains", maxScore: 40 },
      { subject: "BINDO", label: "Literasi Bahasa Indonesia", maxScore: 30 },
    ],
    uasAfektif: [
      { subject: "KETEKUNAN", label: "Ketekunan", maxScore: 25 },
      { subject: "KETELITIAN", label: "Ketelitian", maxScore: 20 },
      { subject: "TANGGUNG_JAWAB", label: "Tanggung Jawab", maxScore: 25 },
    ],
    uasBInggris: { maxScore: 100 },
    kbmMaxPerComponent: 1400,
  },
  // Fase non-standar: admin diharapkan mengisi komponen lewat /admin/report-config.
  "DISABILITAS": {
    jenjang: "Disabilitas / Pendidikan Khusus",
    uasKognitif: [],
    uasAfektif: [],
    uasBInggris: null,
    kbmMaxPerComponent: 1400,
  },
  "SNBT": {
    jenjang: "Persiapan SNBT (kelas 12)",
    uasKognitif: [],
    uasAfektif: [],
    uasBInggris: null,
    kbmMaxPerComponent: 1400,
  },
};

/**
 * Default rubric/threshold predikat rapor.
 * Threshold ini asumsi kerja dari 8 sampel rapor — admin wajib konfirmasi
 * ke tim Edukasi sebelum final. Lihat SYSTEM_FLOW.md §9.3.
 */
export const DEFAULT_REPORT_RUBRIC: ReportRubric = {
  predikat: [
    {
      code: "A",
      label: "Sangat Baik",
      minPct: 70,
      description:
        "Siswa tuntas dengan pencapaian tinggi dan mampu mengaplikasikan konsep secara mandiri.",
    },
    {
      code: "B",
      label: "Baik",
      minPct: 40,
      description:
        "Siswa tuntas dengan pemahaman yang baik, tetapi memerlukan bimbingan pada beberapa bagian.",
    },
    {
      code: "C",
      label: "Cukup Baik",
      minPct: 0,
      description:
        "Siswa hampir tuntas, memahami sebagian besar materi dasar tetapi perlu dukungan untuk peningkatan.",
    },
  ],
  narasi: {
    A: {
      kognitif:
        "Kamu menunjukkan pemahaman yang mendalam terhadap materi pembelajaran, misalnya kamu dapat menyelesaikan tugas dengan baik dan mampu menjelaskan konsep dengan logika yang terstruktur.",
      sikap:
        "Kamu menunjukkan antusiasme tinggi dengan selalu aktif bertanya dalam diskusi kelas dan mengumpulkan tugas tepat waktu.",
      rekomendasiSiswa:
        "Ambil tantangan lebih tinggi: jadi mentor kecil untuk teman, ikut proyek/lomba sederhana, dan berlatih secara mandiri untuk memperkuat pemahaman konsep.",
      rekomendasiOrtu:
        "Dukung pengembangan anak dengan cara sediakan waktu belajar bersama orang tua, ajak anak menceritakan kembali materi pelajaran, dan arahkan ke sumber lain seperti perpustakaan atau materi digital untuk memperluas wawasan.",
    },
    B: {
      kognitif:
        "Kamu menguasai sebagian besar materi, namun masih kesulitan pada soal analitis atau aplikasi, contohnya pada soal cerita.",
      sikap:
        "Kamu bersikap cukup disiplin, tetapi kurang menunjukkan inisiatif dalam diskusi kelas dan pengumpulan tugas.",
      rekomendasiSiswa:
        "Perkuat konsistensi: buat target belajar mingguan, selesaikan tugas dari pengajar, catat bagian yang masih bingung, dan biasakan bertanya di kelas saat menemui kesulitan.",
      rekomendasiOrtu:
        "Dukung kedisiplinan anak dengan cara mengingatkan untuk hadir di kelas dan menyelesaikan tugas, menanyakan 1 hal yang dipelajari setiap minggu, serta motivasi anak agar berani bertanya saat belum paham. Berikan pujian atas usaha kecil agar anak tetap termotivasi belajar.",
    },
    C: {
      kognitif:
        "Kamu memahami materi dasar dengan cukup baik, terlihat dari kemampuan menyelesaikan soal level mudah hingga sedang, tetapi mengalami kesulitan pada soal yang lebih kompleks.",
      sikap:
        "Kamu masih kurang konsisten dalam belajar, terlihat dari frekuensi pengumpulan tugas yang rendah dan minimnya kehadiran aktif dalam diskusi kelas.",
      rekomendasiSiswa:
        "Bangun kebiasaan secara bertahap: fokus pada rutinitas kecil seperti membaca materi pelajaran 10–15 menit per hari, kerjakan soal/tugas dari yang mudah, dan minta bantuan saat merasa kesulitan.",
      rekomendasiOrtu:
        "Dukung kedisiplinan anak dengan cara mengingatkan anak untuk hadir di kelas dan menyelesaikan tugas, mendampingi saat belajar di rumah, serta motivasi anak agar berani bertanya saat belum paham. Berikan pujian atas usaha kecil agar anak tetap termotivasi belajar.",
    },
  },
  kehadiran: {
    target: 80,
    narasiTinggi:
      "Kehadiranmu yang konsisten bikin progresmu kelihatan jelas tiap pertemuan. Pertahankan dengan konfirmasi hadir tiap hari Sabtu, siapkan perlengkapan belajar dari Sabtu malam, dan pasang alarm Minggu pagi. Kamu juga bisa jadi penyemangat untuk temanmu yang masih berjuang hadir secara rutin.",
    narasiRendah:
      "Kehadiranmu masih perlu ditingkatkan. Yuk, konfirmasi hadir tiap hari Sabtu, siapkan perlengkapan belajar dari Sabtu malam, dan pasang alarm Minggu pagi. Kalau ada kendala, komunikasikan dengan kakak relawanmu supaya bisa dicari solusinya.",
  },
};

/**
 * Hitung predikat dari total persentase (0-100).
 * Memilih tier dengan `minPct` tertinggi yang <= pct.
 */
export function derivePredikat(
  pct: number,
  rubric: ReportRubric = DEFAULT_REPORT_RUBRIC
): PredikatTier {
  const sorted = [...rubric.predikat].sort((a, b) => b.minPct - a.minPct);
  return sorted.find((p) => pct >= p.minPct) ?? sorted[sorted.length - 1];
}
