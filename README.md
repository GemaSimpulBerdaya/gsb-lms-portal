# GSB LMS Portal

GSB LMS Portal adalah aplikasi full-stack Next.js untuk operasional LMS Gema Simpul Berdaya. Aplikasi ini melayani dua area utama:

- **Super Admin**: dashboard pusat, CRUD data, pengaturan semester/fase, laporan, dan rapor.
- **Volunteer / Relawan**: jadwal KBM, absensi, evaluasi, portfolio, dan pelaporan kegiatan.


## Tech Stack

- Next.js 16 App Router
- React 19
- MongoDB + Mongoose
- Tailwind CSS v4 dan CSS Modules
- UploadThing untuk upload file
- JWT internal untuk admin/volunteer

## Perintah

Gunakan `bun` jika tersedia.

```bash
bun dev
bun run lint
bun run build
```

Fallback dengan npm:

```bash
npm run dev
npm run lint
npm run build
```

Tidak ada test runner khusus. `build` dipakai sebagai typecheck/verifikasi produksi.

## Environment

Buat `.env.local` dengan variabel berikut:

```bash
MONGODB_LMS_URI=
INTERNAL_JWT_SECRET=
UPLOADTHING_TOKEN=
```

## Struktur Folder

```text
src/app
  (admin)/          Route group untuk /admin/*
  (volunteer)/      Route group untuk portal volunteer
  api/              Route handlers backend
  login/            Login admin & volunteer


src/components
  admin/            Komponen khusus admin

  volunteer/        Komponen khusus volunteer
  ui/               Komponen UI shared
  sidebar/          Sidebar portal volunteer
  stat-card/        Card statistik shared
  student-table/    Tabel siswa shared
  toast/            Toast notification

src/lib             Helper server/client lintas fitur
src/models          Mongoose schemas dan collection mapping
src/modules         Modul feature-oriented yang mulai dipisahkan
src/hooks           React hooks shared
src/utils           Utility umum
```

## Database

Database canonical saat ini:

- `students`
- `volunteers`
- `volunteer_registry`
- `schedules`
- `attendances`
- `team_attendances`
- `modules`

- `offline_grades`
- `student_portfolios`
- `reports`
- `settings`

Master mata pelajaran tidak punya koleksi terpisah. Data canonical disimpan
sebagai array `availableSubjects` di koleksi `settings`.

Repo ini khusus operasional pembelajaran reguler. Portal belajar siswa dipisahkan ke aplikasi lain.

## Dokumentasi Sistem

Lihat [SYSTEM_FLOW.md](./SYSTEM_FLOW.md) untuk alur fitur end-to-end, role, API, strategi database, dan catatan migrasi.

## Catatan Production

Route `/api/dev/*` hanya untuk development dan otomatis mengembalikan `404` saat `NODE_ENV=production`.
