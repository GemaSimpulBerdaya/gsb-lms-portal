/**
 * Mapping header Excel form intake siswa GSB -> field model AnakDidik.
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

/** Ambil nilai pertama yang tidak kosong dari kandidat header. */
export function pick(row: RawRow, keys: string[]): string {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
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
  phone: ["Nomor Tlp/HP/WA Siswa (jika ada)", "Nomor WhatsApp", "No HP Siswa", "phone"],
  parentPhone: ["Nomor Tlp/HP/WA Orang Tua/Wali", "No HP Orang Tua", "parentPhone"],
  schoolOrigin: ["Asal Sekolah", "schoolOrigin"],
  naikKelas: ["Naik Kelas Berapa di Tahun Ajaran Baru 2025/2026?", "Kelas", "Fase", "Kategori"],
  program: ["Pilih Program yang Akan Diikuti", "Program", "Kelas Belajar"],
  studentCode: ["No. Induk", "No Induk", "No.Induk", "NIS", "studentCode"],
  kodeKelas: ["Kode", "kodeKelas"],
  pic: ["PIC", "pic"],
} as const;

/**
 * 39 field survei -> key bersih (camelCase) untuk disimpan di `profil`.
 * Disimpan apa adanya (mentah) — Direktori Siswa membaca profil.<key>.
 */
export const STUDENT_PROFILE_KEYS: { key: string; headers: string[] }[] = [
  { key: "tinggalBersama", headers: ["Tinggal Bersama Siapa?"] },
  { key: "statusOrtu", headers: ["Status Orang Tua"] },
  { key: "jumlahSaudara", headers: ["Jumlah Saudara Kandung"] },
  { key: "kategoriKhusus", headers: ["Apakah siswa termasuk kategori berikut? (boleh pilih lebih dari satu):  "] },
  { key: "jenisDisabilitas", headers: ["Jika disabilitas, pilih jenisnya: "] },
  { key: "penghasilanOrtu", headers: ["Penghasilan Gabungan Orang Tua/Bulan"] },
  { key: "bantuanPemerintah", headers: ["Apakah siswa atau keluarga menerima bantuan pemerintah? (silakan pilih lebih dari satu)"] },
  { key: "jenisTempatTinggal", headers: ["Jenis Tempat Tinggal"] },
  { key: "kendaraan", headers: ["Kendaraan yang Dimiliki (boleh pilih lebih dari satu):  "] },
  { key: "sumberAir", headers: ["Sumber Air Utama"] },
  { key: "aksesListrik", headers: ["Akses Listrik"] },
  { key: "bahanBakarMasak", headers: ["Bahan Bakar Memasak"] },
  { key: "perangkatRumah", headers: ["Perangkat yang tersedia di rumah (boleh pilih lebih dari satu):  "] },
  { key: "aksesInternet", headers: ["Akses Internet di Rumah"] },
  { key: "perangkatBelajar", headers: ["Perangkat Utama untuk Belajar"] },
  { key: "mapelFavorit", headers: ["Mata Pelajaran Favorit"] },
  { key: "mapelSulit", headers: ["Mata Pelajaran yang Dirasa Sulit"] },
  { key: "citaCita", headers: ["Cita-cita atau Karier Impian"] },
  { key: "hobi", headers: ["Hobi/Kegiatan Favorit"] },
  { key: "gayaBelajar", headers: ["Gaya Belajar"] },
  { key: "kemampuanMembaca", headers: ["Kemampuan Membaca dalam Bahasa Indonesia"] },
  { key: "kemampuanInggris", headers: ["Kemampuan Bahasa Inggris secara Keseluruhan"] },
  { key: "jenisBukuDisukai", headers: ["Jenis Buku yang Disukai (boleh pilih lebih dari satu)"] },
  { key: "kesediaanHadirOfflineDepok", headers: ["Kelas ini artinya siswa harus datang langsung. Lokasi belajarnya di Sekolah Master Depok (dekat Stasiun KRL Depok Baru).\n\nApakah siswa bersedia hadir di setiap hari Minggu jam 10.30-12.00 WIB?"] },
  { key: "transportOfflineDepok", headers: ["Bagaimana siswa akan datang ke lokasi belajar?"] },
  { key: "kesediaanHadirOfflineSasak", headers: ["Kelas ini artinya siswa harus datang langsung. Lokasi belajarnya di Masjid Al-Athiq, Perumahan Panorama Citayam, Sasakpanjang, Tajurhalang.\n\nApakah siswa bersedia hadir di setiap hari Minggu jam 10.30-12.00 WIB?"] },
  { key: "transportOfflineSasak", headers: ["Bagaimana siswa akan datang ke lokasi belajar? 2"] },
  { key: "kesediaanHadirOnlineReguler", headers: ["Kelas ini artinya siswa harus datang mengikuti kelas secara online. Lokasi belajarnya di Zoom Meeting, jadi harus memiliki aplikasi Zoom Meeting.\n\nApakah siswa bersedia hadir di setiap hari Minggu jam 10.30-12.00 WIB?"] },
  { key: "kesediaanOncamReguler", headers: ["Dikarenakan online, kami berharap siswa terlibat aktif dan saling mengenal, sehingga butuh oncam (menyalakan kamera) selama pembelajaran rlangsung. Apakah siswa bersedia oncam?"] },
  { key: "kesediaanHadirOnlineSNBT", headers: ["Kelas ini artinya siswa harus datang mengikuti kelas secara online. Lokasi belajarnya di Zoom Meeting, jadi harus memiliki aplikasi Zoom Meeting.\n\nApakah siswa bersedia hadir di setiap hari Minggu jam 10.30-12.00 WIB? 2"] },
  { key: "kesediaanOncamSNBT", headers: ["Dikarenakan online, kami berharap siswa terlibat aktif dan saling mengenal, sehingga butuh oncam (menyalakan kamera) selama pembelajaran rlangsung. Apakah siswa bersedia oncam? 2"] },
  { key: "targetKampus1", headers: ["Pilihan 1: Target Universitas dan Jurusan Impian"] },
  { key: "targetKampus2", headers: ["Pilihan 2: Target Universitas dan Jurusan Impian"] },
  { key: "targetKampus3", headers: ["Pilihan 3: Target Universitas dan Jurusan Impian"] },
  { key: "targetKampus4", headers: ["Pilihan 4: Target Universitas dan Jurusan Impian"] },
  { key: "kesediaanSelfDev", headers: ["Selain kelas belajar materi SNBT dan Try Out, GSB juga akan menyediakan kelas Self Development (mengenal diri, CV, Portfolio, Vision Board, Mental Health, dsb).\n\nKelas ini dilakukan sebulan sekali secara asinkronus maupun online via Zoom Meeting dengan jadwal kesepakatan bersama. Apakah kamu bersedia mengikuti kelas tambahan tersebut?"] },
  { key: "pernyataanPersetujuan", headers: ["Pernyataan Persetujuan"] },
  { key: "sejakKapanGSB", headers: ["Sejak kapan ikut GSB? (sebutkan bulan dan tahun saja)"] },
];

/**
 * Turunkan fase dari jawaban "Naik Kelas Berapa". Best-effort keyword scan.
 * Mengembalikan nilai mentah bila tidak ada yang cocok (admin koreksi manual).
 */
export function deriveFase(raw: string): string {
  if (!raw) return "";
  const s = raw.toLowerCase();
  if (/disabilitas|pelita/.test(s)) return "Fase Pelita";
  if (/usia dini|paud|tk|tunas|pucuk/.test(s)) return "Fase Tunas & Pucuk";
  if (/\b1\b|\b2\b|kelas 1|kelas 2|fase a/.test(s)) return "Fase A";
  if (/\b3\b|\b4\b|kelas 3|kelas 4|fase b/.test(s)) return "Fase B";
  if (/\b5\b|\b6\b|kelas 5|kelas 6|fase c/.test(s)) return "Fase C";
  if (/\b7\b|\b8\b|\b9\b|smp|fase d/.test(s)) return "Fase D";
  if (/snbt/.test(s)) return "Fase E (SNBT)";
  if (/\b10\b|\b11\b|\b12\b|sma|fase e/.test(s)) return "Fase E";
  return raw; // fallback: simpan mentah, biar admin perbaiki
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
  if (/online.*snbt|snbt/.test(s)) return "Online SNBT";
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
  const idx = raw.indexOf(",");
  if (idx === -1) return { birthPlace: raw.trim() };
  const birthPlace = raw.slice(0, idx).trim();
  const datePart = raw.slice(idx + 1).trim();
  const parsed = datePart ? Date.parse(datePart) : NaN;
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
  kodeKelas?: string;
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
    kodeKelas: pick(row, [...CORE_HEADERS.kodeKelas]) || undefined,
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
  "No. Induk", // WAJIB diisi — kunci dedup, tidak ada di form asli
  CORE_HEADERS.name[0],
  CORE_HEADERS.gender[0],
  CORE_HEADERS.birthRaw[0],
  CORE_HEADERS.address[0],
  CORE_HEADERS.phone[0],
  CORE_HEADERS.parentPhone[0],
  CORE_HEADERS.schoolOrigin[0],
  CORE_HEADERS.naikKelas[0],
  ...STUDENT_PROFILE_KEYS.slice(0, 1).map((p) => p.headers[0]), // "Tinggal Bersama Siapa?"
  ...STUDENT_PROFILE_KEYS.slice(1).map((p) => p.headers[0]),
  CORE_HEADERS.program[0],
];

/** Satu baris contoh isi untuk template (membantu admin paham format). */
export const TEMPLATE_SAMPLE_ROW: Record<string, string> = {
  "No. Induk": "2526001",
  [CORE_HEADERS.name[0]]: "Danish Ar Rauf",
  [CORE_HEADERS.gender[0]]: "Laki-laki",
  [CORE_HEADERS.birthRaw[0]]: "Depok, 12 Januari 2015",
  [CORE_HEADERS.address[0]]: "Jl. Contoh No. 1, RT 001 RW 002, Depok",
  [CORE_HEADERS.phone[0]]: "081317043331",
  [CORE_HEADERS.parentPhone[0]]: "081298765432",
  [CORE_HEADERS.schoolOrigin[0]]: "MI Sirojuul Ummah",
  [CORE_HEADERS.naikKelas[0]]: "3 SD",
  [CORE_HEADERS.program[0]]: "Kelas Offline Depok (PAUD - SMA)",
};

