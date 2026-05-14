# AGENTS.md

## Project Overview

GSB LMS Portal — a Next.js 16 full-stack app (App Router) serving three user roles: Super Admin, Volunteer (Relawan), and Student (Siswa). Uses MongoDB (Mongoose) as the database. No test framework is configured.

## Commands

```bash
bun dev          # dev server (port 3000)
bun run build    # production build (also serves as typecheck)
bun run lint     # eslint (next/core-web-vitals + typescript)
```

There is no test runner. Verify changes with `bun run build`.

## Environment Variables

Required in `.env.local` (not committed):
- `MONGODB_LMS_URI` — MongoDB connection string for the `gsb_lms` database
- `INTERNAL_JWT_SECRET` — signs session JWTs (HS256, 7-day expiry)
- `LEGACY_JWT_SECRET` — verifies tokens from the external `gsb-web` app (student SSO)

## Architecture

### Route Groups (App Router)

| Group | Path prefix | Role |
|-------|-------------|------|
| `(admin)` | `/admin/*` | Super Admin dashboard, CRUD |
| `(volunteer)` | `/dashboard`, `/schedule`, `/reporting`, etc. | Volunteer portal |
| `src/app/student/` | `/student/*` | Student portal (SSO entry) |
| `src/app/login/` | `/` (root page) | Login for Admin & Volunteer |

### API Routes (`src/app/api/`)

- `api/auth/` — login, logout, forgot/reset password
- `api/admin/` — admin CRUD (semesters, modules, volunteers, students, reports, quiz generation, grades, settings)
- `api/volunteer/` — volunteer-specific (dashboard, schedule, evaluation, attendance, modules, students)
- `api/student/` — student modules, progress, quiz
- `api/dev/` — dev utilities (do not ship to production)

### Key Directories

- `src/lib/` — DB connection (`mongodb.ts`), JWT helpers (`jwt.ts`), session utilities
- `src/models/` — Mongoose schemas (Relawan, AnakDidik, Report, Schedule, Attendance, Settings, SMA, Core, SubCategory)
- `src/components/` — shared UI split by domain (`admin/`, `Volunteer/`, `ui/`, `Sidebar/`, etc.)
- `src/modules/` — feature modules (currently only `student/`)
- `src/utils/formatters.ts` — shared formatting helpers

### Auth & Sessions

- Admin/Volunteer: email+password login → JWT stored in `gsb_lms_session` cookie
- Student: SSO token from `gsb-web` verified with `LEGACY_JWT_SECRET`, separate session in `student-session.ts`
- Session helper: `getSessionUser()` from `src/lib/session.ts`

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
- No `.env.example` exists; refer to the env vars section above
