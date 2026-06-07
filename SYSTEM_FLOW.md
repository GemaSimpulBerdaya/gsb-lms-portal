# Panduan Alur Sistem GSB LMS (Untuk Frontend & Backend)

Dokumen ini menjelaskan alur sistem dari ujung ke ujung (end-to-end) pada platform GSB LMS, peran setiap user, model data, dan kontrak API yang sudah diimplementasikan.

> Referensi cepat: `AGENTS.md` untuk perintah build/lint, variabel env, dan konvensi proyek.

---

## 1. Peran Pengguna (Roles)

Sistem mendukung empat kategori akses utama. Semua UI berada di repo ini (`gsb-lms-portal`) — tidak ada lagi pemisahan repo admin.

1. **Super Admin** (`role: "ADMIN"`) — pengelola pusat operasional akademik. Mengakses portal `/admin/*`.
2. **Akun Tim Lokasi** (`role: "TIM_LOKASI"`, legacy `role: "RELAWAN"`/`"TIM_PEKAN_1" ... "TIM_PEKAN_4"`) — pelaksana lapangan. Mengakses portal volunteer di `/dashboard`, `/schedule`, `/students-data`, `/attendance`, `/evaluation`, `/reporting`. Satu akun Tim Lokasi selalu scoped ke satu Lokasi Belajar.
3. **Tim Akademik** (`role: "TIM_AKADEMIK"`) — tim akademik global lintas lokasi. Mengakses area akademik admin yang diizinkan, terutama pengelolaan modul/materi.
4. **Student / Siswa SMA** (`role: "SMA"` dari token legacy) — peserta didik yang masuk via **SSO** dari aplikasi `gsb-web`. Diarahkan ke `/student/dashboard`.

Akun Admin, Tim Lokasi, Tim Akademik, dan legacy Relawan sama-sama disimpan di koleksi `volunteers` dan dibedakan oleh field `role`.

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
- **Handler** (`src/app/student/page.tsx`): memanggil `verifySsoJWT(token)` dengan `SSO_JWT_SECRET`. Token harus punya `role: "STUDENT"`.
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
- **Model**: disimpan di koleksi `settings` sebagai key-value: `availableSemesters` (list), `activeSemester` (string), `closedSemesters` (list), dan `semesterLabels` (objek key→label untuk override nama semester).
- **API**: `GET /api/admin/semesters` (list + stats per semester: schedules/reports/modules), `GET & POST /api/admin/settings` untuk mengubah daftar/status/label.
- **Tampilan Dinamis**: Semua halaman menggunakan helper `formatSemester` yang memprioritaskan label kustom dari `semesterLabels` sebelum melakukan *fallback* ke penamaan default (Januari - Juni YYYY / Juli - Desember YYYY). Hal ini memungkinkan Admin mengganti nama semester secara langsung dari panel admin tanpa menyentuh kode.
- **Semantic**: Semester aktif menjadi konteks global. Semester pada `closedSemesters` dianggap terkunci — route volunteer (`/api/reports`, `/api/volunteer/evaluation`) memeriksa semester saat write dan menolak perubahan jika `semester !== currentSemester`.

### C. Wilayah & Fase (`/admin/levels`)
- **Fungsi**: mengelola daftar wilayah (kota) dan jenjang pendidikan (fase) yang dipakai di seluruh sistem.
- **Penyimpanan**: key `availableRegions` dan `faseConfig` di koleksi `settings`. Daftar `availableLevels` untuk dropdown kini didapatkan secara dinamis dari kunci objek `faseConfig` (`Object.keys(faseConfig)`) untuk mencegah redundansi konfigurasi.
- **Batasan**: Kelas `SNBT` adalah kelas online-only, sehingga diexclude (dikecualikan) dari daftar jenjang saat membuat jadwal KBM luring/offline di menu volunteer.
- **API**: `GET/POST /api/admin/settings`.

### D. Kategori Modul (`/admin/categories`)
- **Fungsi**: CRUD sub-kategori/jenis kelas & mata pelajaran untuk modul (misal: "Kelas 3", "Biologi").
- **Model**: `SubCategory` (`subcategories`) dengan field `name`, `type: "SNBT" | "OFFLINE"`, `parentLabel`, `order`.
- **API**: `GET/POST/PUT/DELETE /api/admin/subcategories`.

### E. Manajemen Akun Tim (`/admin/volunteers`)
- **Konsep**: 1 akun = 1 TIM (bukan 1 orang). 1 tim punya beberapa anggota dari registry individu.
- **Tim Lokasi**: tiap Lokasi Belajar punya maksimal 1 akun reguler `TIM_LOKASI`. Kombinasi `role: "TIM_LOKASI" + region` wajib unik. Contoh valid: `Tim Offline Depok` dan `Tim Online Reguler`; contoh invalid: dua akun `TIM_LOKASI` untuk `Offline Depok`.
- **Tim Akademik**: `TIM_AKADEMIK` bersifat global lintas lokasi. Field `region` dikosongkan/tidak dipakai. Tim ini dipakai untuk area akademik seperti upload/kelola modul, bukan untuk jadwal lapangan mingguan.
- **Role anggota**:
  - Tim Lokasi: `FASILITATOR`, `PENGAJAR`, `DOKUMENTASI`.
  - Tim Akademik: `AKADEMIK`.
- **Fungsi**: CRUD akun tim + hashing password, kelola anggota tim (add/remove/change role/transfer antar tim). Saat tambah/edit akun tim, admin bisa langsung memilih anggota agar akun tidak lahir kosong.
- **API**:
  - `GET /api/admin/volunteers` — list akun tim, enriched dengan `memberDetails: [{volunteerId, name, isActive, role, joinedAt}]`.
  - `POST /api/admin/volunteers` — buat akun tim baru. Untuk Tim Lokasi, `region` wajib dan kombinasi `TIM_LOKASI + region` dicek unik.
  - `PATCH /api/admin/volunteers/[id]` — update field akun (teamName, region, name, email, password opsional). Validasi unik `TIM_LOKASI + region` juga berlaku saat edit Tim Lokasi.
  - `DELETE /api/admin/volunteers/[id]` — hapus akun. Members[] hilang, registry tidak disentuh.
  - `GET/POST/PATCH/DELETE /api/admin/volunteers/[id]/members` — CRUD anggota tim. POST handle pindah tim: kalau orang sudah di tim lain, server kembalikan `409 TRANSFER_REQUIRED` dengan detail; client harus retry dengan `transferFromTeamId` sebagai konfirmasi.
- **Model**: `Relawan` (`volunteers`) — `email`, `password` (hashed), `teamName`, `region`, `name` (legacy), `role`, **`members: [{volunteerId, role: "FASILITATOR"|"PENGAJAR"|"DOKUMENTASI"|"AKADEMIK", joinedAt}]`**.
- **UI**: tabel akun tim dengan filter search, Lokasi Belajar, Jenis Akun, dan status anggota. Kolom "Anggota" menampilkan preview chip max 3 + counter, dot warna per role. Modal tambah/edit akun tim punya builder anggota. Tombol "Anggota" membuka modal kelola anggota dengan daftar kandidat langsung, quick filter, transfer detection, dan role per slot.

### E2. Registry Relawan (`/admin/volunteer-registry`) — BARU
- **Fungsi**: registry orang lintas tim. Beda dari Akun Tim, ini track INDIVIDU (1 orang = 1 record), supaya pindah tim tidak perlu rename atau buat akun baru, dan reporting lifetime per orang bisa dilakukan.
- **API**: `GET & POST /api/admin/volunteer-registry`, `GET/PATCH/DELETE /api/admin/volunteer-registry/[id]`.
- **Model**: `Volunteer` (`volunteer_registry`) — `name`, `phone?`, `email?` (sparse unique), `joinedYear?`, `isActive`, `notes?`.
- **Soft delete**: DELETE default-nya set `isActive=false` + cabut dari semua tim. Hard delete via `?force=true` hanya kalau tidak ada record `TeamAttendance` yang refer ke orang ini.

### E3. Kehadiran Tim (`/admin/team-attendance`)
- **Fungsi**: monitoring kehadiran anggota tim per pertemuan. Filter (semester/tim/pekan/range tanggal) + 5 stats card + tabel records dengan badge anomali + drawer audit detail.
- **API**:
  - `GET /api/admin/team-attendance?semester=&teamId=&volunteerId=&week=&from=&to=` — list records enriched dengan team/volunteer/anomaly metadata.
  - `PATCH /api/admin/team-attendance` body `{recordId, status?, notes?}` — admin override edit. Push `editHistory` + set `unlockedByAdmin=true`.
  - `POST /api/admin/team-attendance/unlock` body `{teamId, scheduleId, week}` — buka kunci pertemuan supaya facilitator bisa edit walau di luar window.
- **Model**: `TeamAttendance` (`team_attendances`) — `relawanId`, `scheduleId`, `week`, `semester`, `date`, `volunteerId`, `role`, `status: "HADIR"|"IZIN"|"SAKIT"|"ALFA"`, `notes`, **audit fields**: `markedBy`, `markedAt`, `markedFromIp`, `userAgent`, `editHistory[]`, `unlockedByAdmin`. Compound unique `(volunteerId, scheduleId, week, date)`.
- **Kontrol integritas** (server-enforced di `POST /api/volunteer/team-attendance`):
  - **Time window**: input sebelum window dibuka (`kbmDate -30min`) ditolak. Input telat setelah `kbmDate +24h` tetap boleh, tetapi ditandai sebagai `lateInput` untuk monitoring admin.
  - **Audit log**: `markedBy` (akun tim), `markedAt`, IP (X-Forwarded-For pertama, max 45 char), userAgent (max 200 char). Tiap edit push entry ke `editHistory` sebelum field di-update.
  - **Dokumentasi KBM**: `photoUploaded` tetap dihitung dari `Report.photoUrl`/`photoUrls`, tetapi tidak lagi memblokir simpan presensi tim.
- **Override**: admin bisa unlock per-pertemuan (set `unlockedByAdmin=true` di semua record pertemuan itu) atau edit langsung via PATCH (push history + set unlocked).

### F. Manajemen Database Anak Didik (`/admin/students`)
- **Fungsi**: CRUD anak didik, termasuk **impor massal dari Excel** dan data profil lengkap (gender, birthPlace, schoolOrigin, dll. — dipakai untuk raport).
- **API**: `GET & POST /api/admin/students`, `POST /api/admin/students/bulk` (insert banyak), `POST /api/admin/students/bulk-delete`, `PUT/DELETE /api/admin/students/[id]`.
- **Model**: `AnakDidik` (`students`) — core identity (`name`, `region`, `fase`, `parentName`), data Excel (`studentCode`, `kodeKelas`, `pic`), dan data raport (`gender`, `birthPlace`, `birthDate`, `schoolOrigin`, `phone`, `address`).

### G. Manajemen Modul & Kuis (`/admin/modules`)
- **Fungsi**: CRUD modul (OFFLINE dan SNBT) + upload file ke cloud + editor kuis manual.
- **Upload File Cloud (UploadThing)**: Menggantikan sistem penyimpanan lokal `public/uploads/modules`. Semua file modul diunggah langsung ke cloud menggunakan **UploadThing** melalui rute API `/api/uploadthing` (menggunakan `UPLOADTHING_TOKEN`). 
  - Validasi ukuran file (maksimal 16MB untuk dokumen/PDF, 8MB untuk gambar).
  - Hak akses dibatasi untuk `ADMIN` dan `TIM_AKADEMIK`. Tim Akademik bersifat global sehingga dapat mengelola modul/materi lintas lokasi belajar.
- **API**:
  - `GET & POST /api/admin/modules` — daftar modul + flag `hasQuiz`.
  - `PUT/DELETE /api/admin/modules/[id]`.
  - `/api/uploadthing` — endpoint untuk upload file (menghasilkan URL aman di cloud).
  - `GET/POST /api/admin/quiz/[moduleId]` — baca/simpan kuis manual.
  - Endpoint generate AI quiz lama sudah dihapus; kuis dikelola manual lewat `QuizModal`.
- **Model**: `Module` (`modules`) — `title`, `slug`, `description`, `programType: "SNBT" | "OFFLINE"`, `fase`, `subject`, `week` (untuk OFFLINE), `fileUrl` (URL dari UploadThing), `order`, `semester`, `prerequisiteModule` (ref ke Module lain — membentuk rantai linier per topik SNBT).

### H. Audit Laporan Kegiatan (`/admin/reports`)
- **Fungsi**: verifikasi dokumentasi kegiatan relawan.
- **API**: `GET /api/admin/reports?page=&limit=&semester=&relawanId=` — populate `relawanId` (nama + email), pagination.

### I. Rekap Nilai & Raport (`/admin/grades`)
- **Fungsi**: melihat dan men-generate raport akhir semester untuk semua anak didik.
- **API**: `GET /api/admin/grades?semester=&region=&level=`. Parameter `level` masih dipakai sebagai alias query untuk `fase` di agregator rapor.
- **Komposit**: API ini menggabungkan 3 sumber data per siswa:
  1. **`NilaiOffline`** — TUGAS mingguan (3 skor: Konsep/Kuis/Sikap) dan UAS per subject.
  2. **`Attendance`** — rekap HADIR/IZIN/SAKIT/ALFA/ASINKRONUS untuk Lampiran 2 raport.
  3. **`Schedule.kbmDates`** — daftar tanggal KBM + topik + link dokumentasi untuk Lampiran 1.
- **Output**: payload siap cetak (profile, weeklyGrades, UAS breakdown per grup, tryouts, kbmDates, attendanceSummary, summary total). Ini adalah sumber resmi raport — relawan tidak men-generate PDF sendiri.

---

## 4. Alur RELAWAN (`/dashboard`, `/schedule`, …)

Relawan mengelola KBM-nya sendiri: profil mengajar, anak didik, absensi, nilai, dan laporan.

### A. Dashboard Relawan (`/dashboard`)
- **API**:
  - `GET /api/volunteer/dashboard` — profil relawan + total laporan + laporan bulan ini + 3 laporan terakhir.
  - `GET /api/volunteer/dashboard/stats?semester=...` — total jadwal, laporan, anak didik (dihitung dari kombinasi region+fase pada semua Schedule relawan), beserta 5 jadwal terakhir.

### B. Jadwal Mengajar (`/schedule`)
- **Fungsi**: akun Tim Lokasi mengelola daftar jadwal mengajarnya. **Satu akun tim boleh punya beberapa kombinasi `fase + semester`**, tetapi `region` jadwal dikunci dari `region` akun Tim Lokasi dan tidak dipercaya dari client.
- **Model**: `Schedule` (`schedules`) — `relawanId`, `region`, `fase`, `semester`, `activeWeek`, dan `kbmDates[]` (tanggal KBM, topik/mata pelajaran, link materi, link dokumentasi, **`petugas[]`/Tim Bertugas per pekan**).
- **Pekan Aktif Dinamis (`activeWeek`)**: Tidak lagi diatur manual. Sistem secara otomatis menghitung `activeWeek` berdasarkan `kbmDates` dan hari ini (yaitu pertemuan terakhir dengan tanggal `<= hari ini`).
- **Auto-Generator Pertemuan**: Saat membuat atau mengedit jadwal, volunteer dapat menggunakan fitur **generator otomatis** dengan mengirimkan payload `generate` berisi `startDate` (tanggal KBM ke-1), `count` (jumlah pertemuan), `intervalDays` (default 7 hari), dan `skipDates` (daftar tanggal libur/dilewati). Sistem akan otomatis menghitung semua tanggal KBM dan menyusun array `kbmDates`.
- **API**: `GET/POST/PUT/DELETE /api/volunteer/schedule`.
  - Menghasilkan respon berisi data schedule yang diperkaya dengan **`completionByWeek`** per pekan (mengindikasikan apakah Presensi, Nilai Tugas, dan Laporan Dokumentasi sudah diisi atau belum pada pekan tersebut).
  - Duplikasi (kombinasi `region + fase + semester` sama) ditolak dengan 400.
- **Tim Bertugas per Pekan**: saat membuat/mengedit jadwal, tiap `kbmDates[]` dapat memilih anggota yang bertugas pada pekan tersebut. UI menampilkan chip nama + role (mis. Fasilitator/Pengajar/Dokumentasi). Presensi tim mengikuti daftar Tim Bertugas pada pertemuan itu.
- **FE (Timeline Windowing & Picker UX)**: Halaman `/schedule` menyajikan antarmuka visual linier berupa timeline pertemuan mingguan yang interaktif, dilengkapi visualisasi penyelesaian data per pekan (checklist kehadiran, tugas, dokumentasi), tampilan Tim Bertugas per pertemuan, serta UI *meeting picker* kustom untuk mengubah jadwal/reschedule per tanggal dengan mudah.

### C. Modul Pembelajaran (dipanggil dari `/schedule`)
- **API**: `GET /api/volunteer/modules?fase=<FASE>&week=<N>&semester=<S>`.
  - Hanya modul `programType: "OFFLINE"`.
  - Filter fase memakai `faseConfig` dari Settings. Query `level` masih diterima sebagai alias legacy untuk backward compat.
  - Jika `week` tidak diberikan, response berisi modul yang sudah dikelompokkan per minggu.
  - Menyertakan `fileUrl` agar relawan bisa **download materi untuk mengajar offline**.

### D. Manajemen Anak Didik (`/students-data`)
- **FE**: filter Wilayah (region) + Fase (`fase`) → tabel rekapitulasi nama anak didik.
- **API**: `GET /api/volunteer/students?region=X&fase=Y` dan `GET /api/volunteer/students/all` (daftar lengkap tanpa filter). Query `level` masih diterima sebagai alias legacy.
- Catatan: matching region/fase case-insensitive; `fase` divalidasi terhadap `faseConfig`.

### E. Absensi Siswa (`/attendance` & `/attendance/recap`)
Fitur ini **tidak tercantum di dokumen lama** — sudah aktif di sistem saat ini.
- **Model**: `Attendance` (`attendances`) — `relawanId`, `scheduleId`, `anakDidikId`, `week`, `semester`, `date`, `status: "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS"`, `notes`.
  - `ASINKRONUS` = kelas dilakukan asinkron (tidak dihitung sebagai absensi tatap muka).
- **Scope utama**: presensi siswa sekarang mengikat ke `scheduleId` dan pertemuan (`week + date`) dari `Schedule.kbmDates`. `region/fase` diturunkan dari schedule, bukan dipercaya dari client. Data lama tanpa `scheduleId` masih bisa terbaca sebagai fallback dan akan terisi saat disimpan ulang.
- **API**:
  - `GET /api/volunteer/attendance?scheduleId=&week=&date=` — daftar siswa schedule + status absensi yang sudah ada.
  - `POST /api/volunteer/attendance` body `{scheduleId, week, date, attendances}` — bulk upsert (`scheduleId + week + date + anakDidikId` sebagai kunci).
  - `GET /api/volunteer/attendance/recap?scheduleId=&week=&date=` — ringkasan per jadwal/pertemuan.
- **FE**:
  - `/attendance` — form input per jadwal (memakai Schedule.activeWeek). Di atas tabel siswa juga ada `<TeamAttendanceBlock>` (lihat E2 di bawah).
  - `/attendance/recap` — riwayat absensi.

### E2. Kehadiran Tim Relawan (`/team-attendance` dan `<TeamAttendanceBlock>`)
PIC-led flow untuk facilitator centang kehadiran anggota tim per pertemuan.
- **API**:
  - `GET /api/volunteer/team-attendance?scheduleId=&week=` — preview state: window status, `photoUploaded` flag, **members yang bertugas di `Schedule.kbmDates[week].petugas`** (fallback ke semua anggota tim untuk jadwal lama), records existing.
  - `POST /api/volunteer/team-attendance` body `{scheduleId, week, members: [{volunteerId, role, status, notes?}]}` — bulk upsert. Server validate kepemilikan schedule, anggota memang bertugas pada pertemuan itu, time window sebelum mulai, dan audit metadata. Idempotent: kalau sudah ada record, di-update + push editHistory.
- **UX flow**:
  1. Facilitator pilih schedule + pertemuan di filter di atas
  2. Block tim auto-load: header status (Window terbuka / Belum dibuka / Terkunci / Diunlock admin), notice strip kalau foto belum diupload atau window tertutup
  3. Default semua status `HADIR` — facilitator ubah yang absen saja, isi notes opsional
  4. Klik Simpan: dokumentasi KBM tidak memblokir simpan. Jika belum ada foto, UI hanya menampilkan notice agar dokumentasi dilengkapi terpisah.
- **Model**: `TeamAttendance` — lihat detail di §3.E3 (admin reporting).

### F. Evaluasi & Data Nilai (`/evaluation`)
- **Model**: `NilaiOffline` (`offline_grades`) — satu koleksi mencakup **semua jenis penilaian**:
  - `type`: `TUGAS` (KBM pekanan, punya 3 sub-skor: `scoreConcept`, `scoreQuiz`, `scoreAttitude`, skor akhir = rata-rata) atau `UAS`.
  - `UAS` wajib membawa `subject` ∈ {`NUMERASI`, `SAINS`, `BINDO`, `BING`, `MANDIRI`, `BERNALAR_KRITIS`, `KREATIF`} dan `maxScore` (karena rubrik per komponen berbeda, mis. 30/20/15).
- **API**:
  - `GET /api/volunteer/evaluation?anakDidikId=&week=&type=&semester=&title=&subject=&tryoutNumber=` — gradebook.
  - `POST /api/volunteer/evaluation` — input baru. Validasi ketat per `type`.
  - `PUT/DELETE /api/volunteer/evaluation/[id]` — hanya untuk semester berjalan (`semester === currentSemester`); data semester lampau terkunci.
- **Catatan penting**: berbeda dari dokumen lama, **raport (Report Card) tidak di-generate di sisi relawan**. Relawan menginput nilai saja. Rekap final + format raport (Lampiran 1, 2, UAS breakdown) dikeluarkan oleh admin lewat `/admin/grades`.

### G. Pelaporan Kegiatan (`/reporting`)
- **Fungsi**: laporan absensi/kehadiran relawan ke Admin — berbeda dari raport anak didik.
- **Upload Dokumentasi Cloud (UploadThing)**: Foto dokumentasi KBM tidak lagi diunggah secara lokal. Volunteer mengunggah file langsung ke **UploadThing** via rute `/api/uploadthing` dengan endpoint `reportPhoto` (maksimal 4MB per file, mendukung hingga 6 file sekaligus). URL cloud aman (`ufsUrl`) disimpan di field `photoUrl` (atau `photoUrls`).
- **Penyaringan Semester Dinamis**: Halaman laporan menggunakan `formatSemester` dan `semesterLabels` untuk menyaring laporan berdasarkan label semester kustom yang ditentukan admin.
- **Model**: `Report` (`reports`) — `relawanId`, `scheduleId`, `region`, `fase`, `title`, `description`, `date`, `semester`, `photoUrl`/`photoUrls` (URL dari UploadThing), `location`.
- **API**:
  - `GET/POST /api/reports?page=&limit=&semester=` — list & create milik sendiri.
  - `PUT/DELETE /api/reports?id=...` — hanya semester berjalan.
  - `GET /api/reports/me?page=&limit=` — varian ringkas milik sendiri.

---

## 5. Alur STUDENT (`/student/*`)

Student adalah siswa SMA yang datang lewat SSO dari `gsb-web` untuk latihan SNBT.

### A. Proses Masuk (SSO)
- Halaman `/student?token=...` memverifikasi `SSO_JWT_SECRET`, set cookie `gsb_student_token`, lalu redirect ke `/student/dashboard`.

### B. Dashboard Student & Modul Belajar (`/student/dashboard`)
- **API**: `GET /api/student/modules` — hanya modul `programType: "SNBT"`, dikelompokkan per `subject` (mis. Matematika, B. Indonesia, dst.).
- **Pola akses (desain target)**: "Bebas pilih topik dasar, linier di dalam topik". Modul dasar tiap topik terbuka, modul lanjut terbuka setelah lulus kuis (pakai field `prerequisiteModule`).

### C. Kuis Modul (`/student/quiz`)
- **Model**: `Quiz` (`quizzes`) — `moduleId`, array soal (`question`, `options`, `correctAnswer`), `passingScore` (default 75).
- **Progress**: `UserProgress` (`student_progress`) — `externalUserId` (dari JWT legacy), `completedModules[]`, `quizScores[]`.
- **API**:
  - `GET /api/student/quiz?moduleId=...` — ambil soal (tanpa `correctAnswer`).
  - `POST /api/student/quiz` — kirim `{ moduleId, answers }`, BE hitung skor, simpan progress, dan kembalikan `{ score, passed, message }`.
  - `GET /api/student/progress` — ringkasan progress siswa (completed modules + riwayat kuis).

---

## 6. Ringkasan Model Database (`gsb_lms`)

| Model | Collection | Fungsi |
|-------|------------|--------|
| `Relawan` | `volunteers` | Akun Admin (`ADMIN`), Tim Lokasi (`TIM_LOKASI`), Tim Akademik (`TIM_AKADEMIK`), dan legacy `RELAWAN`/`TIM_PEKAN_1..4`. 1 akun tim punya `members[]` ke registry. |
| `Volunteer` | `volunteer_registry` | Registry orang individu lintas tim (BARU). Reference target dari `Relawan.members[].volunteerId` & `TeamAttendance.volunteerId`. |
| `AnakDidik` | `students` | Data siswa GSB (offline) + profil raport |
| `Module` | `modules` | Modul OFFLINE (per fase+week) & SNBT (per subject), punya `prerequisiteModule` untuk linierisasi |
| `SubCategory` | `subcategories` | Sub-kategori modul (kelas SD/SMP, mapel SNBT) |
| `Schedule` | `schedules` | Jadwal mengajar tim (region+fase+semester) + `kbmDates[]` untuk raport dan Tim Bertugas per pekan |
| `Report` | `reports` | Laporan kegiatan relawan (administratif) — sekaligus jadi bukti L2 anti-fraud kehadiran tim |
| `Attendance` | `attendances` | Absensi siswa per `scheduleId` + pekan + tanggal (HADIR/IZIN/SAKIT/ALFA/ASINKRONUS) |
| `TeamAttendance` | `team_attendances` | Kehadiran anggota tim per pertemuan. Audit log lengkap (markedBy/At/Ip/UA + editHistory); dokumentasi KBM hanya indikator, bukan gate simpan. |
| `NilaiOffline` | `offline_grades` | Nilai offline: TUGAS dan UAS dengan rubrik komponen |
| `Quiz` | `quizzes` | Soal kuis SNBT per modul |
| `UserProgress` | `student_progress` | Progress siswa SMA (completed modules + skor kuis) |
| `Settings` | `settings` | Key-value global: `activeSemester`, `availableSemesters`, `closedSemesters`, `availableRegions`, `semesterLabels`, `faseConfig` |

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
3. **Level & Region dari Settings**: jangan hard-code daftar fase/kota di FE — tarik dari `/api/admin/settings` (`availableLevels` yang didapatkan dinamis dari `faseConfig` keys, dan `availableRegions`).
4. **Role guard**:
   - UI: `AdminGuard` untuk route group `(admin)`.
   - API: route admin penuh mengecek `ADMIN`; route akademik tertentu menerima `TIM_AKADEMIK`; route volunteer menerima `TIM_LOKASI` dan legacy `RELAWAN`/`TIM_PEKAN_1..4`; route student pakai `getStudentSession()`.
5. **CORS**: karena semua UI ada di repo ini, CORS tidak perlu untuk lalu lintas internal. Hanya relevan jika `gsb-web` memanggil API `gsb-lms` dari origin berbeda — saat itu tambahkan header CORS eksplisit di route yang ter-expose.
6. **Dev utilities**: `/api/dev/*` (seed, register-relawan, generate-jwt) hanya untuk development dan mengembalikan `404` saat `NODE_ENV=production`.

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

- ✏️ **Relawan boleh punya banyak jadwal** (region+fase) per semester; batasan 1:1 sudah tidak berlaku.
- ➕ **Sistem Absensi** (`Attendance`, halaman `/attendance` & `/attendance/recap`, status `ASINKRONUS`) ditambahkan — sebelumnya tidak disebut.
- ➕ **Rubrik penilaian** TUGAS dengan 3 sub-skor (Konsep/Kuis/Sikap) dan UAS per-subject dengan `maxScore` — sebelumnya hanya deskripsi umum.
- ➕ **Generator raport** berpindah ke admin (`/admin/grades`) — relawan hanya input nilai.
- ➕ **Kategori Modul** (`/admin/categories`) dan **Wilayah & Fase** (`/admin/levels`) sebagai halaman admin tersendiri.
- ➕ **Kuis AI** via Gemini di admin.
- ✏️ **Jenjang default** sekarang pakai nomenklatur fase (`DISABILITAS`, `FASE PUCUK`, `FASE A`–`E`, `SNBT`), bukan SD/SMP/SMA. Mapping SD/SMP ke sub-kategori kelas tetap dipertahankan untuk backward compat di endpoint modul volunteer.
- ✏️ **Admin UI** sudah terintegrasi di repo ini (`/admin/*`) dan tidak lagi di `gsb-web`.
- 🔧 **Semester closing**: semester yang ada di `closedSemesters` tidak dapat menerima write (nilai/laporan) dari relawan.
- ➕ **Migrasi Cloud Upload (UploadThing)**: Menggantikan folder penyimpanan lokal `public/uploads` dengan integrasi cloud storage UploadThing untuk foto KBM (`reportPhoto`), modul (`moduleFile`), dan portofolio siswa (`portfolioFile`).
- ➕ **Generator Pertemuan KBM & activeWeek Dinamis**: Volunteer sekarang dapat men-generate seluruh jadwal pertemuan semester (`kbmDates`) secara otomatis (dengan filter libur/skipDates). `activeWeek` dihitung dinamis berdasarkan hari H pertemuan.
- ➕ **Label Semester Dinamis**: Dukungan kustomisasi nama tampilan semester secara visual via admin panel (`semesterLabels` di Settings) yang otomatis tersinkron ke semua halaman via helper `formatSemester`.
- ➕ **Konsep Tim Multi-Anggota** (Mei 2026): Akun relawan berubah dari "1 akun = 1 orang" menjadi "1 akun = 1 TIM" dengan sub-document `members[]` yang refer ke `Volunteer` registry. Role anggota Tim Lokasi: FASILITATOR/PENGAJAR/DOKUMENTASI. Role anggota Tim Akademik: AKADEMIK. Lihat §3.E, §3.E2, §3.E3, §4.E2.
- ➕ **Tim Lokasi & Tim Akademik Global**: `TIM_LOKASI` adalah satu akun per Lokasi Belajar dan unik per `region`; `TIM_AKADEMIK` bersifat global lintas lokasi, `region` kosong, dan bisa mengelola modul/materi lintas lokasi. Legacy `TIM_PEKAN_1..4` sudah dimigrasi menjadi `TIM_LOKASI`.
- ➕ **Kehadiran Tim + Audit**: Model `TeamAttendance` dengan audit log lengkap. Validasi: schedule ownership, anggota memang bertugas pada pertemuan, block input terlalu awal, late input ditandai. Foto/dokumentasi KBM tidak lagi menjadi syarat simpan presensi tim.
- ➕ **Presensi Siswa Berbasis Schedule**: `Attendance` sekarang scoped ke `scheduleId + week + date`, bukan hanya relawan/region/fase. Ini menjaga presensi tetap mengikuti jadwal aktual mingguan.
- 🔧 **Hapus AI Quiz** (Gemini): Endpoint `/api/admin/generate-quiz` & `/api/admin/quiz/generate` dihapus. QuizModal jadi manual editor lengkap.
- 🔧 **Shared admin modal shell** (`AdminModal` + `FormField`): 4 modal admin (Module/Student/Volunteer/Quiz) migrasi ke palette dark slate + accent oranye GSB.

---

## 11. Migrasi Data — Akun Tim & Registry Relawan

Setelah deploy konsep tim multi-anggota, data lama (akun `Relawan` dengan field `name`) perlu dimigrasi supaya orang-orangnya muncul di registry & jadi anggota tim default sebagai FASILITATOR. Untuk data terbaru, akun lapangan memakai `TIM_LOKASI` dengan rule unik per `region`, sedangkan Tim Akademik bersifat global (`region` kosong) dan anggota ber-role `AKADEMIK`.

### 11.1 Migration Script

Endpoint: `POST /api/dev/migrate-volunteers` (admin only, idempotent, safe to re-run).

Logic:
1. Loop semua akun legacy `Relawan` dengan `role: "RELAWAN"`.
2. Skip kalau `members[].length > 0` (sudah pernah dimigrasi).
3. Skip kalau `name` kosong/`null`.
4. Cari `Volunteer` di registry by case-insensitive exact name match. Kalau tidak ada, create new dengan `name`, `isActive: true`, `notes: "Auto-migrated dari Relawan.name"`.
5. Cek apakah `Volunteer` itu sudah jadi anggota tim lain — kalau ya, skip (admin perlu handle manual).
6. Push ke `Relawan.members` sebagai FASILITATOR dengan `joinedAt = team.createdAt ?? now`.

### 11.1b Cleanup Data Tim Lokasi & Tim Akademik

Cleanup yang sudah dilakukan:
- Legacy `TIM_PEKAN_1..4` digabung menjadi `TIM_LOKASI` per Lokasi Belajar via `scripts/migrate-team-location.mjs`.
- Data saat ini sudah bersih dari role `TIM_PEKAN_*` (`remainingLegacy: 0`) dan memiliki 3 akun `TIM_LOKASI`: `Tim Offline Depok`, `Tim Offline Sasak Panjang`, dan `Tim Online Reguler`.
- Anggota dari akun pekan lama digabung dan dideduplikasi ke akun Tim Lokasi target.
- Jadwal dari akun pekan lama dipindahkan ke akun Tim Lokasi target agar portal lokasi tetap melihat jadwal yang sama.
- Role anggota lama `FACILITATOR` dinormalisasi menjadi `FASILITATOR`.
- Tim Akademik dibuat global dengan `region: ""`.
- Role anggota Tim Akademik dinormalisasi ke `AKADEMIK` ketika ada anggota.

Response body: `{ migrated, skipped, total, log }`.

### 11.2 Cara Jalankan

Karena endpoint butuh session admin, harus dipanggil dari browser yang sudah login sebagai SUPER_ADMIN:

```js
// Buka /admin/dashboard (login admin), lalu di DevTools console:
fetch("/api/dev/migrate-volunteers", { method: "POST" })
  .then(r => r.json())
  .then(console.table);
```

Atau via curl dengan cookie session:

```bash
curl -X POST https://your-host/api/dev/migrate-volunteers \
  -H "Cookie: gsb_lms_session=<JWT>"
```

### 11.3 Verifikasi Pasca-Migrasi

1. Buka `/admin/volunteer-registry` — semua orang dari migrasi muncul.
2. Buka `/admin/volunteers` — kolom "Anggota" tiap baris menampilkan nama + role chip.
3. Kalau ada nama yang ke-skip karena duplikat (sama orang muncul di 2 akun lama), admin manual fix lewat tombol "Anggota" di tim yang benar.
4. Setelah migrasi confirmed, endpoint `/api/dev/migrate-volunteers/route.ts` boleh dihapus dari production deploy.

### 11.4 Rollback (kalau perlu)

Migrasi non-destructive — `Relawan.name` legacy tidak dihapus. Untuk rollback:
- Drop collection `volunteer_registry`.
- Hapus field `members` dari semua `Relawan`: `db.volunteers.updateMany({}, { $unset: { members: "" } })`.
- Drop collection `team_attendances` kalau sudah ada record (akan kehilangan history kehadiran tim).
