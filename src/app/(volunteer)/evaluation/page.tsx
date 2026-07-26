"use client";

import { useState, useEffect, useCallback, useMemo, useRef, useSyncExternalStore, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./inputNilai.module.css";
import Spinner from "@/components/ui/Spinner/Spinner";
import Modal from "@/components/ui/Modal/Modal";
import AdminPagination from "@/components/admin/ui/AdminPagination";
import VolunteerFilterPanel from "@/components/volunteer/VolunteerFilterPanel/VolunteerFilterPanel";
import { getErrorMessage } from "@/lib/errors";
import { getCurrentSemester, formatKbmDate, formatKbmDateShort, isFutureDate, formatSubjectLabel, limitToStartedMeetings } from "@/utils/formatters";
import { DEFAULT_SNBT_SUBTESTS, type TryoutSubTest } from "@/lib/reportDefaults";
import { Lock } from "lucide-react";
import ToastNotification from "@/components/toast/Toast";

// ─── Types ────────────────────────────────────────────────────────────────────
type Student = {
  _id: string;
  name: string;
  region: string;
  fase: string;
  parentName?: string;
  studentCode?: string;
};

type KbmDate = {
  week: number;
  date: string;
  topic?: string;
};

type Schedule = {
  _id: string;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  kbmDates?: KbmDate[];
};

const clampScore = (value: string, max = 100) => Math.min(max, Math.max(0, Number(value) || 0));
const clampOptionalScore = (value: string) => value === "" ? "" : String(clampScore(value));

type Grade = {
  _id: string;
  studentId: Student | string;
  type: "TUGAS" | "UAS" | "TUGAS_SNBT" | "TRYOUT";
  week?: number;
  score: number;
  scoreConcept?: number;
  scoreQuiz?: number;
  scoreAttitude?: number;
  subject?: string | null;
  subTest?: string | null;
  maxScore?: number | null;
  semester: string;
  notes?: string;
  title?: string;
  createdAt: string;
};

// ─── Evaluation Type Options ─────────────────────────────────────────────────
const EVAL_TYPES = [
  { value: "TUGAS", label: "Kelas Minggu Cerdas", dbType: "TUGAS" },
  { value: "UAS_LIT_KOG", label: "UAS Literasi — Kognitif", dbType: "UAS" },
  { value: "UAS_LIT_AFK", label: "UAS Literasi — Afektif", dbType: "UAS" },
  { value: "UAS_BING", label: "UAS Bahasa Inggris", dbType: "UAS" },
] as const;

// Tipe khusus fase SNBT: 1 form gabung TO1/TO2 (+ sub-tes) per pertemuan.
// KBM diinput lewat tipe "Kelas Minggu Cerdas". Fase SNBT dapat dropdown
// berisi tipe ini + semua EVAL_TYPES reguler (Minggu Cerdas, UAS
// Kognitif/Afektif/B.Inggris).
const SNBT_TYPE_VALUE = "SNBT" as const;
const SNBT_TYPE_LABEL = "Try Out SNBT (TO1 & TO2)";

type EvalTypeValue = (typeof EVAL_TYPES)[number]["value"] | typeof SNBT_TYPE_VALUE;

type UasSubjectOption = { value: string; label: string; defaultMax: number };

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

type FaseUasComponent = { subject: string; label: string; maxScore: number };
type FaseConfigEntry = {
  jenjang: string;
  uasKognitif: FaseUasComponent[];
  uasAfektif: FaseUasComponent[];
  uasBInggris: { maxScore: number } | null;
  kbmMaxPerComponent: number;
  tryoutSubTests?: TryoutSubTest[];
};

type Toast = { type: "success" | "error"; message: string } | null;

function useHasMounted(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

const getRandomColor = (str: string) => {
  const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

const getScoreColor = (score: number) => {
  if (score >= 85) return styles.scoreHigh;
  if (score >= 70) return styles.scoreMid;
  return styles.scoreLow;
};

const getStudentId = (studentId: Student | string | null | undefined): string | null => {
  if (!studentId) return null;
  return typeof studentId === 'string' ? studentId : studentId._id;
};

export default function InputNilaiPage() {
  return (
    <Suspense fallback={
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat...</p>
      </div>
    }>
      <InputNilaiContent />
    </Suspense>
  );
}

function InputNilaiContent() {
  const hasMounted = useHasMounted();
  const searchParams = useSearchParams();

  // Query params dari schedule timeline (auto-fill flow)
  const qsScheduleId = searchParams.get("scheduleId");
  const qsWeek = searchParams.get("week");
  const initialQueryRef = useRef({ scheduleId: qsScheduleId, week: qsWeek });

  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [students, setStudents] = useState<Student[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<Toast>(null);
  const [mounted, setMounted] = useState(false);

  const [selectedSemester, setSelectedSemester] = useState(() => {
    return getCurrentSemester();
  });
  const [selectedType, setSelectedType] = useState<EvalTypeValue>("TUGAS");
  const [selectedWeek, setSelectedWeek] = useState(qsWeek || "1");

  const [faseConfig, setFaseConfig] = useState<Record<string, FaseConfigEntry>>({});
  
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [activeStudent, setActiveStudent] = useState<Student | null>(null);
  const [formScore, setFormScore] = useState(0);
  const [formScoreConcept, setFormScoreConcept] = useState(0);
  const [formScoreQuiz, setFormScoreQuiz] = useState(0);
  const [formScoreAttitude, setFormScoreAttitude] = useState(0);
  const [formTitle, setFormTitle] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formUasScores, setFormUasScores] = useState<Record<string, number>>({});
  // SNBT: 1 form gabung per pertemuan menyimpan skor TO1/TO2 (KBM diinput
  // lewat tipe "Kelas Minggu Cerdas" — Konsep/Kuis/Sikap). Dipakai sebagai
  // string supaya bisa bedain "kosong" (belum diisi) vs 0 (siswa absen) —
  // task body eksplisit minta tolak submit kalau semuanya kosong tapi 0 boleh.
  const [formSnbtTo1, setFormSnbtTo1] = useState<string>("");
  const [formSnbtTo2, setFormSnbtTo2] = useState<string>("");
  // Mode sub-tes: 1 input per sub-tes per TO, key `${"TO1"|"TO2"}:${code}`.
  // formSnbtTo1/To2 di atas hanya dipakai kalau fase tidak punya sub-tes
  // (mode legacy 1 skor total per TO).
  const [formSnbtSubs, setFormSnbtSubs] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Inisialisasi data halaman pada mount (settings dan jadwal mengajar)
  useEffect(() => {
    let active = true;
    
    const initPage = async () => {
      try {
        // 1. Fetch Settings & Semesters
        const settingsRes = await fetch("/api/admin/settings");
        let activeSem = getCurrentSemester();
        if (settingsRes.ok) {
          const settingsData = await settingsRes.json();
          if (active && settingsData.faseConfig) {
            setFaseConfig(settingsData.faseConfig);
          }
          if (active && settingsData.activeSemester) {
            activeSem = settingsData.activeSemester;
            setSelectedSemester(settingsData.activeSemester);
            if (typeof window !== "undefined") {
              localStorage.setItem("activeSemester", settingsData.activeSemester);
            }
          }
        }

        // 2. Fetch Schedules
        const schedulesRes = await fetch("/api/volunteer/schedule");
        if (schedulesRes.ok) {
          const schedulesData = await schedulesRes.json();
          if (active && schedulesData.schedules) {
            const fetchedScheds = schedulesData.schedules;
            setSchedules(fetchedScheds);

            // Auto-select schedule berdasarkan prioritas: query param timeline -> first active
            const activeInSem = fetchedScheds.filter((s: Schedule) => s.semester === activeSem);
            let selectedId = "";
            const { scheduleId, week } = initialQueryRef.current;
            if (scheduleId) {
              const fromQuery = activeInSem.find((s: Schedule) => s._id === scheduleId);
              if (fromQuery) {
                selectedId = fromQuery._id;
              } else if (activeInSem.length > 0) {
                selectedId = activeInSem[0]._id;
              }
            } else if (activeInSem.length > 0) {
              selectedId = activeInSem[0]._id;
            }

            if (selectedId) {
              setSelectedScheduleId(selectedId);
              const sched = fetchedScheds.find((s: Schedule) => s._id === selectedId);
              if (sched) {
                if (week) {
                  setSelectedWeek(week);
                } else {
                  const kbm = sched.kbmDates ?? [];
                  const target = kbm.find((k: KbmDate) => k.week === sched.activeWeek) ?? kbm[0];
                  if (target) {
                    setSelectedWeek(String(target.week));
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Gagal inisialisasi data halaman:", err);
      } finally {
        if (active) {
          setMounted(true);
        }
      }
    };

    initPage();

    return () => {
      active = false;
    };
  }, []);

  const currentSched = schedules.find((s) => s._id === selectedScheduleId);
  const level = currentSched?.fase;
  const selectedMeeting = currentSched?.kbmDates?.find((item) => String(item.week) === selectedWeek);

  const currentFase: FaseConfigEntry | null = level ? faseConfig[level] ?? null : null;

  // Deteksi SNBT — utamain `jenjang` dari faseConfig (source of truth admin),
  // fallback ke regex match pada label fase schedule supaya skenario di mana
  // faseConfig belum sempat di-fetch tetap kelacak. Pakai /SNBT/i biar
  // forward-compat sama label varian seperti "Fase E (SNBT) 2027".
  const isSnbt = Boolean(
    (currentFase?.jenjang && /SNBT/i.test(currentFase.jenjang)) ||
    (level && /SNBT/i.test(level))
  );
  // Fase SNBT sekarang bisa input tipe reguler juga (Minggu Cerdas/UAS) —
  // layout TO1/KBM/TO2 hanya aktif kalau tipe terpilih = "SNBT".
  const isSnbtMode = isSnbt && selectedType === SNBT_TYPE_VALUE;

  // Sub-tes Try Out per fase (konfigurasi admin di /admin/report-config).
  // `undefined` = faseConfig lama belum ke-backfill → pakai default 7 sub-tes
  // UTBK. Array kosong = admin sengaja nonaktifin → mode legacy 1 skor per TO.
  const snbtSubTests: TryoutSubTest[] = useMemo(() => {
    if (!isSnbt) return [];
    return currentFase?.tryoutSubTests ?? DEFAULT_SNBT_SUBTESTS;
  }, [isSnbt, currentFase]);
  const hasSubTests = snbtSubTests.length > 0;

  // Auto-switch tipe saat pindah jadwal: masuk jadwal SNBT → default ke tipe
  // SNBT; keluar dari SNBT → tipe "SNBT" tidak valid lagi, balikin ke TUGAS.
  const prevSnbtRef = useRef(false);
  useEffect(() => {
    if (isSnbt && !prevSnbtRef.current) {
      setSelectedType(SNBT_TYPE_VALUE);
      setCurrentPage(1);
    } else if (!isSnbt && selectedType === SNBT_TYPE_VALUE) {
      setSelectedType("TUGAS");
      setCurrentPage(1);
    }
    prevSnbtRef.current = isSnbt;
  }, [isSnbt, selectedType]);

  const uasSubjectOptions: UasSubjectOption[] = useMemo(() => {
    if (selectedType === "UAS_LIT_KOG") {
      if (currentFase && currentFase.uasKognitif.length > 0) {
        return currentFase.uasKognitif.map((c) => ({
          value: c.subject, label: c.label, defaultMax: c.maxScore,
        }));
      }
      return FALLBACK_UAS_LIT_KOGNITIF;
    }
    if (selectedType === "UAS_LIT_AFK") {
      if (currentFase && currentFase.uasAfektif.length > 0) {
        return currentFase.uasAfektif.map((c) => ({
          value: c.subject, label: c.label, defaultMax: c.maxScore,
        }));
      }
      return FALLBACK_UAS_LIT_AFEKTIF;
    }
    if (selectedType === "UAS_BING") {
      if (currentFase && currentFase.uasBInggris) {
        return [{ value: "BING", label: "UAS Bahasa Inggris (Total)", defaultMax: currentFase.uasBInggris.maxScore }];
      }
      return FALLBACK_UAS_BING;
    }
    return [];
  }, [selectedType, currentFase]);

  const uasSubjectsKey = useMemo(() => uasSubjectOptions.map((s) => s.value).sort().join("|"), [uasSubjectOptions]);
  // Tipe "SNBT" bukan 1 dbType — fetch/save-nya gabungan TUGAS_SNBT + TRYOUT
  // (ditangani cabang isSnbtMode); placeholder di sini cuma buat guard di bawah.
  const dbType =
    selectedType === SNBT_TYPE_VALUE
      ? "SNBT"
      : EVAL_TYPES.find((t) => t.value === selectedType)!.dbType;
  const isReadOnly = false;
  const pageSize = 10;

  // ── Lock input per tipe (sinkron dengan validasi server di lib/evaluationValidation) ──
  //  - Jadwal tanpa kbmDates: semua input terkunci sampai pertemuan digenerate.
  //  - Tipe mingguan (TUGAS/SNBT): terkunci kalau pertemuan pekan terpilih belum mulai.
  //  - UAS: terkunci sampai tanggal pertemuan TERAKHIR jadwal tercapai — tidak
  //    terikat selectedWeek (dropdown pekan tidak dirender untuk UAS, jadi sisa
  //    pilihan pekan yang tersembunyi tidak boleh mengunci UAS).
  const kbmList = currentSched?.kbmDates ?? [];
  const scheduleMissingMeetings = Boolean(currentSched) && kbmList.length === 0;
  const weekBound = selectedType === "TUGAS" || isSnbtMode;
  const isSelectedMeetingFuture = weekBound && selectedMeeting ? isFutureDate(selectedMeeting.date) : false;
  const lastMeeting = kbmList.length > 0
    ? kbmList.reduce((latest, item) =>
        new Date(item.date).getTime() > new Date(latest.date).getTime() ? item : latest
      )
    : undefined;
  const uasWindowLocked = dbType === "UAS" && Boolean(lastMeeting && isFutureDate(lastMeeting.date));
  const inputLocked = scheduleMissingMeetings || isSelectedMeetingFuture || uasWindowLocked;
  const lockMessage = scheduleMissingMeetings
    ? "Jadwal ini belum memiliki daftar pertemuan. Lengkapi tanggal pertemuan (KBM) di halaman Jadwal terlebih dahulu."
    : isSelectedMeetingFuture && selectedMeeting
    ? `Input nilai pertemuan pekan ${selectedWeek} tersedia mulai ${formatKbmDate(selectedMeeting.date)}.`
    : uasWindowLocked && lastMeeting
    ? `Nilai UAS baru bisa diisi mulai pertemuan terakhir, ${formatKbmDate(lastMeeting.date)}.`
    : null;
  const lockTitle = lockMessage ?? undefined;

  // Fetch data siswa dan nilai secara paralel dengan satu loading spinner terpadu (mencegah flickering)
  const fetchData = useCallback(async () => {
    const sched = schedules.find((s) => s._id === selectedScheduleId);
    if (!sched) {
      setStudents([]);
      setGrades([]);
      return;
    }

    setLoading(true);
    try {
      const studentPromise = fetch(
        `/api/volunteer/students?region=${encodeURIComponent(sched.region)}&fase=${encodeURIComponent(sched.fase)}`
      ).then((res) => {
        if (!res.ok) throw new Error("Gagal memuat data siswa");
        return res.json();
      });

      // SNBT mode: fetch 3 type sekaligus supaya tabel bisa render TO1/KBM/TO2
      // sebagai kolom pivot per pertemuan. KBM sekarang dari record Minggu
      // Cerdas (TUGAS, skor = rata-rata Konsep/Kuis/Sikap); TUGAS_SNBT tetap
      // di-fetch untuk menampilkan data KBM legacy 1-skor.
      const gradePromise = isSnbtMode
        ? Promise.all([
            fetch(
              `/api/volunteer/evaluation?semester=${encodeURIComponent(selectedSemester)}&type=TUGAS&week=${encodeURIComponent(selectedWeek)}`
            ).then((res) => {
              if (!res.ok) throw new Error("Gagal memuat KBM Minggu Cerdas");
              return res.json();
            }),
            fetch(
              `/api/volunteer/evaluation?semester=${encodeURIComponent(selectedSemester)}&type=TUGAS_SNBT&week=${encodeURIComponent(selectedWeek)}`
            ).then((res) => {
              if (!res.ok) throw new Error("Gagal memuat KBM SNBT");
              return res.json();
            }),
            fetch(
              `/api/volunteer/evaluation?semester=${encodeURIComponent(selectedSemester)}&type=TRYOUT&week=${encodeURIComponent(selectedWeek)}`
            ).then((res) => {
              if (!res.ok) throw new Error("Gagal memuat Try Out");
              return res.json();
            }),
          ]).then(([tugas, kbm, tryout]) => ({
            nilai: [...(tugas.nilai || []), ...(kbm.nilai || []), ...(tryout.nilai || [])],
          }))
        : (() => {
            const query = new URLSearchParams();
            query.append("semester", selectedSemester);
            query.append("type", dbType);
            if (dbType === "TUGAS" && selectedWeek) {
              query.append("week", selectedWeek);
            }
            return fetch(`/api/volunteer/evaluation?${query.toString()}`).then(
              (res) => {
                if (!res.ok) throw new Error("Gagal memuat data nilai");
                return res.json();
              }
            );
          })();

      const [studentData, gradeData] = await Promise.all([
        studentPromise,
        gradePromise,
      ]);

      setStudents(studentData.students || []);

      let filtered = gradeData.nilai || [];
      // Filter UAS subject sesuai komponen fase terpilih (berlaku juga untuk
      // fase SNBT yang sekarang bisa input UAS reguler).
      if (dbType === "UAS") {
        const allowed = uasSubjectsKey.split("|");
        filtered = filtered.filter(
          (g: Grade) => g.subject && allowed.includes(g.subject)
        );
      }
      setGrades(filtered);
    } catch (err) {
      console.error("Gagal memuat data evaluasi:", err);
    } finally {
      setLoading(false);
    }
  }, [
    selectedScheduleId,
    schedules,
    selectedSemester,
    dbType,
    selectedWeek,
    uasSubjectsKey,
    isSnbtMode,
  ]);

  // Refresh nilai saja secara independen (dipanggil setelah simpan/hapus)
  const refreshGrades = useCallback(async () => {
    try {
      if (isSnbtMode) {
        const [tugasRes, kbmRes, tryoutRes] = await Promise.all([
          fetch(
            `/api/volunteer/evaluation?semester=${encodeURIComponent(selectedSemester)}&type=TUGAS&week=${encodeURIComponent(selectedWeek)}`
          ),
          fetch(
            `/api/volunteer/evaluation?semester=${encodeURIComponent(selectedSemester)}&type=TUGAS_SNBT&week=${encodeURIComponent(selectedWeek)}`
          ),
          fetch(
            `/api/volunteer/evaluation?semester=${encodeURIComponent(selectedSemester)}&type=TRYOUT&week=${encodeURIComponent(selectedWeek)}`
          ),
        ]);
        const tugas = tugasRes.ok ? await tugasRes.json() : { nilai: [] };
        const kbm = kbmRes.ok ? await kbmRes.json() : { nilai: [] };
        const tryout = tryoutRes.ok ? await tryoutRes.json() : { nilai: [] };
        setGrades([...(tugas.nilai || []), ...(kbm.nilai || []), ...(tryout.nilai || [])]);
        return;
      }

      const query = new URLSearchParams();
      query.append("semester", selectedSemester);
      query.append("type", dbType);
      if (dbType === "TUGAS" && selectedWeek) {
        query.append("week", selectedWeek);
      }

      const res = await fetch(`/api/volunteer/evaluation?${query.toString()}`);
      if (res.ok) {
        const gradeData = await res.json();
        let filtered = gradeData.nilai || [];
        if (dbType === "UAS") {
          const allowed = uasSubjectsKey.split("|");
          filtered = filtered.filter(
            (g: Grade) => g.subject && allowed.includes(g.subject)
          );
        }
        setGrades(filtered);
      }
    } catch (err) {
      console.error("Gagal menyegarkan data nilai:", err);
    }
  }, [selectedSemester, dbType, selectedWeek, uasSubjectsKey, isSnbtMode]);

  useEffect(() => {
    if (selectedScheduleId) {
      fetchData();
    } else {
      setStudents([]);
      setGrades([]);
    }
  }, [selectedScheduleId, selectedSemester, dbType, selectedWeek, uasSubjectsKey, isSnbtMode, fetchData]);

  useEffect(() => {
    document.body.style.overflow = (formOpen || deleteId) ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [formOpen, deleteId]);

  const handleOpenForm = (student: Student, existingGrade?: Grade) => {
    if (inputLocked) return;
    setActiveStudent(student);
    if (existingGrade) {
      setEditId(existingGrade._id);
      setFormScore(existingGrade.score);
      setFormScoreConcept(existingGrade.scoreConcept || 0);
      setFormScoreQuiz(existingGrade.scoreQuiz || 0);
      setFormScoreAttitude(existingGrade.scoreAttitude || 0);
      setFormTitle(existingGrade.title || "");
      setFormNotes(existingGrade.notes || "");
    } else {
      setEditId(null);
      setFormScore(0);
      setFormScoreConcept(0);
      setFormScoreQuiz(0);
      setFormScoreAttitude(0);
      setFormTitle(selectedType === "TUGAS" ? `Kelas Minggu Cerdas ${selectedWeek}` : "");
      setFormNotes("");
    }

    if (isSnbtMode) {
      // SNBT: prefill TO1/TO2 dari record per (student, week, subject[, subTest]).
      // KBM tidak di form ini — diinput lewat tipe "Kelas Minggu Cerdas".
      // editId tidak dipakai di mode SNBT karena 1 form simpan banyak record;
      // setiap record di-PUT terpisah berdasarkan _id-nya masing-masing saat save.
      setEditId(null);
      const studentGrades = grades.filter(
        (g) => getStudentId(g.studentId) === student._id
      );
      let noteSources: (Grade | undefined)[] = [];
      if (hasSubTests) {
        // Mode sub-tes: 1 input per (TO, sub-tes) — record legacy tanpa subTest
        // tidak di-prefill (biar gak ketimpa; nilainya tetap tampil di tabel).
        const subs: Record<string, string> = {};
        for (const to of ["TO1", "TO2"] as const) {
          for (const st of snbtSubTests) {
            const rec = studentGrades.find(
              (g) => g.type === "TRYOUT" && g.subject === to && (g.subTest ?? null) === st.code
            );
            if (rec) subs[`${to}:${st.code}`] = String(rec.score);
            noteSources.push(rec);
          }
        }
        setFormSnbtSubs(subs);
        setFormSnbtTo1("");
        setFormSnbtTo2("");
      } else {
        const to1 = studentGrades.find(
          (g) => g.type === "TRYOUT" && g.subject === "TO1" && !g.subTest
        );
        const to2 = studentGrades.find(
          (g) => g.type === "TRYOUT" && g.subject === "TO2" && !g.subTest
        );
        setFormSnbtTo1(to1 ? String(to1.score) : "");
        setFormSnbtTo2(to2 ? String(to2.score) : "");
        setFormSnbtSubs({});
        noteSources = [to1, to2];
      }
      // Catatan di-share antar record; pilih notes pertama yang non-empty.
      const withNotes = noteSources.find((g) => g?.notes && g.notes.trim());
      setFormNotes(withNotes?.notes || "");
      setFormTitle(""); // SNBT pakai title generated saat save, bukan input manual
      setFormOpen(true);
      return;
    }

    if (dbType === "UAS") {
      const initial: Record<string, number> = {};
      const studentGrades = grades.filter(g => getStudentId(g.studentId) === student._id);
      for (const opt of uasSubjectOptions) {
        const found = studentGrades.find(g => g.subject === opt.value);
        initial[opt.value] = found?.score || 0;
      }
      setFormUasScores(initial);
      // Prefill notes dari subject record yang punya notes (semua subject share catatan yang sama)
      if (!existingGrade) {
        const withNotes = studentGrades.find(g => g.notes && g.notes.trim());
        setFormNotes(withNotes?.notes || "");
      }
    }
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!activeStudent || isReadOnly) return;
    if (inputLocked) return;
    setSubmitting(true);
    try {
      if (isSnbtMode) {
        // Susun daftar slot Try Out: mode sub-tes = 1 slot per (TO, sub-tes);
        // mode legacy = 2 slot TO1/TO2. KBM tidak disimpan dari form ini —
        // diinput lewat tipe "Kelas Minggu Cerdas" (TUGAS). Validasi 0-100 +
        // minimal 1 input terisi (0 boleh, kosong tidak).
        type SnbtSlot = {
          type: "TRYOUT";
          subject: string;
          subTest?: string;
          raw: string;
          titleLabel: string;
        };
        const parsed: SnbtSlot[] = hasSubTests
          ? [
              ...snbtSubTests.map((st) => ({
                type: "TRYOUT" as const,
                subject: "TO1",
                subTest: st.code,
                raw: formSnbtSubs[`TO1:${st.code}`] ?? "",
                titleLabel: `Try Out 1 — ${st.label}`,
              })),
              ...snbtSubTests.map((st) => ({
                type: "TRYOUT" as const,
                subject: "TO2",
                subTest: st.code,
                raw: formSnbtSubs[`TO2:${st.code}`] ?? "",
                titleLabel: `Try Out 2 — ${st.label}`,
              })),
            ]
          : [
              { type: "TRYOUT", subject: "TO1", raw: formSnbtTo1, titleLabel: "Try Out 1" },
              { type: "TRYOUT", subject: "TO2", raw: formSnbtTo2, titleLabel: "Try Out 2" },
            ];
        const filled = parsed.filter((p) => p.raw.trim() !== "");
        if (filled.length === 0) {
          // Task body eksplisit: kalau semua input kosong (bukan 0), tolak.
          throw new Error("Isi minimal salah satu nilai Try Out");
        }
        for (const p of filled) {
          const n = Number(p.raw);
          if (!Number.isFinite(n) || n < 0 || n > 100) {
            throw new Error(`${p.titleLabel}: nilai harus 0-100`);
          }
        }

        // Cari existing record per slot supaya kita bisa PUT (bukan duplikasi POST).
        // Slot kosong yang punya record existing = user dengan sengaja kosongin
        // setelah sebelumnya isi → biar simple kita SKIP, tidak hapus. Reviewer
        // bisa pakai mode lain kalau perlu hapus. (Lihat note di summary.)
        const studentGrades = grades.filter(
          (g) => getStudentId(g.studentId) === activeStudent._id
        );
        const findExisting = (slot: SnbtSlot): Grade | undefined => {
          return studentGrades.find(
            (g) =>
              g.type === slot.type &&
              (slot.subject ? g.subject === slot.subject : true) &&
              // Cocokkan sub-tes secara eksak: slot legacy (tanpa subTest)
              // tidak boleh nge-PUT record sub-tes, dan sebaliknya.
              (g.subTest ?? null) === (slot.subTest ?? null)
          );
        };

        const week = parseInt(selectedWeek, 10);
        const ops = filled.map((p) => {
          const score = Number(p.raw);
          const existing = findExisting(p);
          const payload: Record<string, unknown> = {
            studentId: activeStudent._id,
            type: p.type,
            week,
            scheduleId: selectedScheduleId,
            score,
            title: `${p.titleLabel} #${week}`,
            notes: formNotes,
            semester: selectedSemester,
          };
          if (p.subject) payload.subject = p.subject;
          if (p.subTest) payload.subTest = p.subTest;
          return fetch(
            existing
              ? `/api/volunteer/evaluation/${existing._id}`
              : "/api/volunteer/evaluation",
            {
              method: existing ? "PUT" : "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            }
          ).then(async (res) => {
            if (!res.ok) {
              const body = await res.json().catch(() => ({}));
              throw new Error(
                body?.error || `Gagal simpan ${p.titleLabel}`
              );
            }
          });
        });
        await Promise.all(ops);
      } else if (dbType === "UAS") {
        const ops = uasSubjectOptions.map(async (opt) => {
          const score = formUasScores[opt.value] || 0;
          const studentGrades = grades.filter(g => getStudentId(g.studentId) === activeStudent._id);
          const existing = studentGrades.find(g => g.subject === opt.value);

          // maxScore ikut konfigurasi admin per fase (bisa != 100), bukan
          // hardcode 100. UAS tidak kirim week/meetingWeek — server memvalidasi
          // jendela UAS (pertemuan terakhir) dari scheduleId.
          const payload = {
            studentId: activeStudent._id,
            type: "UAS",
            title: `UAS ${formatSubjectLabel(opt.label)}`,
            semester: selectedSemester,
            subject: opt.value,
            score,
            maxScore: opt.defaultMax || 100,
            notes: formNotes,
            scheduleId: selectedScheduleId,
          };

          const res = await fetch(existing ? `/api/volunteer/evaluation/${existing._id}` : "/api/volunteer/evaluation", {
            method: existing ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `Gagal simpan ${formatSubjectLabel(opt.label)}`);
          }
        });
        await Promise.all(ops);
      } else {
        const payload = {
          studentId: activeStudent._id,
          type: dbType,
          week: dbType === "TUGAS" ? parseInt(selectedWeek) : null,
          scheduleId: selectedScheduleId,
          title: formTitle,
          notes: formNotes,
          semester: selectedSemester,
          score: formScore,
          scoreConcept: formScoreConcept,
          scoreQuiz: formScoreQuiz,
          scoreAttitude: formScoreAttitude,
        };
        const res = await fetch(editId ? `/api/volunteer/evaluation/${editId}` : "/api/volunteer/evaluation", {
          method: editId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          // Surface pesan server (403 pertemuan belum mulai / semester tidak
          // sesuai / 400 nilai invalid) — jangan ditelan jadi error generik.
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error || "Gagal menyimpan");
        }
      }
      setToast({ type: "success", message: "Nilai berhasil disimpan" });
      refreshGrades();
      setFormOpen(false);
    } catch (err) {
      setToast({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/volunteer/evaluation/${deleteId}`, { method: "DELETE" });
      if (res.ok) {
        setToast({ type: "success", message: "Nilai dihapus" });
        refreshGrades();
        setDeleteId(null);
      }
    } catch (err) {
      setToast({ type: "error", message: getErrorMessage(err) });
    } finally {
      setSubmitting(false);
    }
  };

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedStudents = filteredStudents.slice((safePage - 1) * pageSize, safePage * pageSize);


  if (!hasMounted) return null;

  return (
    <div className={`${styles.main} ${mounted ? styles.mainEnter : ""}`}>
      {toast && (
        <ToastNotification message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.heroText}>
            <span className={styles.heroLabel}>AKADEMIK</span>
            <h1 className={styles.heroTitle}>Input Nilai Terintegrasi.</h1>
            <p className={styles.heroDesc}>Pencatatan perkembangan belajar siswa sesuai jadwal aktif.</p>
          </div>
        </div>
      </div>

      <VolunteerFilterPanel title="Filter Penilaian">
        <div className={styles.filterBar}>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Jadwal Mengajar</label>
          <select
            className={styles.filterSelect}
            value={selectedScheduleId}
            onChange={(e) => {
              const nextId = e.target.value;
              setSelectedScheduleId(nextId);
              setCurrentPage(1);
              const sched = schedules.find((s) => s._id === nextId);
              if (sched) {
                const kbm = sched.kbmDates ?? [];
                const target = kbm.find((k) => k.week === sched.activeWeek) ?? kbm[0];
                if (target) {
                  setSelectedWeek(String(target.week));
                }
              }
            }}
          >
            <option value="">-- Pilih Jadwal --</option>
            {schedules.filter(s => s.semester === selectedSemester).map(s => (
              <option key={s._id} value={s._id}>{s.region} — {s.fase}</option>
            ))}
          </select>
        </div>
        <div className={styles.filterItem}>
          <label className={styles.filterLabel}>Tipe Penilaian</label>
          <select
            className={styles.filterSelect}
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value as EvalTypeValue);
              setCurrentPage(1);
            }}
          >
            {/* Fase SNBT: tipe khusus TO/KBM di urutan pertama + semua tipe reguler. */}
            {isSnbt && (
              <option value={SNBT_TYPE_VALUE}>{SNBT_TYPE_LABEL}</option>
            )}
            {EVAL_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        {(selectedType === "TUGAS" || isSnbtMode) && (
          <div className={styles.filterItem} style={{ flex: 0, minWidth: 200 }}>
            <label className={styles.filterLabel}>Pekan</label>
            <select
              className={styles.filterSelect}
              value={selectedWeek}
              onChange={(e) => {
                setSelectedWeek(e.target.value);
                setCurrentPage(1);
              }}
              disabled={!selectedScheduleId}
            >
              {(() => {
                const sched = schedules.find((s) => s._id === selectedScheduleId);
                const list = sched?.kbmDates ?? [];
                if (!sched) return <option value="">-- Pilih jadwal --</option>;
                if (list.length === 0) {
                  // Fallback: kalau gak ada kbmDates, biarin user input manual
                  return <option value={selectedWeek}>Pekan {selectedWeek}</option>;
                }
                // Hanya pekan yang sudah mulai + 1 pekan terdekat berikutnya
                // (disabled) — sembunyikan sisa pekan future biar dropdown
                // gak panjang. Lalu group by bulan biar rapi.
                const sorted = limitToStartedMeetings(list);
                const monthFmt = new Intl.DateTimeFormat("id-ID", {
                  timeZone: "Asia/Jakarta",
                  month: "long",
                  year: "numeric",
                });
                const groups: { month: string; items: typeof sorted }[] = [];
                for (const k of sorted) {
                  const d = new Date(k.date);
                  const monthLabel = monthFmt.format(d);
                  const last = groups[groups.length - 1];
                  if (last && last.month === monthLabel) {
                    last.items.push(k);
                  } else {
                    groups.push({ month: monthLabel, items: [k] });
                  }
                }
                return groups.map((g) => (
                  <optgroup key={g.month} label={g.month}>
                    {g.items.map((k) => {
                      const future = isFutureDate(k.date);
                      return (
                        <option key={k.week} value={String(k.week)} disabled={future}>
                          Pekan {k.week} · {formatKbmDateShort(k.date)}
                          {future ? " · belum mulai" : ""}
                        </option>
                      );
                    })}
                  </optgroup>
                ));
              })()}
            </select>
          </div>
        )}
        <div className={styles.filterItem} style={{ flex: 2 }}>
          <label className={styles.filterLabel}>Cari Siswa</label>
          <input
            type="text"
            className={styles.filterSelect}
            placeholder="Ketik nama siswa..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        </div>
      </VolunteerFilterPanel>

      <div className={styles.tableWrap}>
        {lockMessage && (
          <div className={styles.futureMeetingLock} role="status">
            <Lock size={14} aria-hidden="true" />
            <span>
              <strong>Belum bisa diisi.</strong> {lockMessage}
            </span>
          </div>
        )}
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
            <p>Memuat data...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div style={{textAlign: 'center', padding: 100}}>
            <p style={{color: '#94a3b8', fontWeight: 600}}>Data tidak ditemukan.</p>
          </div>
        ) : isSnbtMode ? (
          // SNBT: 1 row per siswa, kolom TO1/KBM/TO2 (skor untuk pertemuan
          // yang sedang dipilih). Kalau fase punya sub-tes, nilai TO yang
          // tampil = rata-rata sub-tes terisi (rincian di tooltip).
          // Klik tombol → buka form gabung.
          <div style={{ overflowX: 'auto' }}>
            <table className={`${styles.table} ${styles.uasTable}`}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Siswa</th>
                  <th>Kategori</th>
                  <th style={{ minWidth: '90px' }}>🎯 TO1{hasSubTests ? " (rata²)" : ""}</th>
                  <th style={{ minWidth: '90px' }} title='Rata-rata Konsep/Kuis/Sikap — diinput lewat tipe "Kelas Minggu Cerdas"'>📚 KBM (MC)</th>
                  <th style={{ minWidth: '90px' }}>🏁 TO2{hasSubTests ? " (rata²)" : ""}</th>
                  <th style={{ minWidth: '180px' }}>Catatan</th>
                  <th style={{ minWidth: '120px' }}>Status</th>
                  <th style={{ textAlign: "right", minWidth: '120px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const studentGrades = grades.filter(g => getStudentId(g.studentId) === student._id);
                  // Nilai TO per pekan: rata-rata record sub-tes kalau ada,
                  // fallback ke record legacy (tanpa subTest) kalau tidak.
                  const getToDisplay = (subject: "TO1" | "TO2") => {
                    const subs = studentGrades.filter(
                      (g) => g.type === "TRYOUT" && g.subject === subject && g.subTest
                    );
                    if (subs.length > 0) {
                      const avg = Math.round(subs.reduce((a, g) => a + g.score, 0) / subs.length);
                      const detail = subs
                        .map((g) => {
                          const label = snbtSubTests.find((st) => st.code === g.subTest)?.label || g.subTest;
                          return `${label}: ${g.score}`;
                        })
                        .join(" · ");
                      return { score: avg, filled: subs.length, tooltip: `Rata-rata ${subs.length} sub-tes — ${detail}` };
                    }
                    const legacy = studentGrades.find(
                      (g) => g.type === "TRYOUT" && g.subject === subject && !g.subTest
                    );
                    return legacy
                      ? { score: legacy.score, filled: 1, tooltip: "Skor total (tanpa sub-tes)" }
                      : null;
                  };
                  const to1 = getToDisplay("TO1");
                  // KBM = record Minggu Cerdas (TUGAS) pekan ini; skornya sudah
                  // rata-rata Konsep/Kuis/Sikap. Fallback ke TUGAS_SNBT legacy.
                  const kbmTugas = studentGrades.find(g => g.type === "TUGAS");
                  const kbmLegacy = studentGrades.find(g => g.type === "TUGAS_SNBT");
                  const kbm = kbmTugas ?? kbmLegacy;
                  const kbmTooltip = kbmTugas
                    ? `Rata-rata Minggu Cerdas — Konsep: ${kbmTugas.scoreConcept ?? 0} · Kuis: ${kbmTugas.scoreQuiz ?? 0} · Sikap: ${kbmTugas.scoreAttitude ?? 0}. Edit lewat tipe "Kelas Minggu Cerdas".`
                    : kbmLegacy
                    ? "KBM SNBT legacy (1 skor). Input baru lewat tipe \"Kelas Minggu Cerdas\"."
                    : undefined;
                  const to2 = getToDisplay("TO2");
                  // Status: mode sub-tes hitung slot terisi dari total
                  // (sub-tes × 2 TO) + KBM; mode legacy tetap n/3.
                  const totalSlots = hasSubTests ? snbtSubTests.length * 2 + 1 : 3;
                  const filledCount = hasSubTests
                    ? (to1?.filled ?? 0) + (to2?.filled ?? 0) + (kbm ? 1 : 0)
                    : [to1, kbm, to2].filter(Boolean).length;
                  const noteRecord = studentGrades.find(g => g.notes && g.notes.trim());
                  return (
                    <tr key={student._id}>
                      <td className={styles.stickyCol}>
                        <div className={styles.studentCell}>
                          <div className={styles.studentAva} style={{ background: getRandomColor(student.name) }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>
                              {student.studentCode ? `NIS ${student.studentCode}` : "NIS belum tersedia"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize: 12, fontWeight: 600, color: '#64748b'}}>{student.fase}</span></td>
                      <td>
                        {to1 ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(to1.score)}`} title={to1.tooltip}>{to1.score}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {kbm ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(kbm.score)}`} title={kbmTooltip}>{kbm.score}</span>
                        ) : <span className={styles.emptyDash} title='KBM diinput lewat tipe "Kelas Minggu Cerdas"'>—</span>}
                      </td>
                      <td>
                        {to2 ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(to2.score)}`} title={to2.tooltip}>{to2.score}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {noteRecord ? (
                          <div className={styles.gradeNote} title={noteRecord.notes}>{noteRecord.notes}</div>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        <span className={`${styles.uasStatusBadge} ${filledCount === 0 ? styles.uasStatusEmpty : styles.uasStatusFull}`}>
                          {filledCount === 0 ? "Belum Dinilai" : `${filledCount}/${totalSlots} Terisi`}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className={`${styles.uasActionBtn} ${filledCount > 0 ? styles.outline : styles.primary}`}
                          onClick={() => handleOpenForm(student)}
                          disabled={inputLocked}
                          title={lockTitle}
                        >
                          {filledCount > 0 ? "Edit Nilai" : "Input Nilai"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : dbType === "UAS" ? (
          <div style={{ overflowX: 'auto' }}>
            <table className={`${styles.table} ${styles.uasTable}`}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Siswa</th>
                  <th>Kategori</th>
                  {uasSubjectOptions.map((opt) => (
                    <th key={opt.value} style={{ minWidth: '90px' }}>
                      {formatSubjectLabel(opt.label, { stripPrefix: true })}
                    </th>
                  ))}
                  <th style={{ minWidth: '180px' }}>Catatan</th>
                  <th style={{ minWidth: '120px' }}>Status</th>
                  <th style={{ textAlign: "right", minWidth: '120px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const studentGrades = grades.filter(g => getStudentId(g.studentId) === student._id);
                  const gradeBySubject: Record<string, Grade | undefined> = {};
                  for (const g of studentGrades) if (g.subject) gradeBySubject[g.subject] = g;
                  
                  const filledCount = uasSubjectOptions.filter(opt => typeof gradeBySubject[opt.value]?.score === "number").length;

                  return (
                    <tr key={student._id}>
                      <td className={styles.stickyCol}>
                        <div className={styles.studentCell}>
                          <div className={styles.studentAva} style={{ background: getRandomColor(student.name) }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>
                              {student.studentCode ? `NIS ${student.studentCode}` : "NIS belum tersedia"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize: 12, fontWeight: 600, color: '#64748b'}}>{student.fase}</span></td>
                        {uasSubjectOptions.map((opt) => {
                          const g = gradeBySubject[opt.value];
                          return (
                            <td key={opt.value}>
                              {g ? (
                                <span className={`${styles.uasScoreChip} ${getScoreColor(g.score)}`}>{g.score}</span>
                              ) : <span className={styles.emptyDash}>—</span>}
                            </td>
                          );
                        })}
                        <td>
                          {(() => {
                            const noteGrade = studentGrades.find(g => g.notes && g.notes.trim());
                            return noteGrade ? (
                              <div className={styles.gradeNote} title={noteGrade.notes}>{noteGrade.notes}</div>
                            ) : <span className={styles.emptyDash}>—</span>;
                          })()}
                        </td>
                        <td>
                          <span className={`${styles.uasStatusBadge} ${filledCount === 0 ? styles.uasStatusEmpty : styles.uasStatusFull}`}>
                          {filledCount === 0 ? "Belum Dinilai" : "Sudah Dinilai"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className={`${styles.uasActionBtn} ${filledCount > 0 ? styles.outline : styles.primary}`} onClick={() => handleOpenForm(student)} disabled={inputLocked} title={lockTitle}>
                          {filledCount > 0 ? "Edit Nilai" : "Input Nilai"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : dbType === "TUGAS" ? (
          <div style={{ overflowX: 'auto' }}>
            <table className={`${styles.table} ${styles.uasTable}`}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Siswa</th>
                  <th>Kategori</th>
                  <th style={{ minWidth: '90px' }}>Konsep</th>
                  <th style={{ minWidth: '90px' }}>Kuis</th>
                  <th style={{ minWidth: '90px' }}>Sikap</th>
                  <th style={{ minWidth: '180px' }}>Catatan</th>
                  <th style={{ minWidth: '120px' }}>Status</th>
                  <th style={{ textAlign: "right", minWidth: '120px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const studentGrades = grades.filter(g => getStudentId(g.studentId) === student._id);
                  const g = studentGrades[0]; // Tugas usually has one record per week

                  return (
                    <tr key={student._id}>
                      <td className={styles.stickyCol}>
                        <div className={styles.studentCell}>
                          <div className={styles.studentAva} style={{ background: getRandomColor(student.name) }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>
                              {student.studentCode ? `NIS ${student.studentCode}` : "NIS belum tersedia"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize: 12, fontWeight: 600, color: '#64748b'}}>{student.fase}</span></td>
                      <td>
                        {g?.scoreConcept !== undefined ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(g.scoreConcept)}`}>{g.scoreConcept}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g?.scoreQuiz !== undefined ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(g.scoreQuiz)}`}>{g.scoreQuiz}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g?.scoreAttitude !== undefined ? (
                          <span className={`${styles.uasScoreChip} ${getScoreColor(g.scoreAttitude)}`}>{g.scoreAttitude}</span>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g?.notes && g.notes.trim() ? (
                          <div className={styles.gradeNote} title={g.notes}>{g.notes}</div>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td>
                        {g ? (
                          <span className={`${styles.uasStatusBadge} ${styles.uasStatusFull}`}>Sudah Dinilai</span>
                        ) : (
                          <span className={`${styles.uasStatusBadge} ${styles.uasStatusEmpty}`}>Belum Dinilai</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button className={`${styles.uasActionBtn} ${g ? styles.outline : styles.primary}`} onClick={() => handleOpenForm(student, g)} disabled={inputLocked} title={lockTitle}>
                          {g ? "Edit Nilai" : "Input Nilai"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th className={styles.stickyCol}>Siswa</th>
                  <th>Kategori</th>
                  <th>Status</th>
                  <th>Rincian Nilai</th>
                  <th style={{ textAlign: "right" }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((student) => {
                  const studentGrades = grades.filter(g => getStudentId(g.studentId) === student._id);
                  return (
                    <tr key={student._id}>
                      <td className={styles.stickyCol}>
                        <div className={styles.studentCell}>
                          <div className={styles.studentAva} style={{ background: getRandomColor(student.name) }}>
                            {student.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className={styles.studentCellName}>{student.name}</div>
                            <div className={styles.studentCellSub}>
                              {student.studentCode ? `NIS ${student.studentCode}` : "NIS belum tersedia"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td><span style={{fontSize: 12, fontWeight: 600, color: '#64748b'}}>{student.fase}</span></td>
                      <td>
                        {studentGrades.length > 0 ? (
                          <span className={`${styles.typeBadge} ${styles.typeKuis}`}>DINILAI</span>
                        ) : <span className={`${styles.typeBadge} ${styles.typeEmpty}`}>BELUM</span>}
                      </td>
                      <td>
                        {studentGrades.length > 0 ? (
                          <div className={styles.gradeList}>
                            {studentGrades.map(g => (
                              <div key={g._id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                <div className={styles.gradeChip}>
                                  {g.type === "TUGAS" ? (
                                    `K:${g.scoreConcept} Q:${g.scoreQuiz} S:${g.scoreAttitude}`
                                  ) : g.score}
                                </div>
                                {g.notes && g.notes.trim() && (
                                  <div className={styles.gradeNote} title={g.notes}>{g.notes}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        ) : <span className={styles.emptyDash}>—</span>}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {studentGrades.length > 0 ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                            <button className={styles.btnEdit} onClick={() => handleOpenForm(student, studentGrades[0])} disabled={inputLocked} title={lockTitle}>Edit</button>
                            <button className={styles.btnDanger} onClick={() => setDeleteId(studentGrades[0]._id)}>Hapus</button>
                          </div>
                        ) : (
                          <button className={styles.btnPrimary} onClick={() => handleOpenForm(student)} disabled={inputLocked} title={lockTitle}>Input Nilai</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filteredStudents.length > 0 && (
          <div className={styles.tablePagination}>
            <AdminPagination
              page={safePage}
              totalItems={filteredStudents.length}
              itemsPerPage={pageSize}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {formOpen && activeStudent && (
        <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={isSnbtMode ? `Input Nilai SNBT — Pekan #${selectedWeek}` : (editId ? "Edit Penilaian" : "Input Penilaian")} footer={
          <>
            <button className={styles.btnSecondary} onClick={() => setFormOpen(false)}>Batal</button>
            <button className={styles.btnPrimary} onClick={handleSave} disabled={submitting || inputLocked}>
              {isSnbtMode ? `Simpan Pertemuan #${selectedWeek}` : "Simpan Nilai"}
            </button>
          </>
        }>
          <div className={styles.formGrid}>
            <div className={styles.fieldRow}>
              <div className={styles.field} style={{flex: 1}}>
                <label className={styles.fieldLabel}>Nama Siswa</label>
                <input type="text" className={styles.formInput} value={activeStudent.name} disabled />
              </div>
              {!isSnbtMode && (
                <div className={styles.field} style={{flex: 1}}>
                  <label className={styles.fieldLabel}>Judul Pertemuan</label>
                  <input type="text" className={styles.formInput} placeholder="Contoh: Kelas Minggu Cerdas 1" value={formTitle} onChange={e => setFormTitle(e.target.value)} />
                </div>
              )}
              {isSnbtMode && (
                <div className={styles.field} style={{flex: 1}}>
                  <label className={styles.fieldLabel}>Pekan</label>
                  <input type="text" className={styles.formInput} value={`Pertemuan #${selectedWeek}`} disabled />
                </div>
              )}
            </div>
            {isSnbtMode && hasSubTests ? (
              // Mode sub-tes: TO1 per sub-tes → TO2 per sub-tes. KBM diinput
              // lewat tipe "Kelas Minggu Cerdas" (Konsep/Kuis/Sikap).
              // Pakai string state supaya bisa bedain kosong vs 0 (siswa absen = 0).
              <div className={styles.scoreCard}>
                {(["TO1", "TO2"] as const).map((to, toIdx) => (
                  <div key={to}>
                    <div className={styles.scoreItem}>
                      <div className={styles.scoreInfo}>
                        <div className={styles.scoreIcon} style={toIdx === 0 ? { background: '#fef3c7', color: '#b45309' } : { background: '#dcfce7', color: '#15803d' }}>
                          {toIdx === 0 ? "🎯" : "🏁"}
                        </div>
                        <div>
                          <div className={styles.scoreName}>{toIdx === 0 ? "Try Out 1" : "Try Out 2"}</div>
                          <div style={{fontSize: 11, color: '#94a3b8'}}>
                            {toIdx === 0 ? "Sebelum KBM" : "Sesudah KBM"} · per sub-tes 0-100 · nilai TO = rata-rata
                          </div>
                        </div>
                      </div>
                    </div>
                    {snbtSubTests.map((st) => {
                      const key = `${to}:${st.code}`;
                      return (
                        <div key={key} className={styles.scoreItem} style={{ paddingLeft: 24 }}>
                          <div className={styles.scoreInfo}>
                            <div className={styles.scoreIcon} style={{ background: '#f8fafc', color: '#475569', fontSize: 10 }}>{st.code.slice(0, 3)}</div>
                            <div><div className={styles.scoreName}>{st.label}</div></div>
                          </div>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            inputMode="numeric"
                            className={styles.scoreInput}
                            placeholder="—"
                            value={formSnbtSubs[key] ?? ""}
                            onChange={e => {
                              const v = clampOptionalScore(e.target.value);
                              setFormSnbtSubs(prev => ({ ...prev, [key]: v }));
                            }}
                            onFocus={e => e.target.select()}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}
                <div style={{ fontSize: 12, color: '#64748b', padding: '8px 4px 0' }}>
                  📚 Nilai KBM diinput lewat tipe <strong>Kelas Minggu Cerdas</strong> (Konsep/Kuis/Sikap) — rata-ratanya otomatis jadi nilai KBM SNBT pekan ini.
                </div>
              </div>
            ) : isSnbtMode ? (
              // Mode legacy (fase tanpa sub-tes): 2 input numerik TO1 → TO2.
              <div className={styles.scoreCard}>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#fef3c7', color: '#b45309' }}>🎯</div>
                    <div>
                      <div className={styles.scoreName}>Try Out 1</div>
                      <div style={{fontSize: 11, color: '#94a3b8'}}>Sebelum KBM · 0-100</div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    className={styles.scoreInput}
                    placeholder="—"
                    value={formSnbtTo1}
                    onChange={e => setFormSnbtTo1(clampOptionalScore(e.target.value))}
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#dcfce7', color: '#15803d' }}>🏁</div>
                    <div>
                      <div className={styles.scoreName}>Try Out 2</div>
                      <div style={{fontSize: 11, color: '#94a3b8'}}>Sesudah KBM · 0-100</div>
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    inputMode="numeric"
                    className={styles.scoreInput}
                    placeholder="—"
                    value={formSnbtTo2}
                    onChange={e => setFormSnbtTo2(clampOptionalScore(e.target.value))}
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div style={{ fontSize: 12, color: '#64748b', padding: '8px 4px 0' }}>
                  📚 Nilai KBM diinput lewat tipe <strong>Kelas Minggu Cerdas</strong> (Konsep/Kuis/Sikap) — rata-ratanya otomatis jadi nilai KBM SNBT pekan ini.
                </div>
              </div>
            ) : dbType === "TUGAS" ? (
              <div className={styles.scoreCard}>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#e0f2fe', color: '#0369a1' }}>💡</div>
                    <div><div className={styles.scoreName}>Konsep</div></div>
                  </div>
                  <input 
                    type="number" 
                    min={0}
                    max={100}
                    className={styles.scoreInput} 
                    value={formScoreConcept} 
                    onChange={e => setFormScoreConcept(clampScore(e.target.value))}
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#fef2f2', color: '#991b1b' }}>📝</div>
                    <div><div className={styles.scoreName}>Kuis</div></div>
                  </div>
                  <input 
                    type="number" 
                    min={0}
                    max={100}
                    className={styles.scoreInput} 
                    value={formScoreQuiz} 
                    onChange={e => setFormScoreQuiz(clampScore(e.target.value))}
                    onFocus={e => e.target.select()}
                  />
                </div>
                <div className={styles.scoreItem}>
                  <div className={styles.scoreInfo}>
                    <div className={styles.scoreIcon} style={{ background: '#f0fdf4', color: '#166534' }}>⭐</div>
                    <div><div className={styles.scoreName}>Sikap</div></div>
                  </div>
                  <input 
                    type="number" 
                    min={0}
                    max={100}
                    className={styles.scoreInput} 
                    value={formScoreAttitude} 
                    onChange={e => setFormScoreAttitude(clampScore(e.target.value))}
                    onFocus={e => e.target.select()}
                  />
                </div>
              </div>
            ) : dbType === "UAS" ? (
              <div className={styles.scoreCard}>
                {uasSubjectOptions.map((opt, idx) => (
                  <div key={opt.value} className={styles.scoreItem}>
                    <div className={styles.scoreInfo}>
                      <div className={styles.scoreIcon} style={{ background: '#f8fafc', color: '#475569' }}>{idx + 1}</div>
                      <div><div className={styles.scoreName}>{formatSubjectLabel(opt.label)}</div></div>
                    </div>
                    <input
                      type="number"
                      min={0}
                      max={opt.defaultMax || 100}
                      className={styles.scoreInput}
                      value={formUasScores[opt.value] || 0}
                      onChange={e => setFormUasScores(prev => ({...prev, [opt.value]: clampScore(e.target.value, opt.defaultMax || 100)}))}
                      onFocus={e => e.target.select()}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Skor Akhir</label>
                <input 
                  type="number" 
                  min={0}
                  max={100}
                  className={styles.formInput} 
                  value={formScore} 
                  onChange={e => setFormScore(clampScore(e.target.value))}
                  onFocus={e => e.target.select()}
                />
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Catatan (Opsional)</label>
              <textarea className={styles.formTextarea} placeholder="Ketik feedback..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />
            </div>
          </div>
        </Modal>
      )}

      {deleteId && (
        <Modal isOpen={!!deleteId} onClose={() => setDeleteId(null)} title="Konfirmasi Hapus" footer={
          <>
            <button className={styles.btnSecondary} onClick={() => setDeleteId(null)}>Batal</button>
            <button className={styles.btnDanger} onClick={handleDelete} disabled={submitting}>Ya, Hapus</button>
          </>
        }>
          <p style={{fontSize: 14, color: '#475569', textAlign: 'center'}}>Yakin ingin menghapus nilai ini?</p>
        </Modal>
      )}
    </div>
  );
}
