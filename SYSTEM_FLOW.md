# Panduan Alur Sistem GSB LMS (Untuk Frontend & Backend)

Dokumen ini menjelaskan alur sistem dari ujung ke ujung (end-to-end) pada platform GSB LMS, peran setiap user, model data, dan kontrak API yang sudah diimplementasikan.

> Referensi cepat: `AGENTS.md` untuk perintah build/lint, variabel env, dan konvensi proyek.

---

## 1. Peran Pengguna (Roles)

Sistem mendukung tiga peran utama. Semua UI berada di repo ini (`gsb-lms-portal`) — tidak ada lagi pemisahan repo admin.

1. **Super Admin** (`role: "ADMIN"`) — pengelola pusat operasional akademik. Mengakses portal `/admin/*`.
2. **Relawan / Volunteer** (`role: "RELAWAN"`) — pelaksana lapangan. Mengakses portal volunteer di `/dashboard`, `/schedule`, `/students-data`, `/attendance`, `/evaluation`, `/reporting`.
3. **Student / Siswa SMA** (`role: "SMA"` dari token legacy) — peserta didik yang masuk via **SSO** dari aplikasi `gsb-web`. Diarahkan ke `/student/dashboard`.

Akun Admin dan Relawan sama-sama disimpan di koleksi `relawans` dan dibedakan oleh field `role`.

---

## 2. Alur Autentikasi (Authentication Flow)

Ada dua pintu autentikasi yang terpisah sepenuhnya (cookie, helper, dan lifecycle-nya berbeda).

### A. Login Relawan & Admin (Halaman: `/`)
- **FE**: Form email + password di `src/app/login/` (root page `/`).
- **BE** (`POST /api/auth/login`): verifikasi kredensial via `bcryptjs`, lalu menerbitkan **JWT HS256** (`INTERNAL_JWT_SECRET`, 7 hari).
- **Session cookie**: `gsb_lms_session` (httpOnly, sameSite=lax, Secure di production).
- **Helper**: `getSessionUser()` di `src/lib/session.ts` → mengembalikan `{ id, role, email }`.
- **Logout**: `POST /api/auth/logout` menghapus cookie.
- **Recovery**: `POST /api/auth/forgot-password` & `POST /api/auth/reset-password` (token disimpan di field `resetToken` pada dokumen Relawan).
- **Routing pasca-login**: Admin diarahkan ke `/admin/dashboard`, Relawan ke `/dashboard`. `AdminGuard` (`src/components/admin/AdminGuard.tsx`) mem-proteksi route group `(admin)`.

### B. Autentikasi Student (SSO dari `gsb-web`)
- **Trigger**: Siswa klik menu LMS di `gsb-web` → redirect ke `${LMS_URL}/student?token=...`.
- **Handler** (`src/app/student/page.tsx`): memanggil `verifyLegacyJWT(token)` dengan `LEGACY_JWT_SECRET`. Token harus punya `role: "SMA"`.
- **Session cookie**: `gsb_student_token` (httpOnly, umur 1 hari). **Terpisah** dari `gsb_lms_session`.
- **Helper**: `getStudentSession()` di `src/lib/student-session.ts`.
- **Redirect**: sukses → `/student/dashboard`; gagal → `/?error=...`.

---

## 3. Alur SUPER ADMIN (`/admin/*`)

Portal Admin adalah pusat kendali seluruh operasional LMS. Menu di `AdminSidebar`:
Dashboard · Data Relawan · Data Anak Didik · Data Modul · Kategori Modul · Laporan Kegiatan · Rekap Nilai & Raport · Manajemen Semester · Wilayah & Fase.

### A. Executive Insights Dashboard (`/admin/dashboard`)
- **Fungsi**: ringkasan operasional real-time.
- **API utama**:
  - `GET /api/admin/dashboard` — total relawan, anak didik, modul, dan 5 laporan terbaru.
  - `GET /api/admin/dashboard/stats?semester=...` — total relawan, siswa, jadwal, modul (scoped semester), serta tren laporan 6 bulan terakhir untuk chart (Recharts).

### B. Manajemen Semester (`/admin/semesters`)
- **Fungsi**: siklus akademik (Ganjil/Genap).
- **Model**: disimpan di koleksi `settings` sebagai tiga key: `availableSemesters` (list), `activeSemester` (string), `closedSemesters` (list).
- **API**: `GET /api/admin/semesters` (list + stats per semester: schedules/reports/modules), `GET & POST /api/admin/settings` untuk mengubah daftar/status.
- **Semantic**: Semester aktif menjadi konteks global. Semester pada `closedSemesters` dianggap terkunci — route volunteer (`/api/reports`, `/api/volunteer/evaluation`) memeriksa semester saat write dan menolak perubahan jika `semester !== currentSemester`.

### C. Wilayah & Fase (`/admin/levels`)
- **Fungsi**: mengelola daftar wilayah (kota) dan jenjang pendidikan (fase) yang dipakai di seluruh sistem.
- **Penyimpanan**: key `availableRegions` dan `availableLevels` di koleksi `settings` (default: `DISABILITAS`, `FASE TUNAS`, `FASE PUCUK`, `FASE PELITA`, `FASE A`–`E`, `SNBT`).
- **API**: `GET/POST /api/admin/settings`.

### D. Kategori Modul (`/admin/categories`)
- **Fungsi**: CRUD sub-kategori/jenis kelas & mata pelajaran untuk modul (misal: "Kelas 3", "Biologi").
- **Model**: `SubCategory` (`subcategories`) dengan field `name`, `type: "SNBT" | "OFFLINE"`, `parentLabel`, `order`.
- **API**: `GET/POST/PUT/DELETE /api/admin/subcategories`.

### E. Manajemen Database Relawan (`/admin/volunteers`)
- **Fungsi**: CRUD akun relawan + hashing password.
- **API**: `GET & POST /api/admin/volunteers`, `PUT/DELETE /api/admin/volunteers/[id]`.
- **Model**: `Relawan` (`relawans`) — `email`, `password` (hashed), `teamName`, `region`, `name`, `role`.

### F. Manajemen Database Anak Didik (`/admin/students`)
- **Fungsi**: CRUD anak didik, termasuk **impor massal dari Excel** dan data profil lengkap (gender, birthPlace, schoolOrigin, dll. — dipakai untuk raport).
- **API**: `GET & POST /api/admin/students`, `POST /api/admin/students/bulk` (insert banyak), `POST /api/admin/students/bulk-delete`, `PUT/DELETE /api/admin/students/[id]`.
- **Model**: `AnakDidik` (`anak_didik`) — core identity (`name`, `region`, `category`, `parentName`), data Excel (`studentCode`, `kodeKelas`, `pic`), dan data raport (`gender`, `birthPlace`, `birthDate`, `schoolOrigin`, `phone`, `address`).

### G. Manajemen Modul & Kuis (`/admin/modules`)
- **Fungsi**: CRUD modul (OFFLINE dan SNBT) + upload file + generate kuis via AI.
- **API**:
  - `GET & POST /api/admin/modules` — daftar modul + flag `hasQuiz`.
  - `PUT/DELETE /api/admin/modules/[id]`.
  - `POST /api/admin/upload` — upload file ke `public/uploads/modules`.
  - `GET/POST /api/admin/quiz/[moduleId]` — baca/simpan kuis manual.
  - `POST /api/admin/quiz/generate` dan `POST /api/admin/generate-quiz` — generate soal dari PDF/teks dengan Google **Gemini** (`gemini-flash-latest` / fallback ke model lain).
- **Model**: `Module` (`modul`) — `title`, `slug`, `description`, `category: "SNBT" | "OFFLINE"`, `subCategory`, `week` (untuk OFFLINE), `fileUrl`, `order`, `semester`, `prerequisiteModule` (ref ke Module lain — membentuk rantai linier per topik SNBT).

### H. Audit Laporan Kegiatan (`/admin/reports`)
- **Fungsi**: verifikasi dokumentasi kegiatan relawan.
- **API**: `GET /api/admin/reports?page=&limit=&semester=&relawanId=` — populate `relawanId` (nama + email), pagination.

### I. Rekap Nilai & Raport (`/admin/grades`)
- **Fungsi**: melihat dan men-generate raport akhir semester untuk semua anak didik.
- **API**: `GET /api/admin/grades?semester=&region=&level=`.
- **Komposit**: API ini menggabungkan 3 sumber data per siswa:
  1. **`NilaiOffline`** — TUGAS mingguan (3 skor: Konsep/Kuis/Sikap), UTS, UAS per subject, TRYOUT.
  2. **`Attendance`** — rekap HADIR/IZIN/SAKIT/ALFA/ASINKRONUS untuk Lampiran 2 raport.
  3. **`Schedule.kbmDates`** — daftar tanggal KBM + topik + link dokumentasi untuk Lampiran 1.
- **Output**: payload siap cetak (profile, weeklyGrades, UAS breakdown per grup, tryouts, kbmDates, attendanceSummary, summary total). Ini adalah sumber resmi raport — relawan tidak men-generate PDF sendiri.

---

## 4. Alur RELAWAN (`/dashboard`, `/schedule`, …)

Relawan mengelola KBM-nya sendiri: profil mengajar, anak didik, absensi, nilai, dan laporan.

### A. Dashboard Relawan (`/dashboard`)
- **API**:
  - `GET /api/volunteer/dashboard` — profil relawan + total laporan + laporan bulan ini + 3 laporan terakhir.
  - `GET /api/volunteer/dashboard/stats?semester=...` — total jadwal, laporan, anak didik (dihitung dari kombinasi region+level pada semua Schedule relawan), beserta 5 jadwal terakhir.

### B. Jadwal Mengajar (`/schedule`)
- **Fungsi**: relawan mengelola daftar jadwal mengajarnya. **Satu relawan BOLEH punya beberapa kombinasi `region + level` per semester** (sistem saat ini tidak membatasi 1:1 seperti versi dokumen lama).
- **Model**: `Schedule` (`jadwal`) — `relawanId`, `region`, `level`, `semester`, `activeWeek`, dan `kbmDates[]` (tanggal KBM, topik materi, link materi, link dokumentasi).
- **API**: `GET/POST/PUT/DELETE /api/volunteer/schedule`.
  - Duplikasi (kombinasi `region + level + semester` sama) ditolak dengan 400.
- **FE**: halaman `/schedule` menampilkan daftar jadwal, form tambah/edit, pilihan semester, dan daftar modul per minggu untuk jadwal yang dipilih.

### C. Modul Pembelajaran (dipanggil dari `/schedule`)
- **API**: `GET /api/volunteer/modules?level=<FASE>&week=<N>&semester=<S>`.
  - Hanya modul `category: "OFFLINE"`.
  - Filter level memakai `availableLevels` dari Settings. Level `SD`/`SMP` diperluas ke sub-kategori (Kelas 1–6, 7–9) untuk backward compat.
  - Jika `week` tidak diberikan, response berisi modul yang sudah dikelompokkan per minggu.
  - Menyertakan `fileUrl` agar relawan bisa **download materi untuk mengajar offline**.

### D. Manajemen Anak Didik (`/students-data`)
- **FE**: filter Wilayah (region) + Jenjang (level) → tabel rekapitulasi nama anak didik.
- **API**: `GET /api/volunteer/students?region=X&level=Y` dan `GET /api/volunteer/students/all` (daftar lengkap tanpa filter).
- Catatan: matching region/level case-insensitive; `level` divalidasi terhadap `availableLevels`.

### E. Absensi Siswa (`/attendance` & `/attendance/recap`)
Fitur ini **tidak tercantum di dokumen lama** — sudah aktif di sistem saat ini.
- **Model**: `Attendance` (`absensi`) — `relawanId`, `anakDidikId`, `week`, `semester`, `date`, `status: "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS"`, `notes`.
  - `ASINKRONUS` = kelas dilakukan asinkron (tidak dihitung sebagai absensi tatap muka).
- **API**:
  - `GET /api/volunteer/attendance?region=&level=&week=&semester=&date=` — daftar siswa + status absensi yang sudah ada.
  - `POST /api/volunteer/attendance` — bulk upsert (`week + date + anakDidikId` sebagai kunci).
  - `GET /api/volunteer/attendance/recap?region=&semester=&week=` — ringkasan per pekan/tanggal.
- **FE**:
  - `/attendance` — form input per jadwal (memakai Schedule.activeWeek).
  - `/attendance/recap` — riwayat absensi.

### F. Evaluasi & Data Nilai (`/evaluation`)
- **Model**: `NilaiOffline` (`nilai_offline`) — satu koleksi mencakup **semua jenis penilaian**:
  - `type`: `TUGAS` (KBM pekanan, punya 3 sub-skor: `scoreConcept`, `scoreQuiz`, `scoreAttitude`, skor akhir = rata-rata), `KUIS` (legacy), `UJIAN` (legacy), `UTS`, `UAS`, `TRYOUT`.
  - `UAS` wajib membawa `subject` ∈ {`NUMERASI`, `SAINS`, `BINDO`, `BING`, `MANDIRI`, `BERNALAR_KRITIS`, `KREATIF`} dan `maxScore` (karena rubrik per komponen berbeda, mis. 30/20/15).
  - `TRYOUT` (khusus kelas SNBT) wajib membawa `tryoutNumber` (1 atau 2) + `week`.
- **API**:
  - `GET /api/volunteer/evaluation?anakDidikId=&week=&type=&semester=&title=&subject=&tryoutNumber=` — gradebook.
  - `POST /api/volunteer/evaluation` — input baru. Validasi ketat per `type`.
  - `PUT/DELETE /api/volunteer/evaluation/[id]` — hanya untuk semester berjalan (`semester === currentSemester`); data semester lampau terkunci.
- **Catatan penting**: berbeda dari dokumen lama, **raport (Report Card) tidak di-generate di sisi relawan**. Relawan menginput nilai saja. Rekap final + format raport (Lampiran 1, 2, UAS breakdown) dikeluarkan oleh admin lewat `/admin/grades`.

### G. Pelaporan Kegiatan (`/reporting`)
- **Fungsi**: laporan absensi/kehadiran relawan ke Admin — berbeda dari raport anak didik.
- **Model**: `Report` (`reports`) — `relawanId`, `scheduleId`, `region`, `level`, `title`, `description`, `date`, `semester`, `photoUrl`, `location`.
- **API**:
  - `GET/POST /api/reports?page=&limit=&semester=` — list & create milik sendiri.
  - `PUT/DELETE /api/reports?id=...` — hanya semester berjalan.
  - `GET /api/reports/me?page=&limit=` — varian ringkas milik sendiri.

---

## 5. Alur STUDENT (`/student/*`)

Student adalah siswa SMA yang datang lewat SSO dari `gsb-web` untuk latihan SNBT.

### A. Proses Masuk (SSO)
- Halaman `/student?token=...` memverifikasi `LEGACY_JWT_SECRET`, set cookie `gsb_student_token`, lalu redirect ke `/student/dashboard`.

### B. Dashboard Student & Modul Belajar (`/student/dashboard`)
- **API**: `GET /api/student/modules` — hanya modul `category: "SNBT"`, dikelompokkan per `subCategory` (mis. Matematika, B. Indonesia, dst.).
- **Pola akses (desain target)**: "Bebas pilih topik dasar, linier di dalam topik". Modul dasar tiap topik terbuka, modul lanjut terbuka setelah lulus kuis (pakai field `prerequisiteModule`).

### C. Kuis Modul (`/student/quiz`)
- **Model**: `Quiz` (`quiz`) — `moduleId`, array soal (`question`, `options`, `correctAnswer`), `passingScore` (default 75).
- **Progress**: `UserProgress` (`progres_siswa`) — `externalUserId` (dari JWT legacy), `completedModules[]`, `quizScores[]`.
- **API**:
  - `GET /api/student/quiz?moduleId=...` — ambil soal (tanpa `correctAnswer`).
  - `POST /api/student/quiz` — kirim `{ moduleId, answers }`, BE hitung skor, simpan progress, dan kembalikan `{ score, passed, message }`.
  - `GET /api/student/progress` — ringkasan progress siswa (completed modules + riwayat kuis).

---

## 6. Ringkasan Model Database (`gsb_lms`)

| Model | Collection | Fungsi |
|-------|------------|--------|
| `Relawan` | `relawans` | Akun Admin (`ADMIN`) & Volunteer (`RELAWAN`) |
| `AnakDidik` | `anak_didik` | Data siswa GSB (offline) + profil raport |
| `Module` | `modul` | Modul OFFLINE (per fase+week) & SNBT (per subject), punya `prerequisiteModule` untuk linierisasi |
| `SubCategory` | `subcategories` | Sub-kategori modul (kelas SD/SMP, mapel SNBT) |
| `Schedule` | `jadwal` | Jadwal mengajar relawan (region+level+semester) + `kbmDates[]` untuk raport |
| `Report` | `reports` | Laporan kegiatan relawan (administratif) |
| `Attendance` | `absensi` | Absensi siswa per pekan & tanggal (HADIR/IZIN/SAKIT/ALFA/ASINKRONUS) |
| `NilaiOffline` | `nilai_offline` | Semua tipe nilai offline: TUGAS/UJIAN/KUIS/UTS/UAS/TRYOUT dengan rubrik komponen |
| `Quiz` | `quiz` | Soal kuis SNBT per modul |
| `UserProgress` | `progres_siswa` | Progress siswa SMA (completed modules + skor kuis) |
| `Settings` | `settings` | Key-value global: `activeSemester`, `availableSemesters`, `closedSemesters`, `availableLevels`, `availableRegions` |

---

## 7. Strategi Database (Shared Cluster)

- **Cluster**: 1 MongoDB Atlas, dua database terpisah secara logis.
- **Database**:
  - `gsb_main` — dipakai `gsb-web` (data utama, donasi, profil yayasan).
  - `gsb_lms` — dipakai repo ini (modul, kuis, laporan, nilai, absensi).
- **Interaksi**: `gsb-web` hanya boleh membaca data `gsb_lms` **via API** repo ini. `gsb-lms` **tidak pernah** menyentuh `gsb_main` secara langsung — integrasi dilakukan melalui kontrak JWT (SSO) dan, jika perlu, API internal `gsb-web`.
- **Koneksi**: cached di `global.mongoose` oleh `src/lib/mongodb.ts` supaya survive HMR di dev.

---

## 8. Cara Kerja Bareng FE & BE (Best Practice)

1. **Kontrak API adalah sumber kebenaran**: parameter query, tipe response, dan kode error di route handler (`src/app/api/**/route.ts`) adalah referensi utama. Dokumen ini ringkasannya saja.
2. **Semester context**: hampir semua fitur scoped ke `semester`. FE menyimpan pilihan user di `localStorage.activeSemester` dan men-sync dengan `GET /api/admin/settings.activeSemester`. BE menolak write di semester bukan aktif.
3. **Level & Region dari Settings**: jangan hard-code daftar fase/kota di FE — tarik dari `/api/admin/settings` (`availableLevels`, `availableRegions`).
4. **Role guard**:
   - UI: `AdminGuard` untuk route group `(admin)`.
   - API: semua route admin mengecek `session.role === "ADMIN"`; route volunteer cukup memastikan `getSessionUser()`; route student pakai `getStudentSession()`.
5. **CORS**: karena semua UI ada di repo ini, CORS tidak perlu untuk lalu lintas internal. Hanya relevan jika `gsb-web` memanggil API `gsb-lms` dari origin berbeda — saat itu tambahkan header CORS eksplisit di route yang ter-expose.
6. **Dev utilities**: `/api/dev/*` (seed, register-relawan, generate-jwt) hanya untuk development. Jangan biarkan aktif di production.

---

## 9. Referensi Format Rapor GSB (Desa GSB)

Sumber acuan: 8 contoh rapor `public/raport/*.pdf` (Fase Tunas, Pucuk, Pelita, A, B, C, D, E) — periode Agustus–Desember 2025. Ini adalah kontrak output yang harus bisa direproduksi oleh generator raport admin (`/admin/grades`).

### 9.1 Struktur Dokumen Rapor (seragam lintas fase)

1. **Cover** — `Nama`, `Fase + Kelas`, periode KBM, logo GSB.
2. **Profil Siswa** — Nama Lengkap, Jenis Kelamin, Tempat & Tanggal Lahir, Kelas/Fase, Asal Sekolah, Nomor WhatsApp, Alamat Domisili.
3. **Daftar Isi** — 4 bagian: Pengantar · Penilaian · Kehadiran · Lampiran.
4. **Quote** Ki Hajar Dewantara.
5. **Bagian 01 — Pengantar** — definisi Poin Konsep, Poin Kuis, Poin Sikap.
6. **Bagian 02 — Penilaian KBM & UAS** — total poin + predikat, tabel komponen, narasi kognitif + sikap, rekomendasi siswa + rekomendasi orang tua.
7. **Bagian 03 — Kehadiran** — rekap `Hadir / Izin / Sakit / Alpa` dari N kelas luring + narasi persentase + target semester berikutnya.
8. **Bagian 04 — Lampiran**
   - **L1. Materi & Dokumentasi** — baris per tanggal KBM (`tanggal · materi · link materi · link dokumentasi`).
   - **L2. Kehadiran & Penilaian KBM** — baris per tanggal (`tanggal · status · poin konsep · poin kuis · poin sikap`). UAS tidak ditampilkan di sini.
   - **L3. Penilaian Kognitif UAS Literasi** — rubrik per subject (skor siswa/maks).
   - **L4. Penilaian Afektif UAS Literasi** — rubrik per subject.
   - **L5. Penilaian UAS Bahasa Inggris** (Fase A ke atas) — rubrik per topik.

### 9.2 Komponen UAS per Fase (berbeda!)

Jenjang & komponen di bawah ini yang membuat generator raport **harus dinamis per fase** — tidak boleh hardcoded.

| Fase    | Jenjang           | Kognitif UAS Literasi                                   | Afektif UAS Literasi                            | UAS B. Inggris |
|---------|-------------------|---------------------------------------------------------|-------------------------------------------------|----------------|
| Tunas   | PAUD/TK           | Mengenal Angka · Huruf · Bentuk · Seni (25 pt each)     | Keberanian · Ekspresi Kreatif · Kemandirian     | —              |
| Pucuk   | PAUD/TK           | Mengenal Angka · Huruf · Bentuk · Seni (25 pt each)     | Keberanian · Ekspresi Kreatif · Kemandirian     | —              |
| Pelita  | 1 SD/MI           | Menyimak · Membaca · Menulis · Berbicara (25 pt each)   | Tanggung Jawab · Kemandirian · Ekspresi Kreatif | —              |
| A       | 2 SD/MI           | Numerasi 30 · Sains 35 · B. Indonesia 35                | Mandiri · Bernalar Kritis · Kreatif             | 100 pt         |
| B       | 3 SD/MI           | Numerasi · Sains · B. Indonesia                         | Mandiri · Bernalar Kritis · Kreatif             | 100 pt         |
| C       | 6 SD/MI           | Numerasi · Sains · B. Indonesia                         | Mandiri · Bernalar Kritis · Kreatif             | 100 pt         |
| D       | 9 SMP/MTs         | Numerasi 30 · Sains 40 · B. Indonesia 30                | Sikap Ilmiah · Rasa Ingin Tahu · Tanggung Jawab | 100 pt         |
| E       | 10 SMA/SMK/MAN    | Numerasi 30 · Sains 40 · B. Indonesia 30                | Ketekunan · Ketelitian · Tanggung Jawab         | 100 pt         |

Bobot poin **bisa berbeda per fase** (mis. Sains 35 di Fase A tapi 40 di Fase D/E). `maxScore` per komponen harus bisa dikonfigurasi, bukan konstanta kode.

### 9.3 Rumus Poin & Predikat

- **Total Poin Belajar** = `Nilai KBM (Konsep + Kuis + Sikap)` + `Nilai UAS Literasi (Kognitif + Afektif)` + `Nilai UAS B. Inggris` (bila ada).
- **Poin Maksimal** = jumlah max per komponen — bervariasi per fase (observed: Fase A–E & Pelita ≈ 4.370–4.470; Fase Pucuk ≈ 4.070 karena KBM max 3×1.300).
- **Persentase** = `Total Poin / Poin Maksimal × 100`.
- **Predikat** (observed di 8 sampel):
  - **A — Sangat Baik** (siswa tuntas dengan pencapaian tinggi, dapat mengaplikasikan konsep secara mandiri) — contoh 71% dan 89% → A.
  - **B — Baik** (tuntas dengan pemahaman baik, perlu bimbingan di beberapa bagian) — contoh 41%, 48% → B.
  - **C — Cukup Baik** (hampir tuntas, memahami materi dasar tapi perlu dukungan) — contoh 16% → C.
  - Threshold pasti belum ter-dokumentasi resmi. Asumsi kerja: `A ≥ 70%`, `40% ≤ B < 70%`, `C < 40%`. **Harus dikonfirmasi tim Edukasi sebelum di-hardcode.**

### 9.4 Narasi Kognitif/Sikap & Rekomendasi (3 tier)

Berdasarkan 8 sampel, narasi untuk Bagian 02 dan rekomendasi mengikuti pola tier — kemungkinan di-pilih berdasar predikat/persentase:

- **Tier Tinggi (A)** — "pemahaman mendalam", "antusiasme tinggi", rekomendasi "ambil tantangan lebih tinggi, jadi mentor kecil…".
- **Tier Menengah (B)** — "menguasai sebagian besar materi, kesulitan di soal analitis", rekomendasi "perkuat konsistensi, target mingguan…".
- **Tier Rendah (C)** — "memahami materi dasar cukup baik, kesulitan pada soal kompleks", rekomendasi "bangun kebiasaan bertahap, baca 10–15 menit/hari…".

Artinya generator butuh **template teks** per tier untuk: narasi kognitif, narasi sikap, rekomendasi siswa, rekomendasi ortu.

### 9.5 Gap Analysis — Status Implementasi

**Sudah siap di schema:**

- ✅ `AnakDidik` — profil siswa lengkap (gender, birthPlace, birthDate, schoolOrigin, phone, address, parentName).
- ✅ `Schedule.kbmDates[]` — Lampiran 1 (tanggal, topic, materialLink, documentationLink).
- ✅ `Attendance` — Bagian 03 + kolom status di Lampiran 2 (termasuk `ASINKRONUS`).
- ✅ `NilaiOffline` type=`TUGAS` dengan `scoreConcept` / `scoreQuiz` / `scoreAttitude` — Lampiran 2 poin KBM.
- ✅ Scoping `semester` di semua koleksi — rapor selalu per-semester.

**Status gap (1-8):**

1. ✅ **Subject UAS sudah longgar.** `NilaiOffline.subject` sekarang String bebas (uppercase, tanpa enum). Validasi format dasar di `POST /api/volunteer/evaluation` (`normalizeSubject`); whitelist per fase dilakukan via `faseConfig` di Settings.

2. ✅ **`rubricItems[]` sudah ada.** `NilaiOffline.rubricItems: [{ criterion, score, maxScore }]`. Validasi di `validateRubricItems` (`/api/volunteer/evaluation`). Dipakai di Lampiran 3–5.

3. ✅ **UAS B. Inggris pakai shape yang sama.** Tinggal isi `rubricItems` dengan topik (My Name, Number, Color, …).

4. ✅ **`availableLevels` default sudah lengkap** (`DISABILITAS, FASE TUNAS, FASE PUCUK, FASE PELITA, FASE A–E, SNBT`) di `src/app/api/admin/settings/route.ts`.

5. ✅ **`faseConfig` sudah di-seed** via `DEFAULT_FASE_CONFIG` (`src/lib/reportDefaults.ts`). Berisi 8 fase dengan komponen kognitif/afektif/B.Inggris + `maxScore` per komponen. Settings key: `faseConfig`.
   - **Catatan:** belum ada UI admin untuk meng-override. Untuk sementara edit langsung via `POST /api/admin/settings` body `{ faseConfig: {…} }` atau patch file defaults.

6. ✅ **`reportRubric` sudah di-seed** via `DEFAULT_REPORT_RUBRIC`. Berisi predikat A/B/C (threshold 70/40/0) + narasi 3 tier (kognitif, sikap, rekomendasi siswa, rekomendasi ortu) + teks kehadiran. Settings key: `reportRubric`.
   - **Catatan:** threshold masih asumsi kerja — perlu konfirmasi tim Edukasi sebelum final.

7. ✅ **`GET /api/admin/grades` sudah di-refactor.** Logic agregasi dipindah ke `src/lib/reportAggregator.ts` (`aggregateReports()`) supaya dipakai ulang oleh endpoint PDF. Payload sekarang berisi `penilaian` (komponen per grup, predikat, narasi tier), `kehadiran` (hadirPct, target, narasi), `faseConfig`. Backward-compat shim tetap pertahankan `weeklyGrades` (record) + `summary.finalScore` + `uasScore` untuk UI lama.

8. ✅ **Generator PDF sudah ada.** Pakai `@react-pdf/renderer` (`dependency sudah didaftar di package.json; jalankan `bun install`).
   - Template: `src/lib/pdf/ReportTemplate.tsx` — mereplikasi struktur rapor (Cover, Profil, Pengantar, Penilaian, Kehadiran, Lampiran 1–5). Palet memakai brand GSB (green/orange/sand).
   - Endpoint: `GET /api/admin/grades/pdf?studentId=…&semester=…` → return `application/pdf` (streaming).
   - UI: tombol **📥 Unduh PDF** di modal `/admin/grades`. Cetak Preview (HTML lama) tetap ada untuk kompatibilitas.

### 9.6 Sisa Pekerjaan (Backlog)

Langkah implementasi inti roadmap sudah tuntas. Yang masih open:

1. `bun install` untuk mengunduh `@react-pdf/renderer` (belum dijalankan karena sesi CLI terbatas).
2. UI admin untuk meng-edit `faseConfig` & `reportRubric` secara visual (sekarang masih lewat default/`POST /api/admin/settings`).
3. Konfirmasi tim Edukasi: threshold predikat A≥70%, B≥40%, C<40% (asumsi kerja).
4. Tes end-to-end generate PDF dengan data nyata 1 siswa per fase — verifikasi kecocokan visual dengan `public/raport/*.pdf`.
5. Migrasi UI modal preview `/admin/grades/page.tsx` ke shape baru (`penilaian.*`) untuk hilangkan ketergantungan pada legacy shim.

---

## 10. Catatan Perubahan vs Dokumen Lama

Revisi dari `SYSTEM_FLOW.md` sebelumnya:

- ✏️ **Relawan boleh punya banyak jadwal** (region+level) per semester; batasan 1:1 sudah tidak berlaku.
- ➕ **Sistem Absensi** (`Attendance`, halaman `/attendance` & `/attendance/recap`, status `ASINKRONUS`) ditambahkan — sebelumnya tidak disebut.
- ➕ **Rubrik penilaian** TUGAS dengan 3 sub-skor (Konsep/Kuis/Sikap), UAS per-subject dengan `maxScore`, TRYOUT SNBT dengan `tryoutNumber` — sebelumnya hanya deskripsi umum.
- ➕ **Generator raport** berpindah ke admin (`/admin/grades`) — relawan hanya input nilai.
- ➕ **Kategori Modul** (`/admin/categories`) dan **Wilayah & Fase** (`/admin/levels`) sebagai halaman admin tersendiri.
- ➕ **Kuis AI** via Gemini di admin.
- ✏️ **Jenjang default** sekarang pakai nomenklatur fase (`DISABILITAS`, `FASE PUCUK`, `FASE A`–`E`, `SNBT`), bukan SD/SMP/SMA. Mapping SD/SMP ke sub-kategori kelas tetap dipertahankan untuk backward compat di endpoint modul volunteer.
- ✏️ **Admin UI** sudah terintegrasi di repo ini (`/admin/*`) dan tidak lagi di `gsb-web`.
- 🔧 **Semester closing**: semester yang ada di `closedSemesters` tidak dapat menerima write (nilai/laporan) dari relawan.
