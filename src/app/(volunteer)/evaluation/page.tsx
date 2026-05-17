"use client";

import { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import styles from "./inputNilai.module.css";
import Modal from "@/components/ui/Modal/Modal";

// ─── Types ────────────────────────────────────────────────────────────────────
type Student = {
  _id: string;
  name: string;
  region: string;
  category: string;
  parentName?: string;
};

type Schedule = {
  _id: string;
  region: string;
  level: string;
  semester: string;
  activeWeek: number;
};

type Grade = {
  _id: string;
  anakDidikId: Student | string;
  type: "TUGAS" | "UJIAN" | "KUIS" | "UTS" | "UAS" | "TRYOUT";
  week?: number;
  score: number;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
  subject?: string | null;
  maxScore?: number | null;
  tryoutNumber?: number | null;
  semester: string;
  notes?: string;
  title?: string;
  createdAt: string;
};

// ─── Evaluation Type Options ─────────────────────────────────────────────────
// UAS_LITERASI & UAS_BING dikelompokkan ke satu tipe DB "UAS" + subject
const EVAL_TYPES = [
  { value: "TUGAS", label: "KBM Pekanan (Tugas)", dbType: "TUGAS" },
  { value: "UAS_LIT_KOG", label: "UAS Literasi — Kognitif", dbType: "UAS" },
  { value: "UAS_LIT_AFK", label: "UAS Literasi — Afektif", dbType: "UAS" },
  { value: "UAS_BING", label: "UAS Bahasa Inggris", dbType: "UAS" },
  { value: "TRYOUT", label: "Try Out (SNBT)", dbType: "TRYOUT" },
] as const;

type EvalTypeValue = (typeof EVAL_TYPES)[number]["value"];

// Fallback subjects — dipakai hanya kalau faseConfig untuk level schedule
// aktif belum dimuat / tidak punya komponen yang dimaksud. Sumber utama
// daftar subject UAS adalah `faseConfig` dari /api/admin/settings, supaya
// input nilai SELALU klop dengan rekap & raport.
type UasSubjectOption = { value: string; label: string; defaultMax: number };

// Normalisasi label subject untuk display.
// Kasus: label di faseConfig kadang disimpan mentah (mis. "BINDO", "BING"),
// kadang full ("Literasi Bahasa Indonesia"). Helper ini bikin tampilan
// konsisten — singkatan rapi B.Indo / B.Inggris, dan strip prefix
// "Literasi" karena context tab UAS sudah jelas.
function formatSubjectLabel(rawLabel: string, opts?: { stripPrefix?: boolean }): string {
  let label = (rawLabel || "").trim();
  // Normalisasi singkatan internal
  label = label.replace(/\bBINDO\b/gi, "B.Indo");
  label = label.replace(/\bBING\b/gi, "B.Inggris");
  // Singkatan untuk Bahasa
  label = label.replace(/Bahasa Indonesia/gi, "B.Indo");
  label = label.replace(/Bahasa Inggris/gi, "B.Inggris");
  if (opts?.stripPrefix) {
    label = label.replace(/^Literasi\s+/i, "");
  }
  return label;
}

const FALLBACK_UAS_LIT_KOGNITIF: UasSubjectOption[] = [
  { value: "NUMERASI", label: "Literasi Numerasi", defaultMax: 100 },
  { value: "SAINS", label: "Literasi Sains", defaultMax: 100 },
  { value: "BINDO", label: "Literasi B.Indo", defaultMax: 100 },
];
const FALLBACK_UAS_LIT_AFEKTIF: UasSubjectOption[] = [
  { value: "MANDIRI", label: "Mandiri", defaultMax: 100 },
  { value: "BERNALAR_KRITIS", label: "Bernalar Kritis", defaultMax: 100 },
  { value: "KREATIF", label: "Kreatif", defaultMax: 100 },
];
const FALLBACK_UAS_BING: UasSubjectOption[] = [
  { value: "BING", label: "B.Inggris", defaultMax: 100 },
];

// Bentuk komponen UAS yang datang dari faseConfig
type FaseUasComponent = { subject: string; label: string; maxScore: number };
type FaseConfigEntry = {
  jenjang: string;
  uasKognitif: FaseUasComponent[];
  uasAfektif: FaseUasComponent[];
  uasBInggris: { maxScore: number } | null;
  kbmMaxPerComponent: number;
};

type Toast = { type: "success" | "error"; message: string } | null;

// Hydration helper — pakai useSyncExternalStore. Server snapshot selalu
// `false`, client snapshot selalu `true`. Tidak setState dalam effect, jadi
// aman dari warning React 19 "Calling setState synchronously within an effect".
function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {}, // subscribe noop — value tidak pernah berubah setelah mount
    () => true, // client snapshot
    () => false // server snapshot (initial render & SSR)
  );
}

export default function InputNilaiPage() {
  // Hydration guard — render null sampai komponen ter-mount di client
  // supaya state localStorage-driven (mis. selectedSemester) tidak bikin
  // hydration mismatch. Pakai useSyncExternalStore-style: subscribe to
  // mount status tanpa setState in effect (React 19 friendly).
  const hasMounted = useHasMounted();

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");

  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  // Loading sebagai counter aktif fetch — increment saat start, decrement
  // saat finish. Loading dianggap aktif kalau counter > 0. Pattern ini aman
  // dari race antara fetchStudents & fetchGrades yang overlapping (mis.
  // setSelectedWeek di tengah students-fetch retrigger fetchGrades useCallback).
  const [loadingCount, setLoadingCount] = useState(0);
  const loading = loadingCount > 0;
  const incLoading = () => setLoadingCount((c) => c + 1);
  const decLoading = () => setLoadingCount((c) => Math.max(0, c - 1));
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<Toast>(null);

  // Global Filter states (used to fetch grades & prefill forms)
  const getCurrentSemester = () => {
    const d = new Date();
    return `${d.getFullYear()}-1`;
  };

  const [selectedSemester, setSelectedSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });

  // Keep localStorage in sync when changed locally
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", selectedSemester);
    }
  }, [selectedSemester]);

  // Sync with global semester only on initial mount
  useEffect(() => {
    const fetchGlobalSemester = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.availableSemesters) setAvailableSemesters(data.availableSemesters);
          
          const stored = localStorage.getItem("activeSemester");
          if (data.activeSemester && (!stored || stored === getCurrentSemester())) {
            setSelectedSemester(data.activeSemester);
            localStorage.setItem("activeSemester", data.activeSemester);
          }
        }
      } catch (err) {
        console.error("Gagal sync semester global", err);
      }
    };

    fetchGlobalSemester();

    const handleStorage = () => {
      const active = localStorage.getItem("activeSemester");
      if (active && active !== selectedSemester) {
        setSelectedSemester(active);
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []); // Empty dependency array to run only once
  const [selectedType, setSelectedType] = useState<EvalTypeValue>("TUGAS");
  const [selectedWeek, setSelectedWeek] = useState("1"); // for TUGAS & TRYOUT
  const [selectedTryout, setSelectedTryout] = useState("1"); // Try Out #1 / #2

  // ─── faseConfig (source of truth dari /admin/report-config) ───────────────
  // Fetch saat mount, dipakai untuk turunkan daftar subject UAS + maxScore.
  const [faseConfig, setFaseConfig] = useState<Record<string, FaseConfigEntry>>(
    {}
  );
  useEffect(() => {
    const fetchFaseConfig = async () => {
      try {
        const res = await fetch("/api/admin/settings");
        if (res.ok) {
          const data = await res.json();
          if (data.faseConfig && typeof data.faseConfig === "object") {
            setFaseConfig(data.faseConfig as Record<string, FaseConfigEntry>);
          }
        }
      } catch (err) {
        console.error("Gagal load faseConfig", err);
      }
    };
    fetchFaseConfig();
  }, []);

  const currentEvalMeta = EVAL_TYPES.find((t) => t.value === selectedType)!;
  const dbType = currentEvalMeta.dbType;

  // Detect SNBT class (kelas online SNBT) from selected schedule's level
  const currentSched = schedules.find((s) => s._id === selectedScheduleId);
  const isSnbtClass = Boolean(
    currentSched?.level && /snbt/i.test(currentSched.level)
  );

  // ─── Daftar subject UAS — DERIVED dari faseConfig per level schedule ──────
  // Kalau level schedule punya entry di faseConfig, pakai komponen dari sana.
  // Kalau tidak ada (mis. pre-seed atau fase belum dikonfigurasi), pakai
  // fallback hardcoded supaya volunteer tidak terblokir.
  const currentFase: FaseConfigEntry | null = useMemo(() => {
    if (currentSched?.level && faseConfig[currentSched.level]) {
      return faseConfig[currentSched.level];
    }
    return null;
  }, [currentSched?.level, faseConfig]);

  const uasSubjectOptions: UasSubjectOption[] = useMemo(() => {
    if (selectedType === "UAS_LIT_KOG") {
      if (currentFase && currentFase.uasKognitif.length > 0) {
        return currentFase.uasKognitif.map((c) => ({
          value: c.subject,
          label: c.label,
          defaultMax: c.maxScore,
        }));
      }
      return FALLBACK_UAS_LIT_KOGNITIF;
    }
    if (selectedType === "UAS_LIT_AFK") {
      if (currentFase && currentFase.uasAfektif.length > 0) {
        return currentFase.uasAfektif.map((c) => ({
          value: c.subject,
          label: c.label,
          defaultMax: c.maxScore,
        }));
      }
      return FALLBACK_UAS_LIT_AFEKTIF;
    }
    if (selectedType === "UAS_BING") {
      if (currentFase && currentFase.uasBInggris) {
        return [
          {
            value: "BING",
            label: "UAS Bahasa Inggris (Total)",
            defaultMax: currentFase.uasBInggris.maxScore,
          },
        ];
      }
      return FALLBACK_UAS_BING;
    }
    return [];
  }, [selectedType, currentFase]);

  // Stable string key untuk dipakai sebagai dep `fetchGrades`.
  // useMemo `uasSubjectOptions` ngebalikin array baru tiap kali `currentFase`
  // berubah ref (mis. pas faseConfig selesai load async). Kalau pakai
  // array itu langsung sebagai dep useCallback, fetchGrades re-create
  // walau values sama → useEffect retrigger → loading flicker. Pakai
  // string primitif: "" untuk non-UAS, "FOO|BAR" untuk UAS — equal by value.
  const uasSubjectsKey = useMemo(
    () => uasSubjectOptions.map((s) => s.value).sort().join("|"),
    [uasSubjectOptions]
  );

  const faseHasUasBing = Boolean(currentFase?.uasBInggris);
  const faseConfigured = Boolean(currentFase);

  const isUasType = selectedType.startsWith("UAS_");

  const evalTypes = EVAL_TYPES.filter((t) => {
    // TRYOUT hanya muncul untuk kelas SNBT
    if (t.value === "TRYOUT" && !isSnbtClass) return false;
    // UAS_BING hanya muncul kalau fase punya komponen B.Inggris.
    // Fase TUNAS/PUCUK/PELITA tidak punya UAS B.Inggris (uasBInggris = null).
    if (t.value === "UAS_BING" && faseConfigured && !faseHasUasBing) {
      return false;
    }
    return true;
  });

  const isReadOnly = selectedSemester !== getCurrentSemester();

  // Form Modal states
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  
  const [formScore, setFormScore] = useState(0);
  const [formScoreConcept, setFormScoreConcept] = useState(0);
  const [formScoreQuiz, setFormScoreQuiz] = useState(0);
  const [formScoreAttitude, setFormScoreAttitude] = useState(0);
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  // UAS-specific state — sekarang multi-subject:
  // user input semua subject sekaligus, skala 0-100 per subject.
  // Saat save: loop semua entry, upsert per subject.
  const [formUasScores, setFormUasScores] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete states
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // ─── Utils ──────────────────────────────────────────────────────────────────
  const showToast = (type: "success" | "error", message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3500);
  };

  // 1. Fetch Schedules on mount + saat semester berubah
  // Tidak pakai `mounted` state lagi — itu pattern lama yang trigger
  // warning React 19 "setState within effect". `useEffect` dengan dependency
  // [selectedSemester] sudah cukup karena React jamin effect cuma jalan
  // setelah mount + setiap kali dependency berubah.
  useEffect(() => {
    const fetchSchedules = async () => {
      try {
        const res = await fetch("/api/volunteer/schedule");
        const data = await res.json();
        if (res.ok && data.schedules) {
          setSchedules(data.schedules);

          const activeSchedules = data.schedules.filter((s: any) => s.semester === selectedSemester);
          if (activeSchedules.length > 0) {
            const current = activeSchedules.find((s: any) => s._id === selectedScheduleId) || activeSchedules[0];
            setSelectedScheduleId(current._id);
          } else {
            setSelectedScheduleId("");
          }
        }
      } catch (err) {
        console.error("Gagal memuat jadwal", err);
      }
    };
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSemester]);

  // 2. Fetch Students when selected Schedule changes
  useEffect(() => {
    const fetchStudentsForSchedule = async () => {
      const sched = schedules.find(s => s._id === selectedScheduleId);
      if (!sched) return;

      incLoading();
      try {
        const studentParams = new URLSearchParams({ region: sched.region, level: sched.level });
        const resStudents = await fetch(`/api/volunteer/students?${studentParams}`);
        const dataStudents = await resStudents.json();

        if (!resStudents.ok) throw new Error(dataStudents.error || "Gagal memuat data siswa");
        setStudents(dataStudents.students || []);
      } catch (err: any) {
        console.error("Gagal memuat data siswa", err);
        showToast("error", err.message);
        setStudents([]);
      } finally {
        decLoading();
      }
    };

      if (selectedScheduleId) {
      fetchStudentsForSchedule();

      const sched = schedules.find(s => s._id === selectedScheduleId);
      if (sched) {
        if (selectedType === "TUGAS" || selectedType === "TRYOUT") {
          setSelectedWeek(sched.activeWeek.toString());
        }
      }
    } else {
      setStudents([]);
    }
  }, [selectedScheduleId, schedules]);

  // 3. Fetch Grades when filters change
  const fetchGrades = useCallback(async () => {
    if (students.length === 0) {
      setGrades([]);
      return;
    }

    incLoading();
    try {
      const query = new URLSearchParams();
      query.append("semester", selectedSemester);
      query.append("type", dbType);
      
      // Filter by Week for TUGAS/TRYOUT, all subjects for UAS, title for KUIS
      if ((dbType === "TUGAS" || dbType === "TRYOUT") && selectedWeek) {
        query.append("week", selectedWeek);
      }
      if (dbType === "TRYOUT") {
        query.append("tryoutNumber", selectedTryout);
      }
      // Note: untuk UAS sengaja TIDAK filter by subject — semua subject (sesuai
      // tipe Kognitif/Afektif/B.Inggris) akan ditampilkan bareng di tabel.

      const res = await fetch(`/api/volunteer/evaluation?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        // Untuk UAS: filter di client-side berdasarkan tipe (kog/afk/bing)
        // supaya hanya subject yg relevan saja yg tampil.
        let filtered = data.nilai || [];
        if (dbType === "UAS") {
          const allowedSubjects = uasSubjectsKey ? uasSubjectsKey.split("|") : [];
          filtered = filtered.filter((g: Grade) =>
            g.subject && allowedSubjects.includes(g.subject)
          );
        }
        setGrades(filtered);
      } else {
        setGrades([]);
      }
    } catch (err) {
      console.error("Gagal memuat data nilai", err);
      setGrades([]);
    } finally {
      decLoading();
    }
  }, [selectedSemester, selectedType, dbType, selectedWeek, selectedTryout, students, uasSubjectsKey]);

  useEffect(() => {
    fetchGrades();
  }, [fetchGrades]);

  // Lock body scroll when modal open
  useEffect(() => {
    document.body.style.overflow = (formOpen || deleteId) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, deleteId]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  const handleOpenForm = (student: Student, existingGrade?: Grade) => {
    setActiveStudent(student);

    if (existingGrade) {
      setEditId(existingGrade._id);
      setFormScore(existingGrade.score);
      setFormScoreConcept(existingGrade.scoreConcept || 0);
      setFormScoreQuiz(existingGrade.scoreQuiz || 0);
      setFormScoreAttitude(existingGrade.scoreAttitude || 0);
      setFormTitle(existingGrade.title || "");
      setFormNotes(existingGrade.notes || "");
      // UAS: prefill semua subject — yang sudah ada pakai score existing,
      // sisanya 0. Backward-compat: kalau buka mode edit dari single-subject
      // existing record, isi cuma subject itu, sisanya 0.
      if (dbType === "UAS") {
        const initial: Record<string, number> = {};
        const existingSubjectScores = grades
          .filter((g) => {
            const sid = typeof g.anakDidikId === "object"
              ? (g.anakDidikId as { _id: string })._id
              : g.anakDidikId;
            return sid === student._id && g.type === "UAS";
          })
          .reduce<Record<string, number>>((acc, g) => {
            if (g.subject) acc[g.subject] = g.score || 0;
            return acc;
          }, {});
        for (const opt of uasSubjectOptions) {
          initial[opt.value] = existingSubjectScores[opt.value] ?? 0;
        }
        setFormUasScores(initial);
      } else {
        setFormUasScores({});
      }
    } else {
      setEditId(null);
      setFormScore(0);
      setFormScoreConcept(0);
      setFormScoreQuiz(0);
      setFormScoreAttitude(0);

      // UAS: prefill semua subject dengan score yang sudah pernah disimpan,
      // supaya kalau ada record sebelumnya muncul di sini (jadi mode "upsert").
      if (dbType === "UAS") {
        const initial: Record<string, number> = {};
        const existingSubjectScores = grades
          .filter((g) => {
            const sid = typeof g.anakDidikId === "object"
              ? (g.anakDidikId as { _id: string })._id
              : g.anakDidikId;
            return sid === student._id && g.type === "UAS";
          })
          .reduce<Record<string, number>>((acc, g) => {
            if (g.subject) acc[g.subject] = g.score || 0;
            return acc;
          }, {});
        for (const opt of uasSubjectOptions) {
          initial[opt.value] = existingSubjectScores[opt.value] ?? 0;
        }
        setFormUasScores(initial);
      } else {
        setFormUasScores({});
      }

      if (selectedType === "TUGAS") {
        setFormTitle(`KBM Pekan ${selectedWeek}`);
      } else if (selectedType === "TRYOUT") {
        setFormTitle(`Try Out #${selectedTryout} - Pekan ${selectedWeek}`);
      } else if (selectedType === "UAS_LIT_KOG") {
        setFormTitle("UAS Literasi Kognitif");
      } else if (selectedType === "UAS_LIT_AFK") {
        setFormTitle("UAS Literasi Afektif");
      } else if (selectedType === "UAS_BING") {
        setFormTitle("UAS Bahasa Inggris");
      } else {
        setFormTitle("");
      }
      setFormNotes("");
    }
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setActiveStudent(null);
  };

  const handleSubmit = async () => {
    if (!activeStudent || isReadOnly) return;

    // ─── Validasi pre-submit ─────────────────────────────────────────────────
    // Cegah baris 0/0/0 yang mengotori rekap & raport.
    if (!formTitle.trim()) {
      showToast("error", "Judul / Nama Pertemuan wajib diisi.");
      return;
    }

    if (dbType === "TUGAS") {
      const allZero =
        (formScoreConcept || 0) === 0 &&
        (formScoreQuiz || 0) === 0 &&
        (formScoreAttitude || 0) === 0;
      if (allZero) {
        const confirmAllZero = window.confirm(
          "Pemahaman Konsep, Pengerjaan Kuis, dan Sikap Pembelajaran semuanya 0.\n\n" +
            "Yakin simpan dengan nilai 0 semua? Kalau siswa absen, lebih baik atur status kehadiran di menu Kehadiran daripada save nilai 0."
        );
        if (!confirmAllZero) return;
      }
    } else if (dbType === "UAS") {
      // Sekarang multi-subject — minimal harus ada 1 subject yg di-input > 0,
      // atau user explicit confirm kalau semua 0.
      const allZero = uasSubjectOptions.every(
        (opt) => (formUasScores[opt.value] || 0) === 0
      );
      if (allZero) {
        const ok = window.confirm(
          "Semua subject UAS bernilai 0. Yakin lanjut?"
        );
        if (!ok) return;
      }
    }

    setSubmitting(true);
    try {
      // ── UAS multi-subject: loop & upsert per subject ────────────────────
      if (dbType === "UAS") {
        // Cari record existing per subject (untuk PUT vs POST)
        const existingBySubject = grades.reduce<Record<string, Grade>>((acc, g) => {
          const sid = typeof g.anakDidikId === "object"
            ? (g.anakDidikId as { _id: string })._id
            : g.anakDidikId;
          if (sid === activeStudent._id && g.type === "UAS" && g.subject) {
            acc[g.subject] = g;
          }
          return acc;
        }, {});

        const ops = uasSubjectOptions.map(async (opt) => {
          const score = formUasScores[opt.value] || 0;
          const existing = existingBySubject[opt.value];

          // Bangun title per subject supaya jelas di rekap
          const subjectTitle =
            selectedType === "UAS_LIT_KOG"
              ? `UAS Literasi Kognitif — ${opt.label}`
              : selectedType === "UAS_LIT_AFK"
              ? `UAS Literasi Afektif — ${opt.label}`
              : selectedType === "UAS_BING"
              ? `UAS Bahasa Inggris${opt.label && opt.label !== "UAS Bahasa Inggris (Total)" ? ` — ${opt.label}` : ""}`
              : opt.label;

          const payload: Record<string, unknown> = {
            anakDidikId: activeStudent._id,
            type: "UAS",
            week: null,
            title: subjectTitle,
            notes: formNotes,
            semester: selectedSemester,
            subject: opt.value,
            // Skala 0-100 konsisten — maxScore = 100 untuk semua subject UAS
            maxScore: 100,
            score,
          };

          const url = existing
            ? `/api/volunteer/evaluation/${existing._id}`
            : `/api/volunteer/evaluation`;
          const method = existing ? "PUT" : "POST";

          const res = await fetch(url, {
            method,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || `Gagal menyimpan ${opt.label}`);
          }
        });

        await Promise.all(ops);
        showToast("success", `Nilai ${uasSubjectOptions.length} subject berhasil disimpan.`);
        fetchGrades();
        closeForm();
        return;
      }

      // ── TUGAS / TRYOUT ──────────────────────────────────────────────────
      const payload: Record<string, unknown> = {
        anakDidikId: activeStudent._id,
        type: dbType,
        week: dbType === "TUGAS" || dbType === "TRYOUT" ? parseInt(selectedWeek) : null,
        title: formTitle,
        notes: formNotes,
        semester: selectedSemester,
      };

      if (dbType === "TUGAS") {
        payload.scoreConcept = formScoreConcept;
        payload.scoreQuiz = formScoreQuiz;
        payload.scoreAttitude = formScoreAttitude;
      } else if (dbType === "TRYOUT") {
        payload.tryoutNumber = parseInt(selectedTryout);
        payload.score = formScore;
      } else {
        payload.score = formScore;
      }

      const url = editId
        ? `/api/volunteer/evaluation/${editId}`
        : `/api/volunteer/evaluation`;
      const method = editId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan nilai.");

      showToast("success", "Data nilai berhasil disimpan.");
      fetchGrades();
      closeForm();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId || isReadOnly) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/volunteer/evaluation/${deleteId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Gagal menghapus nilai.");
      showToast("success", "Nilai berhasil dihapus.");
      fetchGrades();
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Gagal menghapus");
    } finally {
      setSubmitting(false);
      setDeleteId(null);
    }
  };

  // ─── Rendering Helpers ──────────────────────────────────────────────────────
  const filteredStudents = students.filter((s) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
    }
    return true;
  });

  const getScoreColor = (score: number) => {
    if (score >= 85) return styles.scoreHigh;
    if (score >= 70) return styles.scoreMid;
    return styles.scoreLow;
  };

  const formatSemester = (sem: string) => {
    if (!sem) return "-";
    const [year, term] = sem.split("-");
    return `Semester ${term} - ${year}`;
  };

  // Get unique semesters from schedules
  const [availableSemesters, setAvailableSemesters] = useState<string[]>(["2025-1"]);

  if (!hasMounted) return null;

  return (
    <div className={`${styles.main} ${styles.mainEnter}`}>
      {toast && (
        <div className={`${styles.toast} ${toast.type === "success" ? styles.toastSuccess : styles.toastError}`}>
          {toast.message}
        </div>
      )}

      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>AKADEMIK</span>
            <h1 className={styles.heroTitle}>Input Nilai Terintegrasi.</h1>
            <p className={styles.heroDesc}>
              Daftar siswa dan pekan evaluasi dimuat secara otomatis berdasarkan Jadwal Mengajar Anda yang sedang aktif.
            </p>
            {isReadOnly && (
              <div style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', background: 'rgba(192, 57, 43, 0.1)', color: '#c0392b', borderRadius: '8px', fontSize: '12px', fontWeight: 600 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                ARSIP SEMESTER LAMPAU (READ-ONLY)
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.filterBar}>
        <div className={styles.filterGroup} style={{ borderRight: '1.5px solid #e0e0e0', paddingRight: '20px', marginRight: '4px' }}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Jadwal Mengajar Anda</label>
            {schedules.length === 0 ? (
              <div style={{ padding: '10px 16px', background: '#fff0ee', color: '#c0392b', borderRadius: '12px', fontSize: '13px', fontWeight: 500 }}>
                Belum ada jadwal.
              </div>
            ) : (
              <div className={styles.selectWrapper}>
                <select 
                  className={styles.filterSelect} 
                  value={selectedScheduleId}
                  onChange={(e) => setSelectedScheduleId(e.target.value)}
                  style={{ minWidth: '220px' }}
                >
                  <option value="">-- Pilih Jadwal --</option>
                  {schedules
                    .filter(s => s.semester === selectedSemester)
                    .map(s => (
                      <option key={s._id} value={s._id}>
                        {s.region} — {s.level}
                      </option>
                    ))
                  }
                </select>
                <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
              </div>
            )}
          </div>
        </div>

        <div className={styles.filterGroup}>
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Semester</label>
            <div className={styles.selectWrapper}>
              <select 
                className={styles.filterSelect} 
                value={selectedSemester} 
                onChange={(e) => setSelectedSemester(e.target.value)}
              >
                {availableSemesters.map(sem => (
                  <option key={sem} value={sem}>{formatSemester(sem)}</option>
                ))}
              </select>
              <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>
          
          <div className={styles.filterItem}>
            <label className={styles.filterLabel}>Tipe Evaluasi</label>
            <div className={styles.selectWrapper}>
              <select className={styles.filterSelect} value={selectedType} onChange={(e) => setSelectedType(e.target.value as EvalTypeValue)}>
                {evalTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
            </div>
          </div>

          {selectedType === "TUGAS" && (
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Pekan (KBM #)</label>
              <div className={styles.selectWrapper}>
                <input type="number" className={styles.filterSelect} style={{ minWidth: "90px" }} value={selectedWeek} min="1" max="52" onChange={(e) => setSelectedWeek(e.target.value)} />
              </div>
            </div>
          )}

          {selectedType === "TRYOUT" && (
            <>
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>Pekan</label>
                <div className={styles.selectWrapper}>
                  <input type="number" className={styles.filterSelect} style={{ minWidth: "80px" }} value={selectedWeek} min="1" max="52" onChange={(e) => setSelectedWeek(e.target.value)} />
                </div>
              </div>
              <div className={styles.filterItem}>
                <label className={styles.filterLabel}>Try Out</label>
                <div className={styles.selectWrapper}>
                  <select className={styles.filterSelect} value={selectedTryout} onChange={(e) => setSelectedTryout(e.target.value)}>
                    <option value="1">Try Out #1</option>
                    <option value="2">Try Out #2</option>
                  </select>
                  <svg className={styles.selectChevron} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                </div>
              </div>
            </>
          )}

          {isUasType && (
            <div className={styles.filterItem}>
              <label className={styles.filterLabel}>Komponen</label>
              <div style={{ padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 12, fontSize: 12, color: '#374151', minWidth: 220 }}>
                {uasSubjectOptions.length} subject akan diinput sekaligus per siswa
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <h2 className={styles.tableTitle}>
            Daftar Anak Didik
            <span style={{ fontSize: 14, color: '#888', marginLeft: 12, fontWeight: 'normal' }}>
              ({currentEvalMeta.label}
              {selectedType === 'TUGAS' && selectedWeek ? ` - KBM #${selectedWeek}` : ''}
              {selectedType === 'TRYOUT' ? ` - Pekan ${selectedWeek} · TO#${selectedTryout}` : ''}
              {isUasType ? ` - ${uasSubjectOptions.length} subject` : ''})
            </span>
          </h2>
          
          {schedules.length > 0 && (
            <div className={styles.searchWrapper}>
              <svg className={styles.searchIcon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" className={styles.searchInput} placeholder="Cari nama siswa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ background: '#f9f9f9', width: '200px' }} />
            </div>
          )}
        </div>

        {schedules.length === 0 ? (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>
            </div>
            <h3 className={styles.emptyTitle}>Belum Ada Jadwal</h3>
            <p className={styles.emptyDesc}>Anda harus menambahkan jadwal mengajar terlebih dahulu.</p>
          </div>
        ) : loading ? (
          <div className={styles.emptyState}>
            <div className={styles.spinner} style={{ borderColor: '#c0392b', borderTopColor: 'transparent', margin: '0 auto', width: 32, height: 32, borderWidth: 3 }}></div>
            <p style={{ marginTop: 16, color: '#888' }}>Mencari data...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className={styles.emptyState}>
            <h3 className={styles.emptyTitle}>Data Siswa Kosong</h3>
            <p className={styles.emptyDesc}>Tidak ada siswa yang sesuai di kelas ini.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {dbType === "UAS" ? (
              // ─── UAS LAYOUT: pivot per subject sebagai kolom sendiri ─────
              <table className={`${styles.table} ${styles.uasTable}`}>
                <thead>
                  <tr>
                    <th>Siswa</th>
                    <th>Kategori</th>
                    {uasSubjectOptions.map((opt) => (
                      <th key={opt.value} style={{ minWidth: '90px' }}>
                        {formatSubjectLabel(opt.label, { stripPrefix: true })}
                      </th>
                    ))}
                    <th style={{ minWidth: '120px' }}>Status</th>
                    <th style={{ textAlign: "right", minWidth: '140px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((student) => {
                    const studentGrades = grades.filter((g) => {
                      const gradeStudentId = typeof g.anakDidikId === 'object'
                        ? (g.anakDidikId as any)?._id?.toString()
                        : g.anakDidikId?.toString();
                      return gradeStudentId === student._id.toString();
                    });
                    // Map subject → grade record (untuk lookup cepat)
                    const gradeBySubject: Record<string, Grade | undefined> = {};
                    for (const g of studentGrades) {
                      if (g.subject) gradeBySubject[g.subject] = g;
                    }
                    const filledCount = uasSubjectOptions.filter(
                      (opt) => typeof gradeBySubject[opt.value]?.score === "number"
                    ).length;
                    const totalCount = uasSubjectOptions.length;

                    return (
                      <tr key={student._id}>
                        <td>
                          <div className={styles.studentCell}>
                            <img src={`https://i.pravatar.cc/150?u=${student._id}`} alt="avatar" className={styles.studentAva} />
                            <div>
                              <div className={styles.studentCellName}>{student.name}</div>
                              <div className={styles.studentCellSub}>{student.region}</div>
                            </div>
                          </div>
                        </td>
                        <td>{student.category}</td>
                        {uasSubjectOptions.map((opt) => {
                          const g = gradeBySubject[opt.value];
                          if (!g) {
                            return (
                              <td key={opt.value}>
                                <span className={styles.uasEmptyDash}>—</span>
                              </td>
                            );
                          }
                          return (
                            <td key={opt.value}>
                              <span className={`${styles.uasScoreChip} ${getScoreColor(g.score)}`}>
                                {g.score}
                              </span>
                            </td>
                          );
                        })}
                        <td>
                          <span
                            className={`${styles.uasStatusBadge} ${
                              filledCount === 0
                                ? styles.uasStatusEmpty
                                : filledCount === totalCount
                                ? styles.uasStatusFull
                                : styles.uasStatusPartial
                            }`}
                          >
                            {filledCount === 0
                              ? "Belum dinilai"
                              : filledCount === totalCount
                              ? "Lengkap"
                              : `${filledCount}/${totalCount} subject`}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            {isReadOnly ? (
                              <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>Terkunci</span>
                            ) : (
                              <button
                                className={`${styles.uasActionBtn} ${filledCount > 0 ? styles.outline : styles.primary}`}
                                onClick={() => handleOpenForm(student)}
                              >
                                {filledCount > 0 ? "Edit Nilai" : "Input Nilai"}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              // ─── DEFAULT LAYOUT: TUGAS / TRYOUT ──────────────────────────
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Siswa</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th>Keterangan</th>
                  <th style={{ minWidth: '150px' }}>Rincian Nilai</th>
                  {dbType !== "TUGAS" && <th>Skor</th>}
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const studentGrades = grades
                    .filter(g => {
                      const gradeStudentId = typeof g.anakDidikId === 'object' 
                        ? (g.anakDidikId as any)?._id?.toString() 
                        : g.anakDidikId?.toString();
                      return gradeStudentId === student._id.toString();
                    })
                    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

                  return (
                    <tr key={student._id}>
                      <td>
                        <div className={styles.studentCell}>
                          <img src={`https://i.pravatar.cc/150?u=${student._id}`} alt="avatar" className={styles.studentAva} />
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>{student.region}</div>
                          </div>
                        </div>
                      </td>
                      <td>{student.category}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {studentGrades.length > 0 ? (
                            studentGrades.map(g => (
                              <span key={g._id} className={`${styles.typeBadge} ${styles.typeKuis}`} style={{ fontSize: '10px', padding: '2px 8px', textAlign: 'center', width: 'fit-content', height: '24px', display: 'flex', alignItems: 'center' }}>
                                DINILAI
                              </span>
                            ))
                          ) : (
                            <span className={`${styles.typeBadge} ${styles.typeEmpty}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                              BELUM DINILAI
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {studentGrades.length > 0 ? (
                            studentGrades.map((g, idx) => (
                              <div key={g._id} style={{ fontSize: '12px', fontWeight: 600, color: '#444', height: '24px', display: 'flex', alignItems: 'center' }}>
                                {g.title || `${g.type === 'TUGAS' ? 'Tugas' : g.type} ${idx + 1}`}
                              </div>
                            ))
                          ) : (
                            <span style={{ color: '#bbb' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {studentGrades.length > 0 ? (
                            studentGrades.map((g) => {
                              // Untuk TUGAS tampilkan 3 pill rincian
                              if (g.type === "TUGAS" || g.type === "KUIS") {
                                return (
                                  <div key={g._id} style={{ display: 'flex', gap: '6px', fontSize: '11px' }}>
                                    <div title="Konsep" style={{ background: '#f0f7ff', padding: '2px 6px', borderRadius: '4px', border: '1px solid #cce3ff' }}>💡 {g.scoreConcept || 0}</div>
                                    <div title="Kuis" style={{ background: '#fdf2f2', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ffd8d8' }}>📝 {g.scoreQuiz || 0}</div>
                                    <div title="Sikap" style={{ background: '#f0fdf4', padding: '2px 6px', borderRadius: '4px', border: '1px solid #bbf7d0' }}>⭐ {g.scoreAttitude || 0}</div>
                                  </div>
                                );
                              }
                              // UAS: tampilkan skor (0-100 sekarang)
                              if (g.type === "UAS") {
                                const subjectMeta = uasSubjectOptions.find((s) => s.value === g.subject);
                                return (
                                  <div key={g._id} style={{ fontSize: '12px', color: '#555' }}>
                                    <span style={{ background: '#fff7ed', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fed7aa', fontWeight: 600 }}>
                                      🎯 {subjectMeta?.label || g.subject}: {g.score}/100
                                    </span>
                                  </div>
                                );
                              }
                              // TRYOUT: tampilkan skor saja
                              return (
                                <div key={g._id} style={{ fontSize: '12px', color: '#555' }}>
                                  <span style={{ background: '#f0f7ff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #cce3ff', fontWeight: 600 }}>
                                    📊 {g.score} poin
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <span style={{ color: '#bbb' }}>—</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {dbType !== "TUGAS" && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {studentGrades.length > 0 ? (
                              studentGrades.map((g) => (
                                <div key={g._id} className={`${styles.scorePill} ${getScoreColor(g.score)}`} style={{ fontSize: '12px', fontWeight: 700, height: '24px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  {g.score}
                                </div>
                              ))
                            ) : (
                              <span style={{ color: '#bbb' }}>—</span>
                            )}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className={styles.actionGroup} style={{ justifyContent: "flex-end", flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                          {isReadOnly ? (
                             <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>Terkunci</span>
                          ) : studentGrades.length > 0 ? (
                            <>
                              {studentGrades.map(g => (
                                <div key={g._id} style={{ display: 'flex', gap: '4px', height: '24px', alignItems: 'center' }}>
                                  <button className={styles.btnEdit} onClick={() => handleOpenForm(student, g)} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px' }}>
                                    Edit
                                  </button>
                                  <button className={styles.btnDanger} onClick={() => setDeleteId(g._id)} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '6px' }}>
                                    Hapus
                                  </button>
                                </div>
                              ))}
                              <button className={styles.btnPrimary} onClick={() => handleOpenForm(student)} style={{ padding: '6px 12px', fontSize: '11px', borderRadius: '10px', background: '#27ae60', marginTop: '4px', fontWeight: 600 }}>
                                + Tambah
                              </button>
                            </>
                          ) : (
                            <button className={styles.btnPrimary} onClick={() => handleOpenForm(student)} style={{ padding: '8px 16px', fontSize: '12px', borderRadius: '12px', fontWeight: 600 }}>
                                Input Nilai
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            )}
          </div>
        )}
      </div>

      <Modal
        isOpen={formOpen}
        onClose={closeForm}
        title={editId ? "Edit Penilaian" : "Input Penilaian"}
        footer={
          <>
            <button className={styles.btnSecondary} onClick={closeForm} disabled={submitting}>Batal</button>
            <button className={styles.btnPrimary} onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Nilai"}
            </button>
          </>
        }
      >
        <div className={styles.fieldRow}>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Siswa</label>
            <input type="text" className={styles.formInput} value={activeStudent?.name || ""} disabled style={{ background: '#f5f5f5', color: '#666' }} />
          </div>
          <div className={styles.field} style={{ flex: 1 }}>
            <label className={styles.fieldLabel}>Judul / Nama Pertemuan</label>
            <input 
              type="text" 
              className={styles.formInput} 
              placeholder="Contoh: Pertemuan Pekan 1" 
              value={formTitle} 
              onChange={(e) => setFormTitle(e.target.value)} 
            />
          </div>
        </div>

        <div className={styles.fieldRow} style={{ marginTop: 8 }}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Evaluasi</label>
            <input
              type="text"
              className={styles.formInput}
              value={
                selectedType === "TUGAS"
                  ? `KBM #${selectedWeek} (Tugas Pekanan)`
                  : selectedType === "TRYOUT"
                  ? `TRY OUT #${selectedTryout} - Pekan ${selectedWeek}`
                  : selectedType === "UAS_LIT_KOG"
                  ? `UAS Literasi Kognitif (${uasSubjectOptions.length} subject)`
                  : selectedType === "UAS_LIT_AFK"
                  ? `UAS Literasi Afektif (${uasSubjectOptions.length} subject)`
                  : selectedType === "UAS_BING"
                  ? "UAS Bahasa Inggris"
                  : selectedType
              }
              disabled
              style={{ background: '#f5f5f5', color: '#666' }}
            />
          </div>
        </div>

        <div className={styles.field} style={{ marginTop: 20 }}>
          <label className={styles.fieldLabel} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Rincian Penilaian
            <span style={{ fontSize: '11px', color: '#888', fontWeight: 500 }}>
              SKALA 0 - 100
            </span>
          </label>

          {dbType === "TUGAS" ? (
            <div className={styles.scoreCard}>
              {/* Concept */}
              <div className={styles.scoreItem}>
                <div className={styles.scoreInfo}>
                  <div className={styles.scoreIcon} style={{ background: '#e0f2fe', color: '#0369a1' }}>💡</div>
                  <div>
                    <div className={styles.scoreName}>Pemahaman Konsep</div>
                    <div className={styles.scoreDesc}>Penguasaan materi harian</div>
                  </div>
                </div>
                <input
                  type="number"
                  className={styles.scoreInput}
                  min="0" max="100"
                  value={formScoreConcept}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormScoreConcept(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </div>

              {/* Quiz */}
              <div className={styles.scoreItem}>
                <div className={styles.scoreInfo}>
                  <div className={styles.scoreIcon} style={{ background: '#fef2f2', color: '#991b1b' }}>📝</div>
                  <div>
                    <div className={styles.scoreName}>Pengerjaan Kuis</div>
                    <div className={styles.scoreDesc}>Hasil kuis di akhir sesi</div>
                  </div>
                </div>
                <input
                  type="number"
                  className={styles.scoreInput}
                  min="0" max="100"
                  value={formScoreQuiz}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormScoreQuiz(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </div>

              {/* Attitude */}
              <div className={styles.scoreItem}>
                <div className={styles.scoreInfo}>
                  <div className={styles.scoreIcon} style={{ background: '#f0fdf4', color: '#166534' }}>⭐</div>
                  <div>
                    <div className={styles.scoreName}>Sikap Pembelajaran</div>
                    <div className={styles.scoreDesc}>Adab dan keaktifan kelas</div>
                  </div>
                </div>
                <input
                  type="number"
                  className={styles.scoreInput}
                  min="0" max="100"
                  value={formScoreAttitude}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormScoreAttitude(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </div>
            </div>
          ) : dbType === "UAS" ? (
            <div className={styles.scoreCard}>
              {/* Info source komponen UAS — bantu volunteer paham asal-usul */}
              <div
                style={{
                  padding: "8px 12px",
                  margin: "8px",
                  background: faseConfigured ? "#eff6ff" : "#fffbeb",
                  border: `1px solid ${faseConfigured ? "#bfdbfe" : "#fde68a"}`,
                  borderRadius: 8,
                  fontSize: 11,
                  color: faseConfigured ? "#1e40af" : "#92400e",
                  lineHeight: 1.5,
                }}
              >
                {faseConfigured ? (
                  <>
                    📋 Komponen UAS untuk <strong>{currentSched?.level}</strong>{" "}
                    diambil dari Konfigurasi Raport ({uasSubjectOptions.length} subject).
                    Input semua subject sekaligus, skala 0-100 per subject.
                  </>
                ) : (
                  <>
                    ⚠️ Fase <strong>{currentSched?.level || "—"}</strong> belum
                    dikonfigurasi di Konfigurasi Raport. Pakai daftar default
                    sementara — minta admin lengkapi supaya match dengan rekap.
                  </>
                )}
              </div>

              {/* Multi-subject input — semua subject sekaligus */}
              {uasSubjectOptions.map((opt, idx) => {
                const colors = [
                  { bg: '#e0f2fe', fg: '#0369a1', emoji: '🎯' },
                  { bg: '#fef2f2', fg: '#991b1b', emoji: '📝' },
                  { bg: '#f0fdf4', fg: '#166534', emoji: '🌱' },
                  { bg: '#fff7ed', fg: '#c2410c', emoji: '🧠' },
                  { bg: '#fdf2f8', fg: '#a21caf', emoji: '✨' },
                ];
                const c = colors[idx % colors.length];
                return (
                  <div key={opt.value} className={styles.scoreItem}>
                    <div className={styles.scoreInfo}>
                      <div className={styles.scoreIcon} style={{ background: c.bg, color: c.fg }}>{c.emoji}</div>
                      <div>
                        <div className={styles.scoreName}>{formatSubjectLabel(opt.label)}</div>
                        <div className={styles.scoreDesc}>Subject: {opt.value}</div>
                      </div>
                    </div>
                    <input
                      type="number"
                      className={styles.scoreInput}
                      min="0" max="100"
                      value={formUasScores[opt.value] ?? 0}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const v = Math.min(100, Math.max(0, parseInt(e.target.value) || 0));
                        setFormUasScores((prev) => ({ ...prev, [opt.value]: v }));
                      }}
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            // TRYOUT — single score 0..100
            <div className={styles.scoreCard}>
              <div className={styles.scoreItem}>
                <div className={styles.scoreInfo}>
                  <div className={styles.scoreIcon} style={{ background: '#e0f2fe', color: '#0369a1' }}>📊</div>
                  <div>
                    <div className={styles.scoreName}>{dbType === 'TRYOUT' ? 'Skor Try Out' : 'Skor Akhir'}</div>
                    <div className={styles.scoreDesc}>Skala 0 - 100</div>
                  </div>
                </div>
                <input
                  type="number"
                  className={styles.scoreInput}
                  min="0" max="100"
                  value={formScore}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => setFormScore(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                />
              </div>
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.fieldLabel}>Catatan (Opsional)</label>
          <textarea className={styles.formTextarea} placeholder="Tambahkan feedback..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} />
        </div>
      </Modal>

      <Modal
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        title="Hapus Data Nilai?"
        maxWidth="400px"
        footer={
          <>
            <button className={styles.btnSecondary} onClick={() => setDeleteId(null)} disabled={submitting}>Batal</button>
            <button className={styles.btnDanger} onClick={handleDelete} disabled={submitting} style={{ background: '#c0392b', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '8px' }}>
              {submitting ? "Menghapus..." : "Ya, Hapus"}
            </button>
          </>
        }
      >
        <p style={{ color: '#666', fontSize: '14px', textAlign: 'center', margin: 0 }}>
          Tindakan ini tidak dapat dibatalkan. Data nilai akan dihapus permanen.
        </p>
      </Modal>

    </div>
  );
}