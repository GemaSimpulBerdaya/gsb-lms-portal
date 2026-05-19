---
name: gsb-lms-portal
description: Conventions, pitfalls, and domain model for the GSB LMS Portal (Next.js 16 + Mongoose). Load before editing /home/aditia/gsb-lms-portal.
when_to_use:
  - User asks to edit, debug, or extend the GSB LMS Portal codebase.
  - Question is about admin/volunteer/student features, raport generator, faseConfig, attendance, or any /admin/* route.
  - cwd is `/home/aditia/gsb-lms-portal` and the request involves code, schema, or data flow.
---

# GSB LMS Portal

Next.js 16 (App Router, Turbopack) + Mongoose full-stack app for "Komunitas Gerakan Suka Baca". Three roles: Super Admin, Volunteer (Relawan), Student (SMA).

## Build & Run

`bun` is listed in `AGENTS.md` but **not installed** on this machine. Use:

- `npx next build` — verify changes (TS errors here matter)
- `npx next dev` — local dev (port 3000)
- `npx eslint src` — eslint (NOT `npx next lint` — Next 16 dropped that subcommand. `npx next lint` fails with "Invalid project directory provided, no such directory: .../lint" because Next 16 reinterprets `lint` as a positional dir arg. The repo's `package.json` script is `"lint": "eslint"`, so `bun run lint` / `npm run lint` also works.)

Node lives at `~/.config/nvm/versions/node/v20.20.2`. `gh` CLI is not installed — use plain `git push` + manual PR or merge locally.

The TS lint output may show many `TS2307: Cannot find module '@/...'` errors. These are **pre-existing** path-alias resolution failures in the standalone linter, **not real build errors**. Always verify with `npx next build` instead of trusting standalone lint.

**DO NOT run `npx next build` while a dev server is alive in the same project**. Both share `.next/`. Production build clobbers files that Turbopack's SST index references → on next HMR Turbopack panics with `Failed to open SST file ... No such file or directory`. Recovery: kill dev process, `rm -rf .next`, restart `npx next dev`. To verify TypeScript without touching `.next/`, run `npx tsc --noEmit -p tsconfig.json` instead.

## Domain Model (high-leverage facts)

### Source-of-truth: `faseConfig`

The Settings collection key `faseConfig` is the **single source of truth** for the list of fase. `availableLevels` is derived from `Object.keys(faseConfig)`. CRUD fase lives at `/admin/semesters?tab=wilayah`. `/admin/report-config` only edits the UAS/KBM/jenjang components within an existing fase.

When adding a fase from the FE, send a complete skeleton:
```js
{ jenjang: name, uasKognitif: [], uasAfektif: [], uasBInggris: null, kbmMaxPerComponent: 1400 }
```

The server validator is strict — partial objects get rejected.

### Scoring model (current, post-2026-05 revision)

- **TUGAS** per pertemuan: 3 components on 0-100 scale each — `scoreConcept` (💡 Pemahaman Konsep), `scoreQuiz` (📝 Pengerjaan Kuis), `scoreAttitude` (⭐ Sikap Pembelajaran).
  - No "skor akhir / rata-rata" displayed in input UI (removed by user request).
  - Aggregator sums per minggu, multiple meetings concatenated by week.
- **UAS Kognitif/Afektif/B.Inggris**: skala **0-100 per subject** (NOT per-fase max scores). `faseConfig` defines which subjects exist per fase but `maxScore: 100` is uniform.
  - Volunteer inputs ALL subjects sekaligus in one modal per siswa, FE loops `Promise.all` POST/PUT per subject (one record per subject in `nilai_offline`).
- **TRYOUT** (SNBT only): single score 0-100, requires `tryoutNumber` (1 or 2) + `week`.
- **UTS** has been **removed** from the input nilai UI (May 2026).
- Capaian total raport = `(totalKBM + UAS Kog + Afk + B.Inggris) / max × 100`. Predikat default: A≥70, B≥40, C<40 (unconfirmed by Edukasi team).

### MongoDB collections (explicit snake_case)

Collections use **explicit `collection: 'name'`**, NOT Mongoose default lowercase plural:
- `anak_didik` (NOT `anakdidiks`)
- `nilai_offline` (NOT `nilaioffines`)
- `relawans`, `settings`, `reports`, `subcategories`, `absensi`, `student_portfolio`

When writing direct Node debug scripts against the `gsb_lms` database, use these explicit names or queries return empty.

### Auth cookies

- `gsb_lms_session` (HS256 JWT, `INTERNAL_JWT_SECRET`, 7 days) — Admin & Volunteer
- `gsb_student_token` (verified via `LEGACY_JWT_SECRET`, 1 day) — Student SSO from `gsb-web`

These are completely separate. Don't mix `getSessionUser()` and `getStudentSession()`.

## Pitfalls

### Next 16 + Turbopack

- CSS Modules **reject bare element selectors** like `table { ... }`. Must scope: `.tableWrapper table { ... }`.

### React 19

- The pattern `const [mounted, setMounted] = useState(false); useEffect(() => setMounted(true), [])` triggers a "Calling setState synchronously within an effect" warning.
- Replacement (used in `/evaluation/page.tsx`):
  ```ts
  function useHasMounted() {
    return useSyncExternalStore(
      () => () => {},
      () => true,   // client snapshot
      () => false,  // server snapshot (SSR)
    );
  }
  ```

- **Loading flicker / "halaman ngeglitch terus" pattern** in pages that fetch faseConfig/settings async and feed it into a derived array used as a `useCallback` dep. Symptoms: page tampak loading-spinner berkedip beberapa kali setelah data tampil, terutama on first mount. Root cause chain:
  1. Async fetch (e.g. `faseConfig`) lands → state update.
  2. A `useMemo` derives an array (e.g. `uasSubjectOptions`) — this returns a **new array reference** even when values are identical (memo dep changed).
  3. That array is in `fetchGrades` (`useCallback`) deps → callback identity changes (`Object.is` ref compare).
  4. `useEffect(() => fetchGrades(), [fetchGrades])` retriggers → `setLoading(true)` → fetch → `setLoading(false)` → flicker.
  - **Fix**: never use array/object useMemo results as `useCallback` deps when they're derived from async data. Convert to a **stable string primitive key** instead:
    ```ts
    const uasSubjectsKey = useMemo(
      () => uasSubjectOptions.map((s) => s.value).sort().join("|"),
      [uasSubjectOptions]
    );
    // then use uasSubjectsKey in fetchGrades deps, not uasSubjectOptions
    ```
  - Inside the callback, derive back from key (`key.split("|")`) when the array form is needed.
  - Also: avoid `setLoading(false)` in multiple stages of a fetch chain (e.g. fetchStudents AND fetchGrades both turning it off). Pick the final stage as the sole owner; others only handle their own error path. Otherwise you get "loading on → off → on → off" toggle within one logical load.
  - **When fetches genuinely overlap** (e.g. fetchStudents starts, midway sets a state that retriggers fetchGrades useCallback, both in-flight at once), the single-owner pattern still flickers because order isn't guaranteed. Use a **counter pattern** instead:
    ```ts
    const [loadingCount, setLoadingCount] = useState(0);
    const loading = loadingCount > 0;
    const incLoading = () => setLoadingCount((c) => c + 1);
    const decLoading = () => setLoadingCount((c) => Math.max(0, c - 1));
    // In every fetch: incLoading() at start, decLoading() in finally.
    ```
    Functional updater is critical (atomic). Loading turns off only when ALL in-flight fetches complete. Used in `/evaluation/page.tsx`.

### `@react-pdf/renderer` (raport PDF)

The library only renders `<Image src={url}/>` if `url` is a **direct image binary** (Content-Type `image/*`). 

- **Drive view links** like `https://drive.google.com/file/d/{ID}/view` return HTML, NOT image bytes → falls back to placeholder "📁 link eksternal" in `Lampiran6Page` (Karya Siswa & Dokumentasi KBM).
- The check `isImgUrl(url) = /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url)` is the only thing the template trusts.
- **Quick stop-gap**: rewrite `drive.google.com/file/d/{ID}/view` → `lh3.googleusercontent.com/d/{ID}=w800` (the file must be "anyone with link" public; rate-limited at scale).
- **Production**: switch to Cloudinary. `StudentPortfolio.storageType` already supports `"CLOUDINARY"` and `"S3"` enum values.

### Backward-compat with multi-fields

`Report.photoUrl` (legacy single string) is preserved alongside `Report.photoUrls: [String]`. Both API write paths normalize: `photoUrls` is primary, `photoUrl` is `finalPhotoUrls[0]` for old code that reads a single photo. The aggregator's helper `getReportPhotos(r)` is the canonical reader (used in `reporting/page.tsx` and `reportAggregator.ts`).

### Photo upload: dual mitigation (compress on FE + filesystem upload endpoint)

The default fallback for any FE photo input is to embed `data:image/...;base64,...` strings directly in the MongoDB document. That breaks silently when multi-photo:

- Foto 5MB raw → ~6.7MB base64. Two/three photos of normal phone size exceed Next.js App Router default body parser limit (~1MB).
- Symptom: user uploads N foto, klik save, semuanya kelihatan masuk di form preview. Setelah submit + reload, hanya 1 (atau 0) yang tersimpan. **No error toast** — request body gets truncated/rejected silently before handler sees it.

**Mitigation 1 (FE) — compress at the client BEFORE state push**, so the dataURL itself is small. Apply to BOTH file-pick and camera-capture paths:

```ts
const compressDataUrl = (dataUrl: string, maxDim = 1280, quality = 0.75): Promise<string> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * ratio);
      const h = Math.round(img.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, w, h);
      try { resolve(canvas.toDataURL("image/jpeg", quality)); }
      catch { resolve(dataUrl); }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
```

Result: 5MB foto → ~150-300KB. 4-5 photos fit comfortably in one request. Applied in `/reporting/page.tsx` `handleFileChange` (resize per file via `Promise.all`) and `CameraModal.onCapture`.

**Mitigation 2 (BE) — `/api/upload` endpoint** (`src/app/api/upload/route.ts`, added May 2026). Auth-protected, validates MIME (jpeg/png/webp/gif), 15MB cap, decodes base64 → writes to `public/uploads/reports/<timestamp>-<random>.<ext>`, returns `{ url: "/uploads/reports/xxx.jpg" }`. The FE helper `resolvePhotoUrl()` POSTs to it; on success DB stores only short URL, not base64. `runtime = "nodejs"` (needs `fs`).

`public/uploads/` is gitignored.

**Deployment caveat**: filesystem is ephemeral on Vercel/Netlify — uploaded photos disappear on each deploy. For those targets, swap the endpoint body to push to Cloudinary/R2/S3 (schema already has `StudentPortfolio.storageType` enum with `"CLOUDINARY"` / `"S3"`).

The compress step on FE is still useful even with the upload endpoint — it reduces upload time and storage cost.

## Routing reference

| Group         | Path prefix                                      | Role          |
|---------------|--------------------------------------------------|---------------|
| `(admin)`     | `/admin/*`                                       | ADMIN         |
| `(volunteer)` | `/dashboard`, `/schedule`, `/evaluation`, etc.   | RELAWAN       |
| `student/`    | `/student/*`                                     | SMA (SSO)     |
| `login/`      | `/` (root page)                                  | login form    |

API routes mirror role: `/api/admin/*`, `/api/volunteer/*`, `/api/student/*`, plus shared `/api/auth/*` and `/api/reports`.

## User workflow preferences

- **Do NOT auto-commit or push** after edits. User reviews manually, then gives explicit commit/push instructions.
- User often prefers **a single coherent commit** over splitting into multiple thematic commits, even when offered the choice. Default to one commit unless the changes are clearly orthogonal.
- User communicates in casual Bahasa Indonesia mixed with English tech terms. Short directives expected.
- Throwaway debug scripts (e.g. `probe-db.cjs`, `check-*.cjs` that read `.env.local`) should be **deleted, not committed**. They're not git-ignored by default.
- **Delete unused / legacy code** when found, don't leave dormant. User explicitly: "komponen kalau gadipake hapusajaterus". Examples from past edits: removed `selectedKuis` state + dep array (legacy preset never wired to UI), removed `UTS` from `EVAL_TYPES`, removed avg-calc when "Rata-rata" column was dropped. When refactoring or trimming UI, also clean up the supporting state, helpers, and CSS classes that became unreachable. Don't keep "just in case" stubs.

## UI conventions

### Subject label normalization (`BINDO`, `BING`, etc.)

Internal subject **codes** (DB enum values, also used as `value` field in form options) follow a short uppercase convention:
- `BINDO` (Bahasa Indonesia)
- `BING` (Bahasa Inggris)
- `NUMERASI`, `SAINS`, `MANDIRI`, `BERNALAR_KRITIS`, `KREATIF`, etc.

These codes MUST NOT leak into UI display as-is. User explicitly disallowed showing "BINDO" / "BING" in tables, headers, modals, badges. **Always render labels through a normalizer**:

```ts
function formatSubjectLabel(rawLabel: string, opts?: { stripPrefix?: boolean }): string {
  let label = (rawLabel || "").trim();
  label = label.replace(/\bBINDO\b/gi, "B.Indo");
  label = label.replace(/\bBING\b/gi, "B.Inggris");
  label = label.replace(/Bahasa Indonesia/gi, "B.Indo");
  label = label.replace(/Bahasa Inggris/gi, "B.Inggris");
  if (opts?.stripPrefix) label = label.replace(/^Literasi\s+/i, "");
  return label;
}
```

Approved short forms: `B.Indo`, `B.Inggris` (with periods, exact casing). NEVER use `BIndo`, `BInggris`, `Bhs Indo`, `B Indonesia`, `Eng`. The label **prefix `Literasi `** can be stripped in tight contexts (table column headers when the tab title already says "UAS Literasi") via `stripPrefix: true`, but kept in modals / detail views.

The normalizer must handle BOTH sources:
1. Hardcoded fallback labels in code (already correct, but defensive).
2. faseConfig labels saved by admin via `/admin/report-config` — admins sometimes save raw codes ("BINDO") instead of full labels. The normalizer makes display consistent regardless.

Apply at every render site: table `<th>`, score chips, modal labels, status badges, raport PDF (when relevant).

### Multi-photo display: gallery slider, not grid

For a record with N>1 photos, do NOT render them all as a grid of thumbnails (forces user to click each one to actually see it). Use a **gallery slider component**:

- Main image area (16:10 aspect, large, click → fullscreen zoom)
- Nav arrows left/right (looping)
- Counter chip "2/5" + dedicated zoom button overlayed on main
- Horizontal thumbnail strip below main, active thumb highlighted (red brand border + filled opacity), inactive dim
- For single-photo records, render plain (no controls). Branch by `photos.length === 1`.

Reference implementation: `PhotoGallery` component in `/reporting/page.tsx`. CSS classes prefixed `gallery*` in `report.module.css`. Reset `activeIdx` on photo-array change so opening detail for a different report starts at idx 0.

### Multi-variant rows: pivot horizontally, don't stack vertically

When a single entity (e.g. a student) has N parallel sub-records to display (e.g. UAS subjects: Numerasi/Sains/BINDO), DO NOT render them as vertical stacks of sub-cells inside shared columns (Status / Keterangan / Rincian / Skor). That produces tower-tall rows that are visually messy and hard to scan.

Instead, **pivot per-variant as a column**:

```
| Siswa | Kategori | Numerasi | Sains | BINDO | Rata² | Status   | Aksi |
| Andi  | Reguler  | 85       | 72    | 90    | 82    | LENGKAP  | Edit |
| Budi  | Reguler  | —        | —     | —     | —     | KOSONG   | Input|
```

Pattern:
- Build `gradeBySubject: Record<subject, Grade>` lookup once per row.
- Map subject options → render one `<td>` per subject (skor pill or "—").
- Add aggregate columns (rata², status `LENGKAP` / `n/total` / `BELUM DINILAI`).
- Single action button per row, not per sub-record.

For the original layout (TUGAS / TRYOUT — multiple records per pekan, not parallel variants), vertical stacking is still appropriate. Branch the table by `dbType` at render-time. See `/evaluation/page.tsx` UAS branch for reference.

## See also

- `AGENTS.md` in repo root — build commands, env vars, conventions (always loaded as project context)
- `SYSTEM_FLOW.md` in repo root — full end-to-end flow including raport spec (§9)
- `public/raport/*.pdf` — 8 reference rapor samples that the PDF generator must replicate
