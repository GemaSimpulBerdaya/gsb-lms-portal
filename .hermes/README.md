# Hermes Agent Setup — GSB LMS Portal

Folder ini berisi konfigurasi Hermes Agent yang di-share antar developer project GSB LMS Portal. Tujuannya: tiap orang punya environment Hermes sendiri di mesin masing-masing, tapi context project (skill, konvensi, pitfall) tetap konsisten karena di-track di git.

## Apa yang ada di sini

```
.hermes/
├── README.md                      # file ini
└── skills/
    └── gsb-lms-portal/
        └── SKILL.md               # konvensi project, scoring model, pitfalls Next 16, raport quirks, dll
```

Skill `gsb-lms-portal` adalah dokumen rujukan utama buat ngerjain repo ini bareng AI agent. Isinya: build commands, scoring model post-revisi, faseConfig rules, MongoDB collection naming, auth cookies, React 19 / Turbopack pitfalls, raport PDF gotchas, UI conventions (subject label normalization, multi-photo gallery, pivot-per-variant tables), dan workflow preferences.

## Setup pertama kali (untuk developer baru)

### 1. Install Hermes Agent

```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
```

Atau ikutin docs: https://hermes-agent.nousresearch.com/docs/

### 2. Setup model & provider

```bash
hermes setup
```

Pilih provider yang lo punya API key-nya (OpenRouter, Anthropic, OpenAI, dll). Buat project ini, model yang tested: Claude Sonnet 4 / Opus 4.

### 3. Clone repo & masuk ke folder project

```bash
git clone https://github.com/GemaSimpulBerdaya/gsb-lms-portal.git
cd gsb-lms-portal
```

### 4. Symlink skill ke Hermes home (sekali aja)

Skill di repo perlu di-link ke `~/.hermes/skills/` biar Hermes auto-discover. Pilih salah satu:

**Opsi A — Symlink (recommended, auto-sync sama git pull)**

```bash
mkdir -p ~/.hermes/skills/software-development
ln -s "$(pwd)/.hermes/skills/gsb-lms-portal" ~/.hermes/skills/software-development/gsb-lms-portal
```

Tiap `git pull`, skill di Hermes ikut update otomatis. Edit skill via `skill_manage` tool juga langsung ke-track git.

**Opsi B — Copy (kalo gak mau symlink)**

```bash
mkdir -p ~/.hermes/skills/software-development
cp -r .hermes/skills/gsb-lms-portal ~/.hermes/skills/software-development/
```

Tiap ada update di repo, lo perlu copy manual lagi.

### 5. Verifikasi

```bash
hermes skills list | grep gsb-lms-portal
```

Harus muncul entry `gsb-lms-portal`.

### 6. Set up env vars project

Copy `.env.example` ke `.env.local` (atau minta dari teman tim) dan isi:
- `MONGODB_LMS_URI` — connection string MongoDB Atlas
- `INTERNAL_JWT_SECRET` — secret JWT internal (HS256)
- `LEGACY_JWT_SECRET` — secret buat verifikasi token dari `gsb-web` (student SSO)

### 7. Install dependencies & test build

```bash
npm install              # bun belum tentu ada di mesin lo
npx next build           # verifikasi build sukses
```

## Workflow harian

Buka Hermes dari folder repo, dia auto-load skill-nya:

```bash
cd ~/path/to/gsb-lms-portal
hermes
```

Atau manual load skill di session aktif:

```
/skill gsb-lms-portal
```

## Update skill

Kalo lo nemu pitfall baru, edit skill langsung pake Hermes:

```
"patch skill gsb-lms-portal: tambahin section X tentang Y"
```

Hermes pake `skill_manage(action='patch')`. File di repo ke-update langsung (kalo pakai symlink), tinggal commit + push:

```bash
git add .hermes/skills/gsb-lms-portal/SKILL.md
git commit -m "docs(skills): tambah pitfall X di gsb-lms-portal skill"
git push
```

Tim lain tinggal `git pull`, skill mereka otomatis update.

## Penting

- **Memory & sessions tetap personal**, gak di-share antar mesin. Itu di `~/.hermes/` masing-masing.
- **Skill aja yang di-share** lewat repo ini — knowledge tentang project.
- **Jangan commit `.hermes/sessions/`, `.hermes/.env`, atau auth files lain** ke repo. Yang di-track cuma folder `skills/` di sini.
- **User profile / preferences personal** (gaya komunikasi, dll) gak masuk ke skill. Itu di memory masing-masing.

## Troubleshooting

**Skill gak ke-detect Hermes**

```bash
hermes skills list
ls -la ~/.hermes/skills/software-development/gsb-lms-portal/
```

Kalo symlink broken, recreate. Kalo skill ada tapi gak muncul di list, restart session (`/reset`) atau reload (`/reload-skills`).

**Build fail di mesin baru**

Cek dulu `AGENTS.md` di root repo buat env vars + commands yang dibutuhkan. Kalo masih stuck, baca skill `gsb-lms-portal` section "Build & Run" — ada catatan tentang `bun` belum tentu installed dan workaround `npx next build`.
