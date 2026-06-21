import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { isAdminRole } from "@/lib/roles";
import { withModuleManager } from "@/lib/apiAuth";
import { Settings } from "@/models/Settings";
import {
  DEFAULT_AVAILABLE_REGIONS,
  DEFAULT_AVAILABLE_SUBJECTS,
  DEFAULT_FASE_CONFIG,
  DEFAULT_REPORT_RUBRIC,
  type FaseConfig,
  type UasComponent,
  type ReportRubric,
  type PredikatTier,
} from "@/lib/reportDefaults";

const DEFAULT_AVAILABLE_SEMESTERS: string[] = [];
const DEFAULT_SEMESTER_LABELS = {
  "2026-1": "2026: Januari - Juni",
  "2026-2": "2026: Juli - Desember",
  "2027-1": "2027: Januari - Juni",
  "2027-2": "2027: Juli - Desember",
};

export async function GET() {
  try {
    await connectDB();
    const settings = await Settings.find({});
    
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, unknown>);

    // Defaults
    if (!settingsMap.activeSemester) {
      const d = new Date();
      const defaultValue = `${d.getFullYear()}-1`;
      await Settings.create({ key: "activeSemester", value: defaultValue });
      settingsMap.activeSemester = defaultValue;
    }

    if (!settingsMap.availableSemesters) {
      await Settings.create({ key: "availableSemesters", value: DEFAULT_AVAILABLE_SEMESTERS });
      settingsMap.availableSemesters = DEFAULT_AVAILABLE_SEMESTERS;
    } else if (Array.isArray(settingsMap.availableSemesters)) {
      const currentSemesters = settingsMap.availableSemesters as unknown[];
      const needsUpdate =
        currentSemesters.length !== DEFAULT_AVAILABLE_SEMESTERS.length ||
        DEFAULT_AVAILABLE_SEMESTERS.some((sem) => !currentSemesters.includes(sem));

      if (needsUpdate) {
        await Settings.findOneAndUpdate(
          { key: "availableSemesters" },
          { value: DEFAULT_AVAILABLE_SEMESTERS },
          { upsert: true }
        );
        settingsMap.availableSemesters = DEFAULT_AVAILABLE_SEMESTERS;
      }
    }

    if (!settingsMap.semesterLabels) {
      await Settings.create({ key: "semesterLabels", value: DEFAULT_SEMESTER_LABELS });
      settingsMap.semesterLabels = DEFAULT_SEMESTER_LABELS;
    }

    // Konfigurasi komponen UAS per fase. Ini SOURCE OF TRUTH untuk daftar fase.
    // `availableLevels` di-derive dari Object.keys(faseConfig).
    if (!settingsMap.faseConfig) {
      await Settings.create({ key: "faseConfig", value: DEFAULT_FASE_CONFIG });
      settingsMap.faseConfig = DEFAULT_FASE_CONFIG;
    }

    // Derive availableLevels dari faseConfig — single source of truth.
    settingsMap.availableLevels = Object.keys(settingsMap.faseConfig as object).sort();

    // Hapus entri lama `availableLevels` di DB kalau ada (migrasi).
    // Sebelumnya availableLevels disimpan terpisah dan bisa drift dari faseConfig.
    Settings.deleteOne({ key: "availableLevels" }).catch(() => {});

    if (!settingsMap.availableRegions) {
      await Settings.create({ key: "availableRegions", value: DEFAULT_AVAILABLE_REGIONS });
      settingsMap.availableRegions = DEFAULT_AVAILABLE_REGIONS;
    }

    if (!settingsMap.availableSubjects) {
      await Settings.create({ key: "availableSubjects", value: DEFAULT_AVAILABLE_SUBJECTS });
      settingsMap.availableSubjects = DEFAULT_AVAILABLE_SUBJECTS;
    }

    // Konfigurasi komponen UAS per fase (kognitif, afektif, B.Inggris, kbmMax).
    // Dipakai generator raport untuk membentuk Bagian 02 & Lampiran 3-5.
    // (Sudah di-init di atas sebagai source of truth untuk availableLevels.)

    // Predikat threshold + narasi 3 tier + teks kehadiran untuk Bagian 02 & 03.
    if (!settingsMap.reportRubric) {
      await Settings.create({ key: "reportRubric", value: DEFAULT_REPORT_RUBRIC });
      settingsMap.reportRubric = DEFAULT_REPORT_RUBRIC;
    }

    return NextResponse.json(settingsMap);
  } catch {
    return NextResponse.json({ error: "Gagal mengambil pengaturan" }, { status: 500 });
  }
}

// --- Validators ---
// Hanya berlaku untuk key tertentu yang punya struktur kompleks.
// Key-key sederhana (string/array of string) tidak divalidasi di sini.

function isUasComponent(x: unknown): x is UasComponent {
  if (!x || typeof x !== "object") return false;
  const u = x as Record<string, unknown>;
  return (
    typeof u.subject === "string" &&
    typeof u.label === "string" &&
    typeof u.maxScore === "number" &&
    (u.maxScore as number) >= 0
  );
}

function validateFaseConfig(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "faseConfig harus berupa objek { faseName: FaseConfig }.";
  }
  for (const [name, cfg] of Object.entries(value as Record<string, unknown>)) {
    if (!cfg || typeof cfg !== "object") {
      return `Fase "${name}" bukan objek.`;
    }
    const c = cfg as Partial<FaseConfig>;
    if (typeof c.jenjang !== "string" || !c.jenjang.trim()) {
      return `Fase "${name}": field 'jenjang' wajib diisi.`;
    }
    if (typeof c.kbmMaxPerComponent !== "number" || c.kbmMaxPerComponent < 0) {
      return `Fase "${name}": 'kbmMaxPerComponent' harus angka >= 0.`;
    }
    if (!Array.isArray(c.uasKognitif) || !c.uasKognitif.every(isUasComponent)) {
      return `Fase "${name}": 'uasKognitif' harus array komponen { subject, label, maxScore }.`;
    }
    if (!Array.isArray(c.uasAfektif) || !c.uasAfektif.every(isUasComponent)) {
      return `Fase "${name}": 'uasAfektif' harus array komponen { subject, label, maxScore }.`;
    }
    if (c.uasBInggris !== null && c.uasBInggris !== undefined) {
      if (
        typeof c.uasBInggris !== "object" ||
typeof (c.uasBInggris as { maxScore?: number }).maxScore !== "number" ||
          (c.uasBInggris as { maxScore?: number }).maxScore! < 0
      ) {
        return `Fase "${name}": 'uasBInggris' harus null atau { maxScore: number }.`;
      }
    }
    // Cek subject tidak kosong / duplikat
    const subjects = [...c.uasKognitif!, ...c.uasAfektif!].map((u) => u.subject);
    if (subjects.some((s) => !s.trim())) {
      return `Fase "${name}": ada komponen dengan 'subject' kosong.`;
    }
    const dup = subjects.find((s, i) => subjects.indexOf(s) !== i);
    if (dup) {
      return `Fase "${name}": subject "${dup}" duplikat antar komponen.`;
    }
  }
  return null;
}

function validateReportRubric(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return "reportRubric harus berupa objek.";
  }
  const r = value as Partial<ReportRubric>;

  if (!Array.isArray(r.predikat) || r.predikat.length === 0) {
    return "reportRubric.predikat harus array tidak kosong.";
  }
  for (const p of r.predikat as PredikatTier[]) {
    if (!p || typeof p !== "object") return "Tier predikat tidak valid.";
    if (!["A", "B", "C"].includes(p.code as string)) {
      return `Tier code harus 'A' | 'B' | 'C', dapat: ${p.code}.`;
    }
    if (typeof p.label !== "string" || !p.label.trim()) {
      return `Tier ${p.code}: 'label' wajib diisi.`;
    }
    if (typeof p.minPct !== "number" || p.minPct < 0 || p.minPct > 100) {
      return `Tier ${p.code}: 'minPct' harus 0-100.`;
    }
    if (typeof p.description !== "string") {
      return `Tier ${p.code}: 'description' harus string.`;
    }
  }

  if (!r.narasi || typeof r.narasi !== "object") {
    return "reportRubric.narasi harus objek.";
  }
  for (const code of ["A", "B", "C"] as const) {
    const n = (r.narasi as Record<string, unknown>)[code];
    if (!n || typeof n !== "object") {
      return `narasi.${code} wajib ada.`;
    }
    for (const k of [
      "kognitif",
      "sikap",
      "rekomendasiSiswa",
      "rekomendasiOrtu",
    ] as const) {
      if (typeof (n as Record<string, unknown>)[k] !== "string") {
        return `narasi.${code}.${k} harus string.`;
      }
    }
  }

  if (!r.kehadiran || typeof r.kehadiran !== "object") {
    return "reportRubric.kehadiran harus objek.";
  }
  if (
    typeof r.kehadiran.target !== "number" ||
    r.kehadiran.target < 0 ||
    r.kehadiran.target > 100
  ) {
    return "kehadiran.target harus 0-100.";
  }
  if (typeof r.kehadiran.narasiTinggi !== "string") {
    return "kehadiran.narasiTinggi harus string.";
  }
  if (typeof r.kehadiran.narasiRendah !== "string") {
    return "kehadiran.narasiRendah harus string.";
  }

  return null;
}

export const POST = withModuleManager(async (request, session) => {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Body harus objek." }, { status: 400 });
    }
    const bodyKeys = Object.keys(body);

    if (!isAdminRole(session.role) && bodyKeys.some((key) => key !== "availableSubjects")) {
      return NextResponse.json(
        { error: "Tim Akademik hanya boleh mengubah mata pelajaran di area modul." },
        { status: 403 }
      );
    }

    // availableLevels sekarang derived dari faseConfig — tidak boleh ditulis langsung.
    if ("availableLevels" in body) {
      return NextResponse.json(
        {
          error:
            "availableLevels tidak dapat ditulis langsung. Daftar fase di-derive otomatis dari faseConfig — tambah/hapus fase lewat /admin/report-config.",
        },
        { status: 400 }
      );
    }

    // Validasi key kompleks sebelum disimpan supaya rapor tidak corrupt.
    if ("faseConfig" in body) {
      const err = validateFaseConfig(body.faseConfig);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if ("reportRubric" in body) {
      const err = validateReportRubric(body.reportRubric);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if ("semesterLabels" in body) {
      const v = body.semesterLabels;
      if (!v || typeof v !== "object" || Array.isArray(v)) {
        return NextResponse.json(
          { error: "semesterLabels harus objek key→label." },
          { status: 400 }
        );
      }
      for (const [k, label] of Object.entries(v)) {
        if (typeof label !== "string") {
          return NextResponse.json(
            { error: `Label untuk ${k} harus string.` },
            { status: 400 }
          );
        }
      }
    }
    if ("availableRegions" in body) {
      if (
        !Array.isArray(body.availableRegions) ||
        !body.availableRegions.every((r: unknown) => typeof r === "string" && r.trim())
      ) {
        return NextResponse.json(
          { error: "availableRegions harus array string tidak kosong." },
          { status: 400 }
        );
      }
      body.availableRegions = Array.from(
        new Set((body.availableRegions as string[]).map((r: string) => r.trim()).filter(Boolean))
      );
    }
    if ("availableSubjects" in body) {
      if (
        !Array.isArray(body.availableSubjects) ||
        !body.availableSubjects.every((s: unknown) => typeof s === "string" && s.trim())
      ) {
        return NextResponse.json(
          { error: "availableSubjects harus array string tidak kosong." },
          { status: 400 }
        );
      }
      body.availableSubjects = Array.from(
        new Set((body.availableSubjects as string[]).map((s: string) => s.trim()).filter(Boolean))
      );
    }

    await connectDB();

    const updates = Object.entries(body).map(([key, value]) => {
      return Settings.findOneAndUpdate(
        { key },
        { value },
        { upsert: true, new: true }
      );
    });

    await Promise.all(updates);

    return NextResponse.json({ message: "Pengaturan diperbarui" });
  } catch {
    return NextResponse.json({ error: "Gagal memperbarui pengaturan" }, { status: 500 });
  }
});
