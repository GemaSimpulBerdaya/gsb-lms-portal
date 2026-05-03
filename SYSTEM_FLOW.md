# Panduan Alur Sistem GSB LMS (Untuk Frontend & Backend)

Dokumen ini menjelaskan alur sistem dari ujung ke ujung (end-to-end) pada platform GSB LMS, peran setiap user, dan fitur-fitur yang perlu dibangun dan diintegrasikan oleh Frontend (FE) maupun Backend (BE).

---

## 1. Peran Pengguna (Roles)

Dalam sistem ini, terdapat beberapa peran utama:
1. **Super Admin**: Pengelola pusat operasional akademik. **UI Admin kini terintegrasi langsung di repo ini (`gsb-lms`)** di rute `/admin`.
2. **Relawan (Volunteer)**: Pengguna operasional di lapangan. Mereka menggunakan **UI di repo ini (`gsb-lms`)** untuk belajar dan melapor.
3. **Student (Siswa)**: Peserta didik yang menggunakan **UI di repo ini (`gsb-lms`)**. Mereka masuk melalui SSO dari aplikasi utama `gsb-web`.

---

## 2. Alur Autentikasi (Authentication Flow)

Autentikasi terbagi menjadi 2 pintu yang berbeda:

### A. Login Relawan & Admin (Halaman: `/`)
- **Alur FE**: Pengguna login melalui form Email & Password secara manual di LMS ini.
- **Alur BE (`/api/auth/login`)**: BE memeriksa kredensial. Jika valid, BE menerbitkan **JWT Token** dengan role `admin` atau `volunteer`.
- **Middleware**: Sistem secara otomatis mengarahkan Admin ke `/admin/dashboard` dan Relawan ke `/dashboard`.

### B. Autentikasi Student (Unified Entry via `gsb-web`)
- **Student Flow**: Klik menu LMS di `gsb-web` -> Redirect ke `/student?token=...`.
- **BE**: Memverifikasi token eksternal untuk sesi belajar siswa.

---

## 3. Alur SUPER ADMIN (Integrated Admin Center)

Admin Portal di rute `/admin` berfungsi sebagai pusat kendali seluruh operasional LMS.

### A. Semester Lifecycle Management (`/admin/semesters`)
- **Fungsi**: Mengelola siklus akademik (Ganjil/Genap).
- **Alur**:
  - **Tambah/Edit**: Membuat semester baru (misal: 2026-1).
  - **Set Active**: Menentukan satu semester yang menjadi acuan global di seluruh sistem.
  - **Selesaikan Semester**: Mengunci semester yang sudah berakhir (`isClosed`). Data di semester tertutup tidak dapat diedit/dihapus.
  - **Recap**: Menampilkan performa otomatis (Total Jadwal, Laporan, Modul) saat semester ditutup.

### B. Executive Insights Dashboard (`/admin/dashboard`)
- **Fungsi**: Visualisasi data real-time untuk pengambilan keputusan.
- **Komponen**:
  - **Global Stats**: Menampilkan total Relawan, Siswa, Jadwal, dan Modul.
  - **Tren Partisipasi**: Grafik garis (Recharts) yang menunjukkan aktivitas laporan bulanan.
  - **Proporsi Ekosistem**: Pie chart distribusi sumber daya.
- **Context**: Seluruh data statistik difilter berdasarkan **Semester Aktif**.

### C. Manajemen Database Relawan & Siswa (`/admin/volunteers` & `/admin/students`)
- **Fungsi**: CRUD data pengguna secara terpusat.
- **Fitur**: Impor massal dari Excel (untuk data siswa) dan manajemen jadwal mengajar relawan.

### D. Manajemen Modul & Kurikulum (`/admin/modules`)
- **Fungsi**: Mengelola materi belajar per semester.
- **Filter**: Dilengkapi filter semester dinamis untuk melihat kurikulum lampau maupun mendatang.

### E. Audit Laporan Kegiatan (`/admin/reports`)
- **Fungsi**: Memverifikasi dokumentasi dari lapangan.
- **Fitur**: Filter semester dinamis dan detail view untuk melihat bukti foto kegiatan.

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

## 7. Strategi Database (Shared Cluster)

Untuk efisiensi dan kemudahan integrasi:
- **Cluster**: Menggunakan 1 MongoDB Atlas Cluster yang sama.
- **Database**: Dipisahkan secara logis:
    - `gsb_main`: Digunakan oleh `gsb-web` (Data utama, Donasi, Profil Yayasan).
    - `gsb_lms`: Digunakan oleh repo ini (Modul, Kuis, Laporan Relawan, Nilai Siswa).
- **Interaksi**: `gsb-web` mengakses data `gsb_lms` **HANYA** melalui API yang disediakan repo ini, bukan melalui koneksi DB langsung, untuk menjaga integritas skema data.

---

## 8. Cara Kerja Bareng FE & BE (Best Practice)

Agar pengerjaan paralel tidak terhambat:
1. **Sepakati Kontrak API**: Karena sekarang melibatkan dua repo (`gsb-web` dan `gsb-lms`), dokumentasi API menjadi sangat krusial.
2. **Mockup UI**: FE di repo ini (Siswa/Relawan) dan FE di repo `gsb-web` (Admin) bisa bekerja dengan data dummy sampai API di `gsb-lms` siap.
3. **CORS Configuration**: Backend di `gsb-lms` harus mengizinkan request dari domain `gsb-web` (Cross-Origin Resource Sharing).

