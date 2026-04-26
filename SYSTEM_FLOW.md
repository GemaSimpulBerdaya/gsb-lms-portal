# Panduan Alur Sistem GSB LMS (Untuk Frontend & Backend)

Dokumen ini menjelaskan alur sistem dari ujung ke ujung (end-to-end) pada platform GSB LMS, peran setiap user, dan fitur-fitur yang perlu dibangun dan diintegrasikan oleh Frontend (FE) maupun Backend (BE).

---

## 1. Peran Pengguna (Roles)

Dalam sistem ini, terdapat beberapa peran utama:
1. **Super Admin**: Pengelola utama sistem yang memiliki akses penuh untuk mengatur relawan, memasukkan modul pembelajaran (LMS), dan memonitor seluruh laporan.
2. **Relawan (Volunteer)**: Pengguna yang bertugas di lapangan. Mereka belajar melalui modul yang disiapkan admin dan secara rutin melakukan pelaporan (Reporting) aktivitas mereka.
3. **Student (Siswa)**: Peserta didik yang **TIDAK LOGIN** melalui halaman utama LMS. Mereka diarahkan (*redirect*) dari aplikasi utama **gsb-web** dengan membawa **JWT Token** untuk langsung masuk (Single Sign-On).

---

## 2. Alur Autentikasi (Authentication Flow)

Autentikasi terbagi menjadi 2 pintu yang berbeda:

### A. Login Super Admin & Relawan (Halaman: `/`)
- **Alur FE**: Admin dan Relawan login melalui form Email & Password secara manual di LMS.
- **Alur BE (`/api/auth/login`)**: BE memeriksa kredensial (dengan *bcrypt*). Jika valid, BE menerbitkan **JWT Token** (`role: 'superadmin' | 'relawan'`).
- **Pasca Login**: FE menangkap token, lalu mengarahkan ke dashboard masing-masing.

### B. Autentikasi Student (SSO via `gsb-web`)
- **Student TIDAK memiliki form login di LMS**. Mereka login di website utama (`gsb-web`).
- Ketika Student mengklik menu LMS di `gsb-web`, mereka diarahkan ke LMS dengan membawa JWT Token (misal lewat URL `?token=XYZ...` atau *cookie* antar subdomain).
- **Alur FE/BE LMS**: LMS menangkap JWT tersebut, memverifikasi keasliannya menggunakan *secret key* (seperti kode yang ada di `generate-jwt/route.ts`), lalu langsung memberikan akses masuk ke `/student` tanpa perlu minta password lagi.

---

## 3. Alur SUPER ADMIN (Manajemen Platform)

Super Admin adalah "penguasa" aplikasi. Fitur yang perlu disiapkan:

### A. Dashboard Global
- **Fungsi**: Melihat gambaran besar *platform*.
- **FE**: Menampilkan metrik seperti Total Relawan Terdaftar, Total Laporan Masuk Bulan Ini, dan Total Modul Aktif.
- **BE (`GET /api/admin/stats`)**: Mengembalikan data ringkasan tersebut dari database.

### B. Manajemen Akun Relawan
- **Fungsi**: Mengelola data relawan secara langsung. **Tidak ada pendaftaran/registrasi mandiri** untuk relawan di sistem ini.
- **FE**: Menampilkan tabel data relawan. Terdapat form/tombol untuk *Add Volunteer* (Admin membuatkan akun dengan menginput nama, email, dan password awal), edit, dan hapus akun.
- **BE (`GET, POST, PUT, DELETE /api/admin/volunteers`)**: Melayani operasi CRUD (Create, Read, Update, Delete) akun relawan oleh Super Admin di database.

### C. Manajemen Modul Pembelajaran (Input LMS)
- **Fungsi**: Membuat materi kurikulum untuk dibaca oleh relawan.
- **FE**: Form input komprehensif yang berisi:
  - Judul Modul
  - Deskripsi & Kategori
  - Upload Materi (Teks/Artikel, Video, atau File PDF)
  - *Optional*: Pembuatan Kuis.
- **BE (`POST & PUT /api/modules`)**: Menerima data dari FE dan menyimpannya ke koleksi MongoDB. 

### D. Pemantauan Laporan (All Reports)
- **Fungsi**: Membaca semua laporan yang dikirim oleh relawan di lapangan.
- **FE**: Tabel besar yang bisa di-filter berdasarkan tanggal, nama relawan, atau lokasi kegiatan.
- **BE (`GET /api/admin/reports`)**: Menarik semua data laporan dari seluruh relawan.

---

## 4. Alur RELAWAN (Pengguna Utama)

Relawan adalah pelaksana lapangan yang wajib belajar dan melapor.

### A. Dashboard Relawan (`/dashboard`)
- **Fungsi**: Ruang personal relawan.
- **FE**: Menampilkan sapaan, progres belajar mereka (misal: "Anda sudah menyelesaikan 3 dari 5 modul"), dan daftar singkat laporan terakhir mereka.
- **BE (`GET /api/volunteer/dashboard`)**: Menarik statistik khusus untuk satu user yang sedang login tersebut.

### B. Jadwal Mengajar & Modul Pembelajaran (`/schedule` & `/modules`)
- **Fungsi**: Relawan menyimpan profil mengajarnya (daerah + tingkatan) sekali, lalu mengakses modul yang sesuai per minggu.
- **Keputusan Desain**: Relawan dibagi per tim. **1 relawan = 1 daerah + 1 tingkatan** yang tetap (tidak mengajar di beberapa tempat secara bersamaan). Profil mengajar disimpan di DB dan digunakan sebagai konteks di seluruh fitur (modul, anak didik, evaluasi).
- **FE**: 
  - Pertama kali masuk: form isian **daerah/wilayah** dan **tingkatan pendidikan** → disimpan sebagai profil mengajar.
  - Kunjungan berikutnya: profil langsung dimuat otomatis, tidak perlu isi ulang.
  - Tersedia tombol **Edit Jadwal** jika perlu ganti daerah/tingkatan.
  - Menampilkan silabus dan daftar modul yang **terstruktur per minggu** (Minggu 1, Minggu 2, dst). Dilengkapi fitur **Download Modul** (PDF/Materi) untuk persiapan mengajar *offline*.
- **BE (`GET & POST /api/volunteer/schedule` & `GET /api/modules`)**: 
  - `GET /api/volunteer/schedule` — mengambil profil mengajar relawan yang sedang login.
  - `POST /api/volunteer/schedule` — menyimpan atau memperbarui profil mengajar (upsert).
  - `GET /api/modules?level=X&week=N` — menarik daftar modul yang disaring berdasarkan tingkatan dan minggu ke-N.

### C. Manajemen Anak Didik (`/students-data`)
- **Fungsi**: Memungkinkan relawan melihat daftar murid dalam satu wilayah dan tingkatan ajarnya.
- **FE**: Menyediakan antarmuka **Filter Wilayah (Daerah)** dan **Filter Tingkatan Pendidikan**. Setelah relawan memilih kombinasi filter tersebut, sistem akan menampilkan **Tabel Rekapitulasi** berisi nama-nama anak didik yang sesuai (berupa daftar kelas, bukan profil detail 1 per 1).
- **BE (`GET /api/volunteer/students?region=X&level=Y`)**: Menerima parameter *query string* (berupa filter wilayah dan tingkatan) lalu mengembalikan data ringkas (*list*) anak didik yang cocok dengan kriteria tersebut.

### D. Evaluasi, Data Nilai & Raport (`/evaluation`)
- **Fungsi**: Relawan dapat melihat rekap nilai anak didik, melakukan penilaian (*grading*) secara berkala tiap minggu, dan menyusun raport akhir.
- **FE**: 
  - **Tabel Rekap Nilai (Gradebook)**: Halaman untuk melihat riwayat nilai anak didik, baik itu nilai Kuis Mandiri yang dikerjakan anak didik secara otomatis, maupun nilai yang diinput manual.
  - Form/Tabel untuk **Input Nilai Tugas Mingguan** bagi masing-masing anak didik (misalnya: memilih Minggu 1, lalu memasukkan nilainya).
  - Form untuk **Input Nilai Ujian** (seperti ujian akhir/tengah semester).
  - Fitur/Tombol **Buat Raport (Generate Report Card)** yang merangkum rata-rata nilai mingguan dan nilai ujian beserta catatan dari relawan.
- **BE (`POST & GET /api/evaluation` & `GET /api/evaluation/raport`)**: Menyimpan dan **menarik (GET)** data nilai dari database berdasarkan indikator spesifik (*Tipe: Kuis Mandiri/Tugas/Ujian*, *Minggu ke-X*), serta men-*generate* data raport.

### E. Sistem Pelaporan Kegiatan Administratif (`/reporting`)
- **Fungsi**: Relawan melaporkan hasil pekerjaan di lapangan ke Super Admin (berbeda dengan raport anak, ini adalah laporan absensi/kehadiran relawan).
- **FE**: Memiliki form yang meminta Tanggal, Judul, Deskripsi, Bukti Foto, serta menampilkan riwayat laporan (*history*).
- **BE (`POST /api/reports` & `GET /api/reports/me`)**: Menyimpan dan mengambil riwayat laporan milik relawan yang bersangkutan.

---

## 5. Alur STUDENT (Integrasi gsb-web)

Student (*Siswa*) memiliki pengalaman (*user experience*) yang berbeda:

### A. Proses Masuk (Seamless Entry)
- **Fungsi**: Masuk ke LMS dengan otomatis (*Single Sign-On*).
- **FE**: Menyediakan *middleware* atau halaman khusus yang menangkap Token JWT dari *redirect* aplikasi `gsb-web`.
- **BE**: Memverifikasi validitas token tersebut (apakah benar diterbitkan oleh server `gsb-web`).

### B. Dashboard Student & Modul Belajar (`/student`)
- **Fungsi**: Ruang belajar murid dengan sistem "Bebas Pilih Topik Dasar, Terkunci Secara Linier". Sistem ini sangat ideal untuk persiapan Tryout.
- **FE**: Menampilkan daftar modul yang dikelompokkan per mata pelajaran/topik. **Semua Modul Dasar/Awal dari setiap topik TERBUKA sejak awal**, sehingga siswa bebas melompat dan memilih topik mana saja yang ingin dipelajari lebih dulu. Namun, modul tingkat lanjut di suatu topik ditampilkan dalam keadaan **terkunci (*locked*)**.
- **BE (`GET /api/student/modules`)**: Mengirimkan hierarki modul beserta status aksesnya (terbuka/terkunci) berdasarkan histori kelulusan kuis murid pada setiap topik.

### C. Kuis Persyaratan Modul (`/student/quiz`)
- **Fungsi**: Syarat wajib untuk membuka materi tingkat lanjut dalam satu "jalur" mata pelajaran yang sama.
- **FE**: Di akhir modul, terdapat tombol memulai **Kuis**. Setelah berhasil lulus kuis (misalnya Kuis Matematika Bab 1), barulah modul lanjutan untuk topik tersebut (Matematika Bab 2) terbuka (*unlocked*). Modul awal topik lain (misal Biologi Bab 1) tetap terbuka tanpa terpengaruh.
- **BE (`POST /api/student/quiz`)**: Menerima jawaban kuis, menghitung skor, dan jika lulus, memperbarui *progress* di database sehingga modul urutan berikutnya pada mata pelajaran tersebut ikut terbuka.

---

## 6. Cara Kerja Bareng FE & BE (Best Practice)

Agar pengerjaan paralel tidak terhambat:
1. **Sepakati Bentuk Data (API Contract)**: Diskusikan dulu bersama FE data apa saja yang dibutuhkan di halaman (misal, tabel laporan butuh kolom apa saja).
2. **Mockup FE**: Sambil BE membuat API, FE tetap membuat UI menggunakan *data palsu (dummy data)* seperti yang sedang dilakukan sekarang.
3. **Integrasi Endpoint**: Jika backend sudah selesai (misal `/api/reports` selesai), FE mengganti *dummy data* dengan pemanggilan `fetch` atau library HTTP client ke endpoint yang dijanjikan.
