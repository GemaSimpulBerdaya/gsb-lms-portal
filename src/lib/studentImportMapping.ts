/**
 * Mapping header Excel form intake siswa GSB -> field model Student.
 *
 * Form intake = respons Google Form (kolom pertama "Timestamp"), header-nya
 * panjang & messy. Modul ini memetakan header mentah ke field bersih.
 *
 * Dipakai oleh halaman Direktori Siswa saat impor Excel.
 *
 * Catatan penting:
 * - "No. Induk" (studentCode) TIDAK ada di form. Wajib ditambahkan sebagai
 *   kolom di Excel sebelum impor — ini kunci dedup & relasi ke sheet penilaian.
 * - Nama orang tua tidak ditanya form (raport memang tidak memakainya).
 * - Fase & region diturunkan best-effort dari teks form; admin koreksi manual
 *   bila ada yang meleset.
 */

export type RawRow = Record<string, unknown>;

const normalizeHeader = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase();

/** Ambil nilai pertama yang tidak kosong dari kandidat header. */
export function pick(row: RawRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }

  const normalizedRow = new Map(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value])
  );
  for (const key of keys) {
    const value = normalizedRow.get(normalizeHeader(key));
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

/** Header kandidat untuk field inti (operasional + raport). */
export const CORE_HEADERS = {
  name: ["Nama Lengkap Siswa", "Nama Siswa", "Nama", "name"],
  gender: ["Jenis Kelamin", "gender"],
  birthRaw: ["Tempat Tanggal Lahir", "Tempat, Tanggal Lahir", "TTL"],
  address: ["Alamat Lengkap (sesuai domisili saat ini)", "Alamat Domisili", "Alamat", "address"],
  phone: ["Nomor Tlp/HP/WA Siswa (jika ada)", "Nomor Tlp Siswa", "Nomor WhatsApp", "No HP Siswa", "phone"],
  parentPhone: ["Nomor Tlp/HP/WA Orang Tua/Wali", "Nomor Tlp Orang Tua/Wali", "No HP Orang Tua", "parentPhone"],
  schoolOrigin: ["Asal Sekolah", "schoolOrigin"],
  naikKelas: [
    "Fase",
    "Kelas",
    "Naik Kelas Berapa di Tahun Ajaran Baru 2026/2027? Mohon tulis dengan benar, karena ini menentukan pembagian kelas dan kelompok belajar",
    "Naik Kelas Berapa di Tahun Ajaran Baru 2026/2027?",
    "Naik Kelas Berapa di Tahun Ajaran Baru 2025/2026?",
    "Kategori",
  ],
  program: ["Kelas Pilihan", "Pilih Program yang Akan Diikuti", "Program", "Kelas Belajar"],
  studentCode: ["No. Induk", "No Induk", "No.Induk", "NIS", "studentCode"],
  pic: ["PIC", "pic"],
} as const;


/**
 * 39 field survei -> key bersih (camelCase) untuk disimpan di `profil`.
 * Disimpan apa adanya (mentah) — Direktori Siswa membaca profil.<key>.
 */
export const STUDENT_PROFILE_KEYS: { key: string; label: string; headers: string[] }[] = [
  { key: "timestampPendaftaran", label: "Waktu Pendaftaran", headers: ["Timestamp"] },
  { key: "kelas", label: "Kelas", headers: ["Kelas", "Naik Kelas Berapa di Tahun Ajaran Baru 2026/2027? Mohon tulis dengan benar, karena ini menentukan pembagian kelas dan kelompok belajar"] },
  { key: "sejakKapanGSB", label: "Sejak Kapan Ikut GSB", headers: ["Sejak kapan ikut GSB? (sebutkan bulan dan tahun saja)"] },
  { key: "tinggalBersama", label: "Tinggal Bersama", headers: ["Tinggal Bersama Siapa?"] },
  { key: "statusOrtu", label: "Status Orang Tua", headers: ["Status Orang Tua"] },
  { key: "jumlahSaudara", label: "Jumlah Saudara Kandung", headers: ["Jumlah Saudara Kandung"] },
  { key: "catatanKhusus", label: "Catatan Khusus", headers: ["Catatan Khusus", "Apakah siswa termasuk kategori berikut? (boleh pilih lebih dari satu):"] },
  { key: "jenisDisabilitas", label: "Jenis Disabilitas", headers: ["Jika disabilitas, pilih jenisnya:"] },
  { key: "penghasilanOrtu", label: "Penghasilan Gabungan Orang Tua/Bulan", headers: ["Penghasilan Gabungan Orang Tua/Bulan"] },
  { key: "bantuanPemerintah", label: "Bantuan Pemerintah", headers: ["Apakah siswa atau keluarga menerima bantuan pemerintah? (silakan pilih lebih dari satu)"] },
  { key: "jenisTempatTinggal", label: "Jenis Tempat Tinggal", headers: ["Jenis Tempat Tinggal"] },
  { key: "kendaraan", label: "Kendaraan yang Dimiliki", headers: ["Kendaraan yang Dimiliki (boleh pilih lebih dari satu):"] },
  { key: "sumberAir", label: "Sumber Air Utama", headers: ["Sumber Air Utama"] },
  { key: "aksesListrik", label: "Akses Listrik", headers: ["Akses Listrik"] },
  { key: "bahanBakarMasak", label: "Bahan Bakar Memasak", headers: ["Bahan Bakar Memasak"] },
  { key: "perangkatRumah", label: "Perangkat di Rumah", headers: ["Perangkat yang tersedia di rumah (boleh pilih lebih dari satu):"] },
  { key: "aksesInternet", label: "Akses Internet di Rumah", headers: ["Akses Internet di Rumah"] },
  { key: "perangkatBelajar", label: "Perangkat Utama untuk Belajar", headers: ["Perangkat Utama untuk Belajar"] },
  { key: "mapelFavorit", label: "Mata Pelajaran Favorit", headers: ["Mata Pelajaran Favorit"] },
  { key: "mapelSulit", label: "Mata Pelajaran yang Sulit", headers: ["Mata Pelajaran yang Sulit", "Mata Pelajaran yang Dirasa Sulit"] },
  { key: "citaCita", label: "Cita-cita di Masa Depan", headers: ["Cita-cita di Masa Depan", "Cita-cita atau Karier Impian"] },
  { key: "hobi", label: "Hobi/Kegiatan Favorit", headers: ["Hobi/Kegiatan Favorit"] },
  { key: "gayaBelajar", label: "Gaya Belajar", headers: ["Gaya Belajar"] },
  { key: "kemampuanMembaca", label: "Kemampuan Membaca Bahasa Indonesia", headers: ["Kemampuan Membaca dalam Bahasa Indonesia"] },
  { key: "kemampuanInggris", label: "Kemampuan Bahasa Inggris", headers: ["Kemampuan Bahasa Inggris secara Keseluruhan"] },
  { key: "jenisBukuDisukai", label: "Jenis Buku yang Disukai", headers: ["Jenis Buku yang Disukai (boleh pilih lebih dari satu)"] },
  { key: "kepuasanProgram", label: "Kepuasan terhadap Program GSB", headers: ["Seberapa puas siswa/orang tua/wali terhadap program dan pelayanan GSB selama ini?\n\nJika siswa baru, bisa dilewatkan saja"] },
  { key: "peningkatanSemangat", label: "Peningkatan Semangat Belajar", headers: ["Apakah ada peningkatan semangat belajar anak di rumah atau di sekolah, setelah mengikuti program di GSB selama ini?\n\nJika siswa baru, bisa dilewatkan saja"] },
  { key: "harapanOrtu", label: "Kesan, Pesan, atau Harapan Orang Tua/Wali", headers: ["Kesan dan pesan atau harapan orang tua/wali setelah anaknya menjadi siswa di GSB"] },
  { key: "kesediaanHadirOfflineDepok", label: "Kesediaan Hadir Offline Depok", headers: ["Kelas ini artinya siswa harus datang langsung. Lokasi belajarnya di Sekolah Master Depok (dekat Stasiun KRL Depok Baru).\n\nApakah siswa bersedia hadir di setiap hari Minggu jam 10.30-12.00 WIB?"] },
  { key: "persetujuanSeleksiDepok", label: "Persetujuan Seleksi Offline Depok", headers: ["Untuk siswa baru Kelas Offline Depok, GSB akan melakukan seleksi terlebih dahulu dikarenakan kuota terbatas. Jika kuota kelas sudah penuh, maka status siswa akan menjadi waiting list. GSB akan memprioritaskan siswa lama yang konsisten hadir belajar."] },
  { key: "kesediaanHadirOfflineSasak", label: "Kesediaan Hadir Offline Sasak Panjang", headers: ["Kelas ini artinya siswa harus datang langsung. Lokasi belajarnya di Masjid Al-Athiq, Perumahan Panorama Citayam, Sasakpanjang, Tajurhalang.\n\nApakah siswa bersedia hadir di setiap hari Minggu jam 10.30-12.00 WIB?"] },
  { key: "persetujuanSeleksiSasak", label: "Persetujuan Seleksi Offline Sasak Panjang", headers: ["Untuk siswa baru Kelas Offline Sasak Panjang, GSB akan melakukan seleksi terlebih dahulu dikarenakan kuota terbatas. Jika kuota kelas sudah penuh, maka status siswa akan menjadi waiting list. GSB akan memprioritaskan siswa lama yang konsisten hadir belajar."] },
  { key: "kesediaanHadirOnlineReguler", label: "Kesediaan Hadir Online Reguler", headers: ["Kelas ini artinya siswa harus datang mengikuti kelas secara online. Lokasi belajarnya di Zoom Meeting, jadi harus memiliki aplikasi Zoom Meeting.\n\nApakah siswa bersedia hadir di setiap hari Minggu jam 10.30-12.00 WIB?"] },
  { key: "kesediaanOncamReguler", label: "Kesediaan Oncam Online Reguler", headers: ["Dikarenakan online, kami berharap siswa terlibat aktif dan saling mengenal, sehingga butuh oncam (menyalakan kamera) selama pembelajaran rlangsung. Apakah siswa bersedia oncam?"] },
  { key: "persetujuanMinimumReguler", label: "Persetujuan Ketentuan Online Reguler", headers: ["Untuk siswa Kelas Online Reguler (SD-SMA). GSB akan membuka kelas belajar jika minimal siswa di kelas atau fase tersebut ada 3 orang. Jika kurang dari 3 orang, maka siswa tersebut akan masuk waiting list."] },

  { key: "pernyataanPersetujuan", label: "Pernyataan Persetujuan", headers: ["Pernyataan Persetujuan"] },
];

export const LOCATION_PROFILE_KEYS = [
  "catatanKhusus",
  "mapelFavorit",
  "mapelSulit",
  "citaCita",
  "hobi",
  "gayaBelajar",
  "kemampuanMembaca",
  "kemampuanInggris",
  "jenisBukuDisukai",
] as const;

/**
 * Turunkan fase dari jawaban "Naik Kelas Berapa". Best-effort keyword scan.
 * Mengembalikan nilai mentah bila tidak ada yang cocok (admin koreksi manual).
 */
/**
 * Turunkan fase canonical dari raw text "Pilih Program/Fase/Kelas".
 *
 * Output dinormalisasi ke UPPERCASE supaya konsisten dengan key
 * `faseConfig` di Settings (source of truth) dan supaya filter rekap
 * nilai bisa pakai equality strict tanpa perlu case-insensitive
 * compare. Legacy data DB juga sudah UPPERCASE, jadi import baru
 * langsung match tanpa migrasi.
 *
 * Label tampilan di UI (mis. "Fase A (1-2 SD)") di-handle terpisah
 * via `formatFaseLabel()` di `utils/formatters.ts`.
 */
export function deriveFase(raw: string): string {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (/^(fase\s*)?a$/.test(s)) return "FASE A";
  if (/^(fase\s*)?b$/.test(s)) return "FASE B";
  if (/^(fase\s*)?c$/.test(s)) return "FASE C";
  if (/^(fase\s*)?d$/.test(s)) return "FASE D";
  if (/^(fase\s*)?e$/.test(s)) return "FASE E";
  if (/disabilitas|pelita/.test(s)) return "FASE PELITA";
  if (/usia dini|paud|tk|tunas|pucuk/.test(s)) return "FASE TUNAS & PUCUK";
  if (/\b1\b|\b2\b|kelas 1|kelas 2|fase a/.test(s)) return "FASE A";
  if (/\b3\b|\b4\b|kelas 3|kelas 4|fase b/.test(s)) return "FASE B";
  if (/\b5\b|\b6\b|kelas 5|kelas 6|fase c/.test(s)) return "FASE C";
  if (/\b7\b|\b8\b|\b9\b|smp|fase d/.test(s)) return "FASE D";

  if (/\b10\b|\b11\b|\b12\b|sma|fase e/.test(s)) return "FASE E";
  return raw.toUpperCase(); // fallback: simpan mentah (uppercased), admin perbaiki
}

/**
 * Turunkan region dari "Pilih Program". Best-effort keyword scan.
 * Mengembalikan nilai mentah bila tidak cocok.
 */
export function deriveRegion(raw: string): string {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (/offline.*depok|depok/.test(s)) return "Offline Depok";
  if (/sasak|citayam|tajurhalang|bogor/.test(s)) return "Offline Sasak Panjang";

  if (/online.*reguler|reguler|online/.test(s)) return "Online Reguler";
  return raw;
}

/**
 * Pisah "Tempat Tanggal Lahir" jadi birthPlace + birthDate (best-effort).
 * Format umum: "Depok, 12 Januari 2015". Bila tak ada koma, seluruhnya
 * dianggap birthPlace.
 */
export function parseBirth(raw: string): { birthPlace: string; birthDate?: string } {
  if (!raw) return { birthPlace: "" };
  const months: Record<string, string> = {
    januari: "01", februari: "02", maret: "03", april: "04", mei: "05", juni: "06",
    juli: "07", agustus: "08", september: "09", oktober: "10", november: "11", desember: "12",
  };
  const cleaned = raw.replace(/\s+/g, " ").trim();
  const dateMatch = cleaned.match(/(\d{1,2})[\s./-]+([A-Za-z]+|\d{1,2})[\s./-]+(\d{4})/i);
  if (!dateMatch) return { birthPlace: cleaned.replace(/,+$/, "").trim() };
  const [, day, rawMonth, year] = dateMatch;
  const month = months[rawMonth.toLowerCase()] || rawMonth.padStart(2, "0");
  const parsed = Date.parse(`${year}-${month}-${day.padStart(2, "0")}T00:00:00.000Z`);
  const birthPlace = cleaned.slice(0, dateMatch.index).replace(/[\s,.-]+$/, "").trim();
  return {
    birthPlace,
    birthDate: Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString(),
  };
}

/** Normalisasi gender ke enum model. */
export function normalizeGender(raw: string): "Laki-laki" | "Perempuan" | undefined {
  const s = raw.toLowerCase();
  if (/laki|pria|male|l\b/.test(s)) return "Laki-laki";
  if (/perempuan|wanita|female|p\b/.test(s)) return "Perempuan";
  return undefined;
}

/** Hasil mapping satu baris Excel -> payload siap kirim ke API bulk. */
export interface MappedStudent {
  studentCode?: string;
  name: string;
  fase: string;
  region: string;
  pic?: string;
  program?: string;
  gender?: "Laki-laki" | "Perempuan";
  birthPlace?: string;
  birthDate?: string;
  schoolOrigin?: string;
  phone?: string;
  parentPhone?: string;
  address?: string;
  profil: Record<string, unknown>;
}

/** Petakan satu baris Excel form intake -> MappedStudent. */
export function mapRow(row: RawRow): MappedStudent {
  const name = pick(row, [...CORE_HEADERS.name]);
  const naikKelas = pick(row, [...CORE_HEADERS.naikKelas]);
  const program = pick(row, [...CORE_HEADERS.program]);
  const birth = parseBirth(pick(row, [...CORE_HEADERS.birthRaw]));

  // Kumpulkan semua field survei ke profil
  const profil: Record<string, unknown> = {};
  for (const { key, headers } of STUDENT_PROFILE_KEYS) {
    const val = pick(row, headers);
    if (val) profil[key] = val;
  }

  return {
    studentCode: pick(row, [...CORE_HEADERS.studentCode]) || undefined,
    name,
    fase: deriveFase(naikKelas),
    region: deriveRegion(program),
    pic: pick(row, [...CORE_HEADERS.pic]) || undefined,
    program: program || undefined,
    gender: normalizeGender(pick(row, [...CORE_HEADERS.gender])),
    birthPlace: birth.birthPlace || undefined,
    birthDate: birth.birthDate,
    schoolOrigin: pick(row, [...CORE_HEADERS.schoolOrigin]) || undefined,
    phone: pick(row, [...CORE_HEADERS.phone]) || undefined,
    parentPhone: pick(row, [...CORE_HEADERS.parentPhone]) || undefined,
    address: pick(row, [...CORE_HEADERS.address]) || undefined,
    profil,
  };
}

/**
 * Header template impor (urut sesuai form intake + kolom "No. Induk" di depan).
 * Dipakai tombol "Download Template" di Direktori Siswa — admin isi sesuai kolom
 * ini agar mapping & dedup (No. Induk) berjalan.
 */
export const TEMPLATE_HEADERS: string[] = [
  "No.",
  "No. Induk",
  CORE_HEADERS.name[0],
  CORE_HEADERS.gender[0],
  "Nomor Tlp Siswa",
  "Nomor Tlp Orang Tua/Wali",
  CORE_HEADERS.schoolOrigin[0],
  "Kelas",
  "Fase",
  ...STUDENT_PROFILE_KEYS
    .filter(({ key }) => (LOCATION_PROFILE_KEYS as readonly string[]).includes(key))
    .map((p) => p.headers[0]),
  "Kelas Pilihan",
];

/** Field siswa yang dibutuhkan untuk export (subset model Student). */
export interface ExportableStudent {
  studentCode?: string;
  name: string;
  fase?: string;
  region?: string;
  program?: string;
  gender?: string;
  birthPlace?: string;
  birthDate?: string | Date;
  schoolOrigin?: string;
  phone?: string;
  parentPhone?: string;
  address?: string;
  profil?: Record<string, unknown> | null;
}


/**
 * Kebalikan dari mapRow: Student -> baris Excel pakai TEMPLATE_HEADERS.
 * Hasilnya kompatibel untuk di-impor ulang (round-trip), jadi admin bisa
 * export, edit di Excel, lalu impor lagi (dedup by No. Induk).
 */
export function studentToTemplateRow(s: ExportableStudent): Record<string, string> {
  const row: Record<string, string> = {};
  for (const h of TEMPLATE_HEADERS) row[h] = "";
  row["No."] = "";
  row["No. Induk"] = s.studentCode ?? "";
  row[CORE_HEADERS.name[0]] = s.name ?? "";
  row[CORE_HEADERS.gender[0]] = s.gender ?? "";
  row["Nomor Tlp Siswa"] = s.phone ?? "";
  row["Nomor Tlp Orang Tua/Wali"] = s.parentPhone ?? "";
  row[CORE_HEADERS.schoolOrigin[0]] = s.schoolOrigin ?? "";
  // Kolom "Naik Kelas" tidak disimpan mentah; isi fase agar deriveFase round-trip.
  row["Kelas"] = String(s.profil?.kelas || s.fase || "");
  row["Fase"] = s.fase ?? "";
  // Kolom program: pakai program asli kalau ada, fallback region.
  row[CORE_HEADERS.program[0]] = s.program ?? s.region ?? "";
  // Field survei dari profil.
  for (const { key, headers } of STUDENT_PROFILE_KEYS) {
    const val = s.profil?.[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      row[headers[0]] = String(val);
    }
  }
  return row;
}

/** Satu baris contoh isi untuk template (membantu admin paham format). */
export const TEMPLATE_SAMPLE_ROW: Record<string, string> = {
  "No.": "1",
  "No. Induk": "2526001",
  [CORE_HEADERS.name[0]]: "Danish Ar Rauf",
  [CORE_HEADERS.gender[0]]: "Laki-laki",
  "Nomor Tlp Siswa": "081317043331",
  "Nomor Tlp Orang Tua/Wali": "081298765432",
  [CORE_HEADERS.schoolOrigin[0]]: "MI Sirojuul Ummah",
  Kelas: "3 SD/MI",
  Fase: "B",
  "Kelas Pilihan": "Kelas Offline Depok (PAUD - SMA)",
};

