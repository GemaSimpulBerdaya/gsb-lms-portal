# GSB LMS Portal — System Flow

## 1. Scope

Repo ini menangani operasional pembelajaran reguler Gema Simpul Berdaya:

- Super Admin (`ADMIN`)
- Tim Akademik (`TIM_AKADEMIK`)
- Relawan dan tim lapangan (`RELAWAN`, `TIM_PEKAN`, serta role legacy yang masih didukung)
- Data siswa reguler untuk kebutuhan jadwal, presensi, evaluasi, portofolio, dan rapor

Portal belajar mandiri siswa berada di aplikasi terpisah.

## 2. Auth dan Akses

Admin dan relawan login memakai email/password melalui `POST /api/auth/login`. Server menerbitkan JWT internal ke cookie HTTP-only `gsb_lms_session`.

`src/proxy.ts` melindungi route dan mengarahkan pengguna sesuai role. Helper role canonical berada di `src/lib/roles.ts`.

## 3. Area Admin

Route admin berada di `/admin/*`:

- Dashboard operasional dan akademik
- Semester, lokasi belajar, fase, dan mata pelajaran
- Jadwal KBM
- Daftar siswa dan relawan
- Modul dan materi ajar reguler
- Presensi siswa dan tim
- Rekap nilai dan rapor
- Portofolio dan laporan KBM

Tim Akademik hanya dapat membuka path yang diizinkan oleh `isAcademicAllowedPath()`.

## 4. Area Relawan

Route relawan utama:

- `/dashboard`
- `/schedule`
- `/attendance`
- `/evaluation`
- `/portfolio`
- `/reporting`
- `/students-data`
- `/team-attendance`

Akses API relawan selalu dibatasi oleh session dan kepemilikan `teamAccountId`.

## 5. Semester dan Konfigurasi

Semester aktif disimpan pada `Settings.activeSemester`. Daftar semester, label semester, lokasi belajar, fase, mata pelajaran, serta rubrik rapor berada di koleksi `settings`.

`faseConfig` menjadi source of truth daftar fase. UI dan API menurunkan pilihan fase dari key object tersebut agar tidak drift.

## 6. Jadwal dan Pertemuan

`Schedule` mengikat semester, lokasi, fase, tim, serta daftar `kbmDates`. Setiap pertemuan memiliki nomor pekan, tanggal, topik, dan petugas.

Presensi, evaluasi, portofolio, dan laporan memakai konteks jadwal/pertemuan. Input masa depan dikunci di frontend dan divalidasi ulang di backend.

## 7. Modul dan Materi Ajar

`Module` dan `MateriAjar` hanya melayani pembelajaran reguler. Data disusun berdasarkan lokasi belajar, fase, mata pelajaran, pekan/bulan, dan semester.

File materi dapat berasal dari UploadThing atau URL HTTP yang valid. Penggantian dan penghapusan record juga membersihkan file UploadThing terkait bila relevan.

## 8. Penilaian

`NilaiOffline` menyimpan dua tipe:

- `TUGAS`: nilai KBM mingguan dengan komponen Pemahaman Konsep, Pengerjaan Kuis, dan Sikap Pembelajaran
- `UAS`: nilai per mata pelajaran dengan `maxScore` dan rubrik opsional

Endpoint utama:

- `GET/POST /api/volunteer/evaluation`
- `PUT/DELETE /api/volunteer/evaluation/[id]`
- `GET /api/admin/grades`
- `GET /api/admin/grades/pdf`

Backend memvalidasi semester aktif, kepemilikan jadwal, waktu pertemuan, rentang nilai, dan uniqueness record.

## 9. Presensi, Portofolio, dan Laporan

Presensi siswa disimpan per jadwal dan pertemuan. Portofolio menyimpan karya siswa beserta dokumentasi. Laporan KBM menyimpan ringkasan kegiatan dan foto dokumentasi.

Semua query operasional harus scoped ke semester dan konteks tim/jadwal yang sesuai.

## 10. Rapor

`src/lib/reportAggregator.ts` menggabungkan profil siswa, nilai KBM, UAS, presensi, jadwal, dan konfigurasi rubrik menjadi payload rapor.

Payload dipakai oleh:

- Rekap admin `/admin/grades`
- Preview/print rapor
- PDF melalui `src/lib/pdf/ReportTemplate.tsx`
- Arsip rapor per semester

## 11. Database

Koleksi utama:

- `students`
- `volunteers`
- `volunteer_registry`
- `schedules`
- `attendances`
- `team_attendances`
- `modules`
- `materi_ajar`
- `offline_grades`
- `student_portfolios`
- `reports`
- `settings`

Gunakan `src/lib/mongodb.ts` untuk koneksi. Jangan membuat connection helper baru dan jangan mengakses database aplikasi lain secara langsung.

## 12. Verifikasi

Tidak ada test runner khusus. Perubahan wajib diverifikasi dengan:

```bash
bun run lint
bun run build
```
