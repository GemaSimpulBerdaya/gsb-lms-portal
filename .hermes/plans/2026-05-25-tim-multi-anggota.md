# Tim Multi-Anggota & Tracking Kehadiran Anggota — Implementation Plan

> **Status:** ✅ DONE — 5 fase selesai 25 Mei 2026
> **Tanggal:** 2026-05-25
> **Versi:** 1.0
> **Commits:** `4cf0056` (P1) · `1321f50` (P2) · `405d1b6` (P3) · `83facaa` (P4) · Phase 5 docs
>
> Doc ini disimpan sebagai history desain. Spec aktif:
> - `SYSTEM_FLOW.md §3.E, §3.E2, §3.E3, §4.E2, §11`
> - Code: `src/models/{Volunteer,Relawan,TeamAttendance}.ts`, `src/lib/teamAttendance.ts`

**Goal:** Mengubah konsep akun relawan dari "1 akun = 1 orang" menjadi "1 akun = 1 tim dengan beberapa anggota berperan", lalu menambahkan tracking kehadiran tiap anggota tim di setiap pertemuan KBM.

**Architecture:** 1 akun login (`Relawan`) → punya `members[]` (array sub-document: nama + role). Saat input form attendance kelas, ditambah satu blok "Kehadiran Tim Pengajar" yang nyimpen status setiap anggota di koleksi baru `TeamAttendance` (di-key `relawanId + scheduleId + week + date + memberName`). Schema lama tidak diubah → backward compatible.

**Tech Stack:** Next.js 16 App Router, Mongoose (`gsb_lms` MongoDB Atlas), shared `<AdminModal>` + `<FormField>` UI primitives.

---

## Konteks (untuk implementer baru)

### Data lama yang sudah ada

```
Relawan (collection: volunteers)
  email, password, teamName?, region?, name?, role
  → setiap dokumen merepresentasikan 1 akun login

Schedule (collection: schedules)
  relawanId, region, fase, semester, activeWeek, kbmDates[]
  → 1 schedule per relawan, kbmDates list pertemuan mingguan

Attendance (collection: attendances)
  relawanId, anakDidikId, week, semester, date, status, notes
  → kehadiran SISWA (anakDidikId), bukan anggota tim
  → unique compound index: anakDidikId + week + semester + date
```

### Apa yang berubah

1. **`Relawan`** dapat field baru `members[]` dengan struktur `{ name, role, phone? }`.
2. **Koleksi baru `TeamAttendance`** untuk track kehadiran tiap anggota tim per pertemuan.
3. **VolunteerModal** di admin — sekarang input nama tim + daftar anggota+role inline.
4. **Volunteer attendance page** — di samping checklist siswa (existing), ada blok kecil "Tim Pengajar Hari Ini" untuk centang anggota mana yang hadir.
5. **Admin reports/dashboard** — bisa lihat rekap kehadiran tim (siapa paling sering izin, siapa hadir penuh).

### Apa yang TIDAK berubah

- Struktur login (1 email/password per `Relawan`) tetap sama.
- Field `Attendance` siswa tetap sama (pakai `relawanId` ke akun tim).
- API existing dengan field `teamName`, `name`, `region` di `Relawan` tetap berfungsi.

---

## Phase 1 — Schema & Backend

### Task 1: Tambah field `members[]` di model `Relawan`

**Objective:** Schema Mongoose support array anggota tim, backward compatible (default `[]`).

**Files:**
- Modify: `src/models/Relawan.ts`

**Code:**

```typescript
export type TeamRole = "FACILITATOR" | "PENGAJAR" | "DOKUMENTASI";

export interface ITeamMember {
  name: string;
  role: TeamRole;
  phone?: string;
}

export interface IRelawan extends Document {
  email: string;
  password: string;
  teamName?: string;
  region?: string;
  name?: string;          // tetap ada — untuk PIC kontak utama
  role: string;           // ADMIN / RELAWAN
  members?: ITeamMember[]; // ← NEW
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Di dalam RelawanSchema:
members: {
  type: [{
    name: { type: String, required: true },
    role: { type: String, enum: ["FACILITATOR", "PENGAJAR", "DOKUMENTASI"], required: true },
    phone: { type: String, default: "" },
  }],
  default: [],
},
```

**Verify:** `npx tsc --noEmit` clean.

---

### Task 2: Update API `POST/PUT /api/admin/volunteers` untuk handle `members[]`

**Objective:** Admin bisa kirim array members saat create/edit tim.

**Files:**
- Modify: `src/app/api/admin/volunteers/route.ts`
- Modify: `src/app/api/admin/volunteers/[id]/route.ts`

**Validation:**
- `members[]` opsional (default `[]`)
- Setiap member wajib `name` + `role` (enum)
- Tolak duplikasi nama dalam 1 tim (case-insensitive)

**Verify:** `curl -X POST` dengan body lengkap → schema tersimpan.

---

### Task 3: Bikin model `TeamAttendance`

**Objective:** Koleksi baru untuk track kehadiran anggota tim per pertemuan KBM.

**Files:**
- Create: `src/models/TeamAttendance.ts`

**Schema:**

```typescript
import mongoose, { Schema, Document, Model, Types } from "mongoose";

export type MemberAttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALFA";

export interface ITeamAttendance extends Document {
  relawanId: Types.ObjectId;       // tim yang punya jadwal
  scheduleId: Types.ObjectId;      // FK ke Schedule (untuk navigation)
  week: number;
  semester: string;
  date: Date;                      // tanggal kelas (sama dgn Attendance siswa)
  memberName: string;              // snapshot nama anggota saat itu
  memberRole: "FACILITATOR" | "PENGAJAR" | "DOKUMENTASI";
  status: MemberAttendanceStatus;
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

// Compound unique: 1 record per anggota per pertemuan
// (week + semester + date + memberName + relawanId)
TeamAttendanceSchema.index(
  { relawanId: 1, week: 1, semester: 1, date: 1, memberName: 1 },
  { unique: true, name: "uniq_team_attendance" }
);

// Query indexes
TeamAttendanceSchema.index({ relawanId: 1, semester: 1 });
TeamAttendanceSchema.index({ semester: 1, date: -1 });
```

**Reasoning:**
- Pakai `memberName` sebagai snapshot, BUKAN ObjectId ke sub-doc — kalau anggota di-rename atau dihapus dari tim, history attendance tetap bisa dibaca.
- Ada `memberRole` snapshot juga — biar laporan tetap akurat walau peran anggota berubah.
- `scheduleId` untuk navigation, tapi unique key pakai `(week + date + memberName)` biar match sama struktur kbmDates.

**Verify:** `npx tsc --noEmit` clean.

---

### Task 4: Bikin API attendance tim

**Objective:** Endpoint untuk volunteer (input) dan admin (rekap).

**Files:**
- Create: `src/app/api/volunteer/team-attendance/route.ts` — GET (list per pertemuan), POST (bulk upsert)
- Create: `src/app/api/admin/team-attendance/route.ts` — GET (rekap per tim/semester)

**POST volunteer flow:**
```typescript
// Body: { week, date, semester, attendances: [{ memberName, memberRole, status, notes }] }
// Logic: untuk tiap entry → upsert ke TeamAttendance dgn unique key
```

**Verify:** Manual curl atau test di volunteer attendance page.

---

## Phase 2 — Admin UI: Tim Editor

### Task 5: VolunteerModal — section "Anggota Tim" inline

**Objective:** Form tambah/edit relawan punya block untuk daftar anggota tim, mirip QuizModal punya questions array.

**Files:**
- Modify: `src/components/admin/VolunteerModal/VolunteerModal.tsx`

**UI:**
- Section baru: "Anggota Tim"
- List rows: input nama + select role + input phone (opsional) + tombol hapus
- Button "+ Tambah Anggota"
- Hint: "Tim biasanya terdiri dari Facilitator, 1-2 Pengajar, dan 1 Bagian Dokumentasi"
- Validasi: nama unique per tim (case-insensitive), minimal 1 member

**State:**
```typescript
const [members, setMembers] = useState<ITeamMember[]>([]);
```

**Verify:** Tambah tim baru dengan 3 anggota → cek di MongoDB `db.volunteers.findOne({email}).members`.

---

### Task 6: VolunteerTable — tampilkan jumlah & breakdown peran anggota

**Objective:** Admin bisa lihat di list "Tim Jakarta — 3 anggota (1F · 2P · 1D)" atau langsung expand.

**Files:**
- Modify: `src/components/admin/VolunteerTable/VolunteerTable.tsx`
- Modify: `src/components/admin/AdminStudentTable/...` kalau perlu styling shared

**UI:** Kolom baru "Anggota Tim" dengan badge ringkas. Klik baris → modal detail (atau tombol "Lihat" buka modal expand).

**Verify:** UI tampilan di `/admin/volunteers` setelah migration.

---

## Phase 3 — Volunteer UI: Tim Self-Attendance

### Task 7: Attendance page — block "Tim Pengajar Hari Ini"

**Objective:** Saat volunteer input absensi siswa untuk tanggal X, di bawah/atas tabel siswa muncul block kecil yang nampilin daftar anggota tim mereka, bisa centang radio HADIR/IZIN/SAKIT/ALFA per anggota.

**Files:**
- Modify: `src/app/(volunteer)/attendance/page.tsx`
- Modify: `src/app/api/volunteer/dashboard/route.ts` (return `members[]`)

**UX:** Default semua HADIR (asumsi optimis). Volunteer cuma perlu klik kalau ada yang absen. Save bareng dengan attendance siswa atau via tombol terpisah "Simpan Kehadiran Tim".

**Verify:** Buka `/attendance`, pilih tanggal, centang status, refresh — data persist.

---

### Task 8: Recap page — tab "Kehadiran Tim" di samping "Kehadiran Siswa"

**Objective:** Volunteer bisa lihat history kehadiran anggota timnya.

**Files:**
- Modify: `src/app/(volunteer)/attendance/recap/page.tsx`

**UI:** Tab/toggle. Tab tim menampilkan tabel: kolom nama anggota × baris pertemuan, isi status emoji/badge.

---

## Phase 4 — Admin Reporting

### Task 9: Admin reports — sub-section "Kehadiran Tim per Semester"

**Files:**
- Modify: `src/app/(admin)/admin/reports/page.tsx`
- Possibly: `src/app/api/admin/team-attendance/route.ts` aggregation

**UI:** Per tim, tabel summary: anggota × jumlah hadir / izin / sakit / alfa. Highlight anomaly (alfa > 2x).

---

## Phase 5 — Migration & Cleanup

### Task 10: Migration script (opsional, jalankan sekali)

**Objective:** Untuk data existing, isi `members[]` dari field `name` lama.

**Files:**
- Create: `scripts/migrate-team-members.ts`

**Logic:**
```typescript
for (const v of await Relawan.find({ members: { $exists: false } })) {
  if (v.name) {
    v.members = [{ name: v.name, role: "FACILITATOR" }];
    await v.save();
  }
}
```

**Verify:** `db.volunteers.countDocuments({ "members.0": { $exists: true } })` matches expected.

---

### Task 11: SYSTEM_FLOW.md — section "Tim Multi-Anggota"

**Files:**
- Modify: `SYSTEM_FLOW.md`

**Content:** Dokumentasikan konsep tim, role, kehadiran tim. Update bagian §3 (Relawan / Volunteer) dan tambah §X.

---

## Open Questions (perlu konfirmasi sebelum eksekusi)

1. **Anggota bisa pindah tim?** Kalau ya, butuh ID stabil bukan name snapshot. Saya asumsi: tidak bisa, member tied ke akun tim.
2. **Apakah anggota perlu kontak email/WA per orang?** Plan saya: cuma `phone?` opsional, no email per anggota.
3. **Form attendance siswa & tim pisah save atau sekaligus?** Saran saya: pisah (less risk), tapi tombol di section yang sama.
4. **Default status kehadiran tim?** Saran: HADIR (optimis default, facilitator hanya ubah yang absen).
5. **Apakah role bisa multi?** (1 orang = pengajar + dokumentasi sekaligus) Plan saya: 1 role per slot. Kalau perlu multi, ubah jadi `roles[]`.

## Input Model: PIC-led (Facilitator)

**Decision:** Yang input attendance tim adalah **facilitator** (PIC tim). Tidak ada self-mark per anggota.

Reasoning:
- 1 akun = 1 tim, login pakai akun tim (atau akun facilitator). Tidak perlu sub-account per anggota.
- Facilitator biasanya yang paling tanggung jawab dan ingat siapa yang absen — paling realistis di lapangan.
- Volunteer organization tidak perlu sistem se-formal absensi kantor.
- Lebih sederhana implementasi: 1 form, 1 tombol save, semua anggota dicentang sekaligus.

**Konsekuensi:**
- Field `markedBy` di audit log = akun login (yang harusnya facilitator). Kalau password tim share, semua orang yang login terdeteksi sebagai 1 entitas — itu OK karena yang nanggung adalah tim.
- Admin reports tampilkan badge "Diinput oleh: [akun tim]" tanpa perlu detail siapa orangnya.

## Anti-Fraud Strategy: Combo 1+2+3

### Layer 1 — Time window strict

Facilitator hanya bisa input/edit attendance dalam window:
- Earliest: `kbmDate.date - 30 menit` (boleh prep sebelum kelas)
- Latest: `kbmDate.date + 24 jam` (toleransi telat 1 hari)

Setelah window tutup → field locked. UI tampilkan badge "Terkunci — minta admin unlock". Admin punya endpoint override yang bisa unlock per-pertemuan.

**Implementasi:**
- Server-side validation di `POST /api/volunteer/team-attendance` (cek `kbmDate.date` dari `Schedule.kbmDates`)
- UI disabled state berdasarkan window
- Admin route: `POST /api/admin/team-attendance/unlock` untuk allow late edit

### Layer 2 — Foto KBM wajib

Tombol "Simpan Kehadiran Tim" disabled sampai ada `Report` dengan `scheduleId + week + date` yang sama dan `photoUrl` non-empty.

**Implementasi:**
- Endpoint POST cek apakah `Report.findOne({ scheduleId, week, semester, photoUrl: { $ne: "" } })` exist sebelum allow save
- UI fetch dulu status report, disable button + show hint kalau belum
- Banner "Upload foto KBM dulu di halaman Reporting → baru bisa simpan kehadiran tim"

### Layer 3 — Audit log

Setiap dokumen `TeamAttendance` tambah field:
- `markedBy: ObjectId` (reference ke `Relawan` — akun login saat input)
- `markedAt: Date` (server-side)
- `markedFromIp?: string` (X-Forwarded-For, max 45 chars)
- `userAgent?: string` (truncated 200 chars)
- `editHistory: [{ at, by, prevStatus, newStatus, prevNotes }]` — track tiap edit

Admin dashboard menampilkan anomaly:
- `markedAt - kbmDate.date > 24h` → badge "Telat input"
- Edit berulang dalam waktu pendek → badge "Sering diedit"
- Foto KBM tidak ada tapi attendance saved → ini sudah di-prevent di L2, tapi kalau ada (bug/race condition), tampilkan badge "Tanpa bukti foto"

### Admin override

- Admin bisa unlock pertemuan untuk allow edit di luar window
- Admin bisa lihat full audit trail per dokumen
- Admin bisa edit attendance directly (untuk kasus khusus), tetap tercatat di `editHistory`

### Non-teknis (kebijakan)

- Komunikasikan ke tim: attendance untuk internal monitoring & raport, bukan punishment
- Disputed entry → admin review audit trail + foto KBM + cross-check anggota lain
- Privacy: IP/UA admin-only, jangan tampilkan ke volunteer

---

## Non-Goals

- Tidak mengubah cara login (tetap email/password 1 akun).
- Tidak menambah notifikasi/reminder ke anggota individu (tidak ada email per orang).
- Tidak membuat dashboard "performa per anggota" — terlalu jauh, di Phase 6+ kalau memang perlu.
- Tidak nge-track kehadiran anggota di semester lalu (data baru only).

---

## Estimasi Effort

| Phase | Task | Estimasi |
|-------|------|----------|
| 1 | Task 1-4 (schema + API backend) | ~2 jam |
| 2 | Task 5-6 (admin UI tim editor) | ~1.5 jam |
| 3 | Task 7-8 (volunteer self-attendance) | ~2 jam |
| 4 | Task 9 (admin reporting) | ~1 jam |
| 5 | Task 10-11 (migration + docs) | ~30 menit |
| **Total** | **11 tasks** | **~7 jam fokus** |

Bisa dipecah ke session, tiap phase commit terpisah.

---

## Eksekusi

Saya saranin start dari Phase 1 (schema dasar) → minta review user → lanjut Phase 2-3 → review → Phase 4-5. Jangan lompat ke UI sebelum schema clean, jangan lompat ke migration sebelum UI confirmed.

**Status:** Plan menunggu approval user. Open questions di atas perlu dijawab dulu sebelum Task 1.
