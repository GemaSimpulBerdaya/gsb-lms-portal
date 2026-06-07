# Kontrak SSO: gsb-web → gsb-lms-portal (Student)

Status: **Disepakati untuk diimplementasikan**. Sisi LMS sudah siap; sisi gsb-web (endpoint handoff) belum dibangun.

Dokumen ini adalah satu-satunya sumber kebenaran untuk integrasi login siswa (SSO) antara
`gsb-web` (penyedia identitas, pakai Clerk) dan `gsb-lms-portal` (penerima, Portal Siswa).

---

## 1. Ringkasan Arsitektur

Dua aplikasi **terpisah**. gsb-web sudah punya autentikasi sendiri (Clerk + Payload CMS).
LMS tidak ikut Clerk; LMS hanya mempercayai sebuah **JWT bertanda tangan** yang dibuat gsb-web
menggunakan **secret bersama**. Tidak ada panggilan API antar-aplikasi saat login — murni
handoff token lewat URL redirect.

```
Siswa (sudah login Clerk di gsb-web)
        │  klik "Buka LMS" di /dashboard/lms
        ▼
gsb-web  GET /lms/launch        ← endpoint BARU yang harus dibuat
        │  - ambil user dari Clerk (auth())
        │  - sign JWT (HS256, secret bersama)
        │  - redirect 302
        ▼
gsb-lms  GET /student?token=<jwt>   ← SUDAH ADA, tidak perlu diubah
        │  - verifySsoJWT(token)
        │  - set cookie httpOnly `gsb_student_token`
        │  - redirect /student/dashboard
        ▼
Portal Siswa LMS aktif (sesi 24 jam)
```

---

## 2. Bentuk Token (WAJIB)

JWT yang dibuat gsb-web **harus** memenuhi ini, kalau tidak LMS akan menolak.

| Properti | Nilai | Catatan |
|----------|-------|---------|
| Algoritma | `HS256` | simetris, pakai secret bersama |
| Secret | `SSO_JWT_SECRET` | **harus identik** di kedua aplikasi |
| Masa berlaku | direkomendasikan `5m` | token ini sekali-pakai untuk handoff; sesi panjang dipegang cookie LMS |

### Claim (payload JWT)

| Claim | Tipe | Wajib | Keterangan |
|-------|------|:-----:|------------|
| `id`   | `string` | ✅ | **ID siswa yang stabil & permanen.** LMS menyimpannya sebagai `externalUserId` untuk progress belajar. Jangan pernah berubah untuk siswa yang sama. Gunakan `clerkUserId` atau ID Payload user. |
| `name` | `string` | ✅ | Nama tampilan siswa. |
| `role` | `string` | ✅ | **Harus persis `"STUDENT"`.** LMS menolak token dengan role lain (`page.tsx` cek `payload.role !== "STUDENT"`). Role bersifat netral (identitas akun siswa), terlepas siswa SMA/SMK atau program apa pun. |

Contoh payload:

```json
{ "id": "user_2abc...", "name": "Budi Santoso", "role": "STUDENT" }
```

> Sumber kebenaran di LMS: `src/lib/student-session.ts` mengembalikan `{ id, name, role: 'STUDENT' }`
> dan `src/app/(student)/student/page.tsx` memverifikasi `role === "STUDENT"`.

> Catatan: `role` adalah identitas akun, bukan jenis program. Jenis program belajar diatur
> terpisah lewat `programType` pada model `Module` (mis. `"SNBT"`).

---

## 2b. Pemetaan Data: Users gsb-web → Claim Token

gsb-web dan LMS punya sistem role yang **terpisah** dan tidak saling mengenal. Endpoint handoff
**menerjemahkan**, bukan menyalin mentah. LMS hanya butuh 2 data: `id` dan `name`.

| Claim token (LMS) | Sumber di gsb-web (Users collection) | Alasan |
|-------------------|--------------------------------------|--------|
| `id`   | `user.clerkUserId` | Unik & immutable. Jadi `externalUserId` di LMS = kunci permanen progress siswa. **Jangan** pakai `email`/`username` (bisa berubah). |
| `name` | `user.fullName` | Hanya untuk tampilan di LMS. |
| `role` | konstanta `"STUDENT"` (hardcoded) | Bukan disalin dari `roles` gsb-web. Selalu di-set `"STUDENT"`. |

### Aturan otorisasi (siapa yang boleh dapat token)

Role gsb-web: `roles: ["super-admin" | "admin" | "user"]` (default `["user"]`).

- **Hanya user dengan `roles` mengandung `"user"` (siswa) yang boleh mendapat token STUDENT.**
- User `admin`/`super-admin` yang mengakses `/lms/launch` ditolak atau diarahkan ke area lain
  (portal siswa bukan untuk admin).
- Pemetaan tetap: `user` (gsb-web) → `STUDENT` (LMS). Nama role sengaja beda; yang penting
  endpoint melakukan terjemahan ini, bukan meneruskan string role gsb-web apa adanya.

> Field Users gsb-web lain (`schoolType`, `grade`, `targetPTN`, `whatsapp`, dll) **tidak**
> dibutuhkan LMS saat ini. Tambah claim baru hanya jika LMS memang akan memakainya.

---

## 3. Tanggung Jawab Sisi gsb-web (yang harus dibangun)

Endpoint baru, mis. `GET /lms/launch`, di dalam route group `(lms)` yang sudah disiapkan.

1. Pastikan user sudah login Clerk (`auth()` dari `@clerk/nextjs/server`; lihat pola di `src/trpc/init.ts`). Kalau belum, redirect ke `/sign-in?callbackUrl=/lms/launch`.
2. Ambil user dari Payload (`ensureUserRecord`) untuk dapat `fullName`. Tolak jika `roles` tidak mengandung `"user"`.
3. Susun claim sesuai pemetaan di bagian 2b (`id` ← `clerkUserId`, `name` ← `fullName`, `role` = `"STUDENT"`), lalu sign JWT sesuai bentuk di bagian 2.
4. Redirect 302 ke `${LMS_BASE_URL}/student?token=<jwt>`.

### Env var baru di gsb-web

| Var | Contoh | Fungsi |
|-----|--------|--------|
| `SSO_JWT_SECRET` | (sama dgn LMS) | secret penandatangan, **identik** dengan LMS |
| `LMS_BASE_URL` | dev `http://localhost:3000`, prod `https://lms.komunitasgsb.id` | tujuan redirect |

### Dependensi

`jose` **belum ada** di `gsb-web/package.json`. Tambahkan `jose` (atau `jsonwebtoken`) untuk menandatangani token. `jose` direkomendasikan supaya konsisten dengan LMS.

---

## 4. Tanggung Jawab Sisi LMS (SUDAH SELESAI — referensi)

Tidak ada perubahan kode yang dibutuhkan. Untuk verifikasi:

- Entry point: `src/app/(student)/student/page.tsx` — baca `?token=`, verifikasi, set cookie, redirect.
- Verifikasi token: `verifySsoJWT()` di `src/lib/jwt.ts` (pakai `SSO_JWT_SECRET`).
- Sesi siswa: cookie `gsb_student_token` (httpOnly, 24 jam) dibaca oleh `getStudentSession()` di `src/lib/student-session.ts`.
- Mock untuk dev/skripsi (tanpa gsb-web): `/student/test-login` (hanya `NODE_ENV=development`).

Env var di LMS: `SSO_JWT_SECRET` (sudah terdaftar di `.env.example`).

---

## 5. Keamanan / Catatan

- `SSO_JWT_SECRET` adalah kunci kepercayaan tunggal. Siapa pun yang tahu secret ini bisa membuat sesi siswa. Jaga kerahasiaannya; jangan commit.
- Masa berlaku token handoff dibuat pendek (`5m`) karena hanya untuk sekali tukar. Sesi efektif 24 jam dipegang cookie LMS, bukan token.
- Cookie LMS `secure: true` di production (otomatis via `NODE_ENV`).
- Untuk dev lintas-origin (gsb-web `:3001` → LMS `:3000`), redirect via URL bekerja lintas-port karena token dibawa di query string, bukan cookie.

---

## 6. Status Pekerjaan

- [x] LMS: SSO handler `/student?token=` → Route Handler `/api/student/sso` (verifikasi + set cookie + redirect)
- [x] LMS: cookie konsisten `gsb_student_token` di semua jalur student
- [x] LMS: mock dev login `/student/test-login`
- [x] LMS: bersihkan dead code guard `/sma` di `proxy.ts`
- [x] gsb-web: tambah dependensi `jose` (`jose@6.2.3`)
- [x] gsb-web: endpoint `GET /api/lms/launch` (auth Clerk → cek role `user` → sign JWT → redirect)
- [x] gsb-web: aktifkan kartu "Buka LMS" di `/dashboard` (anchor biasa, hindari prefetch)
- [x] gsb-web: set env `SSO_JWT_SECRET` (identik dgn LMS) + `LMS_BASE_URL` di `.env` + `.env.development`
- [x] Uji end-to-end dev (gsb-web → LMS) — BERHASIL

> **Catatan implementasi:**
> - **Penting (Next.js 16):** cookie tidak boleh di-set saat render page. Penanganan token
>   dipindah ke Route Handler `src/app/api/student/sso/route.ts`. Page `/student` hanya
>   meneruskan token ke handler itu, jadi URL kontrak `/student?token=` tetap sama.
> - Alur redirect lengkap: gsb-web `/api/lms/launch` → LMS `/student?token=` →
>   LMS `/api/student/sso?token=` (set cookie) → LMS `/student/dashboard`.
> - Endpoint gsb-web ada di `src/app/api/lms/launch/route.ts` (API route, murni redirect server-side).
> - Env var di gsb-web tidak ada file `.env.example` (semua `.env*` di-gitignore). Set manual:
>   ```
>   SSO_JWT_SECRET=<sama persis dengan nilai di gsb-lms-portal>
>   LMS_BASE_URL=http://localhost:3000        # dev
>   # LMS_BASE_URL=https://lms.komunitasgsb.id  # prod
>   ```
> - Repo gsb-web pakai `bun` (`bun.lock`). Dependensi `jose` ditambah via `bun add jose`.
