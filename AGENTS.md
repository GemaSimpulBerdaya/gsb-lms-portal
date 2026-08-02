# AGENTS.md

## Project Overview

GSB LMS Portal — a Next.js 16 full-stack app (App Router, React 19) serving Super Admin (`ADMIN`), Tim Akademik (`TIM_AKADEMIK`, restricted admin area), and Volunteer/field teams (`RELAWAN`, `TIM_PEKAN`, legacy `TIM_LOKASI`/`TIM_PEKAN_1..4`). Student learning portal lives in a separate repository. Uses MongoDB (Mongoose). No test framework is configured.

`src/lib/roles.ts` is the single source of truth for role constants and gating helpers (`canAccessAdminArea`, `canAccessVolunteerPortal`, `isAcademicAllowedPath`, etc.). Reuse these instead of hardcoding role strings.

## Commands

```bash
bun dev          # dev server (port 3000)
bun run build    # production build (also serves as typecheck)
bun run lint     # eslint (next/core-web-vitals + typescript)
```

There is no test runner. Verify changes with `bun run build`.

ESLint deliberately disables noisy rules in `eslint.config.mjs` (`react-hooks/set-state-in-effect`, `@typescript-eslint/no-explicit-any`, etc.) — these are accepted legacy patterns from the React 18 → 19 / Next 16 migration. Don't re-enable them or do mass "fix any" refactors; clean up per-feature only.

One-off migration scripts live in `scripts/` (e.g. `migrate-team-location.mjs`) and load `.env.local` themselves. Run with `node scripts/<name>.mjs`.

## Environment Variables

Required in `.env.local` (not committed). See `.env.example` for the full template:
- `MONGODB_LMS_URI` — MongoDB connection string for the `gsb_lms` database
- `INTERNAL_JWT_SECRET` — signs session JWTs (HS256, 7-day expiry)

- `UPLOADTHING_TOKEN` — UploadThing API token for file storage (foto KBM, file modul, portfolio)
- `RESEND_API_KEY` — Resend mailer (forgot/reset password emails)
- `GEMINI_API_KEY` — Gemini AI (quiz generation)
- `NEXTAUTH_SECRET` / `NEXTAUTH_URL` — legacy NextAuth config (next-auth still in deps)

## Architecture

### Route Groups (App Router)

| Group | Path prefix | Role |
|-------|-------------|------|
| `(admin)` | `/admin/*` | Super Admin dashboard, CRUD |
| `(volunteer)` | `/dashboard`, `/schedule`, `/reporting`, etc. | Volunteer portal |

| `src/app/login/` | `/` (root page) | Login for Admin & Volunteer |

### API Routes (`src/app/api/`)

- `api/auth/` — login, logout, forgot/reset password
- `api/admin/` — admin CRUD (semesters, modules, volunteers, students, reports, quiz generation, grades, settings)
- `api/volunteer/` — volunteer-specific (dashboard, schedule, evaluation, attendance, modules, students)
- `api/student/` — student modules, progress, quiz
- `api/dev/` — dev utilities (do not ship to production)

### Key Directories

- `src/lib/` — DB connection (`mongodb.ts`), JWT helpers (`jwt.ts`), session utilities
- `src/models/` — Mongoose schemas domain LMS. Master mata pelajaran disimpan pada `Settings.availableSubjects`; tidak ada model `SubCategory`.
- `src/components/` — shared UI split by domain (`admin/`, `Volunteer/`, `ui/`, `Sidebar/`, etc.)
- `src/modules/` — feature modules (currently only `student/`)
- `src/utils/formatters.ts` — shared formatting helpers

### Auth & Sessions

- Admin/Volunteer: email+password login → JWT stored in `gsb_lms_session` cookie

- Session helper: `getSessionUser()` from `src/lib/session.ts`
- Route protection lives in `src/proxy.ts` (a Next.js middleware exporting `proxy` + `config.matcher`), NOT a conventional `middleware.ts`. It redirects by role using the `src/lib/roles.ts` helpers. Add new protected paths to both `VOLUNTEER_PATHS`/`PROTECTED_ROUTES` and `config.matcher`.

## Conventions

- Path alias: `@/*` maps to `./src/*`
- Styling: Tailwind CSS v4 + `tailwindcss-animate`. Brand colors under `gsb` namespace (`gsb-green`, `gsb-orange`, `gsb-sand`). Dark mode via `class` strategy.
- CSS Modules used alongside Tailwind for layout-specific styles (e.g., `relawan.module.css`, `adminLayout.module.css`)
- Package manager: both `bun.lock` and `package-lock.json` exist; prefer `bun`
- No CI workflows configured
- No pre-commit hooks

## System Design Reference

See `SYSTEM_FLOW.md` for the full end-to-end system flow documentation (in Indonesian), covering role definitions, auth flows, feature specs per role, database strategy, and FE/BE collaboration guidelines.

## Gotchas

- MongoDB connection is cached on `global.mongoose` to survive HMR — do not create additional connection helpers
- The `gsb_lms` database is on a shared MongoDB Atlas cluster alongside `gsb_main` (used by `gsb-web`). Never access `gsb_main` directly; cross-app data goes through APIs.
- Semester is a global filter context — most admin queries scope to the active semester
