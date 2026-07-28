"use client";

import AdminFilterSelect from "@/components/admin/ui/AdminFilterSelect/AdminFilterSelect";
import AdminModal from "@/components/admin/ui/AdminModal/AdminModal";
import { useEffect, useState, useMemo } from "react";
import styles from "./reportConfig.module.css";
import type {
  FaseConfig,
  ReportRubric,
  UasComponent,
  PredikatTier,
  TryoutSubTest,
} from "@/lib/reportDefaults";
import { useDialog } from "@/components/ui/DialogProvider";
import Spinner from "@/components/ui/Spinner/Spinner";

type Tab = "fase" | "rubric";

type Toast = { type: "success" | "error"; text: string } | null;
type NarrativeCode = keyof ReportRubric["narasi"];
type NarrativeField = keyof ReportRubric["narasi"]["A"];

const NARRATIVE_FIELDS: { key: NarrativeField; label: string }[] = [
  { key: "kognitif", label: "Narasi Kognitif" },
  { key: "sikap", label: "Narasi Sikap" },
  { key: "rekomendasiSiswa", label: "Rekomendasi Siswa" },
  { key: "rekomendasiOrtu", label: "Rekomendasi Orang Tua" },
];

export default function ReportConfigPage() {
  const { showConfirm } = useDialog();
  const [tab, setTab] = useState<Tab>("fase");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  const [faseConfig, setFaseConfig] = useState<Record<string, FaseConfig>>({});
  const [rubric, setRubric] = useState<ReportRubric | null>(null);
  const [selectedFase, setSelectedFase] = useState<string>("");

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Gagal memuat pengaturan");
      const data = await res.json();
      setFaseConfig(data.faseConfig || {});
      setRubric(data.reportRubric || null);
      const firstKey = Object.keys(data.faseConfig || {})[0] || "";
      setSelectedFase(firstKey);
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // queueMicrotask supaya setState sebelum await tidak dianggap sync
    // (React 19 warning "set-state-in-effect").
    queueMicrotask(() => {
      fetchData();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveFaseConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ faseConfig }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      showToast("success", "Konfigurasi fase tersimpan");
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const saveRubric = async () => {
    if (!rubric) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportRubric: rubric }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      showToast("success", "Rubrik tersimpan");
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  // CRUD fase sekarang dilakukan di /admin/semesters?tab=lokasi-belajar.
  // Untuk recovery konfigurasi default, gunakan endpoint
  // GET /api/admin/settings/defaults?key=faseConfig via cURL/admin tool.

  const resetRubricToDefault = async () => {
    const isConfirmed = await showConfirm(
      "Reset rubrik ke default? Perubahan custom akan hilang.",
      "Reset Rubrik"
    );
    if (!isConfirmed) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/settings/defaults?key=reportRubric");
      if (!res.ok) throw new Error("Gagal mengambil default");
      const def = await res.json();
      const save = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportRubric: def.value }),
      });
      if (!save.ok) throw new Error("Gagal menyimpan default");
      setRubric(def.value);
      showToast("success", "Rubrik di-reset ke default");
    } catch (err: unknown) {
      showToast("error", err instanceof Error ? err.message : "Gagal reset rubrik");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Memuat konfigurasi...</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Nilai & Rapor</h1>
        <p className={styles.subtitle}>
          Atur komponen penilaian per fase, threshold predikat, dan narasi. Berlaku global untuk seluruh siswa.
        </p>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${tab === "fase" ? styles.tabActive : ""}`}
          onClick={() => setTab("fase")}
        >
          Pembelajaran
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "rubric" ? styles.tabActive : ""}`}
          onClick={() => setTab("rubric")}
        >
          Nilai & Rapor
        </button>
      </div>

      {tab === "fase" && (
        <FaseConfigEditor
          faseConfig={faseConfig}
          setFaseConfig={setFaseConfig}
          selectedFase={selectedFase}
          setSelectedFase={setSelectedFase}
          saving={saving}
          onSave={saveFaseConfig}
        />
      )}

      {tab === "rubric" && rubric && (
        <RubricEditor
          rubric={rubric}
          setRubric={setRubric}
          saving={saving}
          onSave={saveRubric}
          onReset={resetRubricToDefault}
        />
      )}

      {toast && (
        <div className={`${styles.toast} ${toast.type === "error" ? styles.toastError : ""}`}>
          {toast.type === "success" ? "✓" : "⚠"} {toast.text}
        </div>
      )}
    </div>
  );
}

// --- Fase Config Editor ---

function FaseConfigEditor({
  faseConfig,
  setFaseConfig,
  selectedFase,
  setSelectedFase,
  saving,
  onSave,
}: {
  faseConfig: Record<string, FaseConfig>;
  setFaseConfig: (v: Record<string, FaseConfig>) => void;
  selectedFase: string;
  setSelectedFase: (s: string) => void;
  saving: boolean;
  onSave: () => void;
}) {
  const fases = Object.keys(faseConfig);
  const cfg = selectedFase ? faseConfig[selectedFase] : null;

  const updateCfg = (patch: Partial<FaseConfig>) => {
    if (!selectedFase) return;
    setFaseConfig({
      ...faseConfig,
      [selectedFase]: { ...faseConfig[selectedFase], ...patch },
    });
  };

  const updateComponentList = (
    listKey: "uasKognitif" | "uasAfektif",
    list: UasComponent[]
  ) => {
    if (!selectedFase) return;
    updateCfg({ [listKey]: list } as Partial<FaseConfig>);
  };

  const totalMax = useMemo(() => {
    if (!cfg) return 0;
    const kbm = cfg.kbmMaxPerComponent * 3; // konsep+kuis+sikap
    const kog = cfg.uasKognitif.reduce((s, c) => s + (c.maxScore || 0), 0);
    const afe = cfg.uasAfektif.reduce((s, c) => s + (c.maxScore || 0), 0);
    const bing = cfg.uasBInggris?.maxScore || 0;
    return kbm + kog + afe + bing;
  }, [cfg]);
  const kbmTotal = cfg ? cfg.kbmMaxPerComponent * 3 : 0;
  const kognitifTotal = cfg ? cfg.uasKognitif.reduce((s, c) => s + (c.maxScore || 0), 0) : 0;
  const afektifTotal = cfg ? cfg.uasAfektif.reduce((s, c) => s + (c.maxScore || 0), 0) : 0;
  const englishTotal = cfg?.uasBInggris?.maxScore || 0;

  // Kartu sub-tes Try Out hanya relevan untuk fase SNBT (tipe nilai TRYOUT
  // cuma dipakai Kelas Online SNBT).
  const isSnbtFase = Boolean(
    /SNBT/i.test(selectedFase) || (cfg?.jenjang && /SNBT/i.test(cfg.jenjang))
  );

  if (fases.length === 0) {
    return (
      <div className={styles.empty}>
        Belum ada fase. Tambah fase dulu di{" "}
        <a href="/admin/semesters?tab=lokasi-belajar" style={{ color: "var(--admin-primary-dark)", fontWeight: 700 }}>
          Lokasi Belajar & Fase
        </a>
        , baru komponen UAS-nya bisa diatur di sini.
      </div>
    );
  }

  return (
    <>
      <div className={styles.learningNotice}>
        Tambah/hapus/rename fase dilakukan di{" "}
        <a
          href="/admin/semesters?tab=lokasi-belajar"
        >
          Lokasi Belajar & Fase
        </a>
        . Halaman ini fokus untuk mengatur komponen UAS, KBM, dan label jenjang per fase.
      </div>

      <div className={`${styles.toolbar} ${styles.learningToolbar}`}>
        <div className={styles.fasePicker}>
          <span className={styles.fieldLabel}>Fase Aktif</span>
          <AdminFilterSelect
            width="lg"
            value={selectedFase}
            onChange={setSelectedFase}
            options={fases.map(f => ({ value: f, label: f }))}
          />
        </div>
        <div className={styles.toolbarRight}>
          <button className={styles.btnPrimary} onClick={onSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>

      {cfg && (
        <>
          <section className={styles.learningSummary}>
            <div className={styles.learningSummaryMain}>
              <span className={styles.summaryEyebrow}>Konfigurasi Pembelajaran</span>
              <h2>{selectedFase}</h2>
              <p>{cfg.jenjang || "Jenjang belum diisi"}</p>
            </div>
            <div className={styles.summaryStats}>
              <div>
                <span>Total Maks.</span>
                <strong>{totalMax.toLocaleString("id-ID")}</strong>
              </div>
              <div>
                <span>KBM</span>
                <strong>{kbmTotal.toLocaleString("id-ID")}</strong>
              </div>
              <div>
                <span>UAS</span>
                <strong>{(kognitifTotal + afektifTotal + englishTotal).toLocaleString("id-ID")}</strong>
              </div>
            </div>
          </section>

          <div className={styles.learningGrid}>
            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>Identitas Fase</h3>
              <p className={styles.sectionDesc}>Label jenjang akan muncul di header rapor.</p>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Jenjang</label>
                  <input
                    className={styles.input}
                    value={cfg.jenjang}
                    onChange={(e) => updateCfg({ jenjang: e.target.value })}
                    placeholder="contoh: 2 SD/MI"
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>KBM Max / Komponen</label>
                  <input
                    type="number"
                    className={styles.input}
                    value={cfg.kbmMaxPerComponent}
                    onChange={(e) =>
                      updateCfg({ kbmMaxPerComponent: Number(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            <div className={styles.card}>
              <h3 className={styles.sectionTitle}>UAS Bahasa Inggris</h3>
              <p className={styles.sectionDesc}>
                Lampiran 5 rapor. Kosongkan jika fase ini tidak punya UAS B. Inggris.
              </p>
              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Status</label>
                  <select
                    className={styles.input}
                    value={cfg.uasBInggris ? "yes" : "no"}
                    onChange={(e) =>
                      updateCfg({
                        uasBInggris: e.target.value === "yes" ? { maxScore: 100 } : null,
                      })
                    }
                  >
                    <option value="yes">Aktif</option>
                    <option value="no">Tidak aktif</option>
                  </select>
                </div>
                <div className={styles.field}>
                  <label className={styles.fieldLabel}>Max Score</label>
                  <input
                    type="number"
                    className={styles.input}
                    disabled={!cfg.uasBInggris}
                    value={cfg.uasBInggris?.maxScore || 0}
                    onChange={(e) =>
                      updateCfg({ uasBInggris: { maxScore: Number(e.target.value) || 0 } })
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div className={styles.card}>
            <div className={styles.componentHeader}>
              <div>
                <h3 className={styles.sectionTitle}>UAS Kognitif</h3>
                <p className={styles.sectionDesc}>
                  Komponen literasi yang muncul di Lampiran 3 rapor.
                </p>
              </div>
              <span className={styles.componentMeta}>
                {cfg.uasKognitif.length} komponen · {kognitifTotal.toLocaleString("id-ID")} poin
              </span>
            </div>
            <ComponentListEditor
              list={cfg.uasKognitif}
              onChange={(l) => updateComponentList("uasKognitif", l)}
            />
          </div>

          <div className={styles.card}>
            <div className={styles.componentHeader}>
              <div>
                <h3 className={styles.sectionTitle}>UAS Afektif</h3>
                <p className={styles.sectionDesc}>Komponen sikap yang muncul di Lampiran 4 rapor.</p>
              </div>
              <span className={styles.componentMeta}>
                {cfg.uasAfektif.length} komponen · {afektifTotal.toLocaleString("id-ID")} poin
              </span>
            </div>
            <ComponentListEditor
              list={cfg.uasAfektif}
              onChange={(l) => updateComponentList("uasAfektif", l)}
            />
          </div>

          {isSnbtFase && (
            <div className={styles.card}>
              <div className={styles.componentHeader}>
                <div>
                  <h3 className={styles.sectionTitle}>Sub-tes Try Out (SNBT)</h3>
                  <p className={styles.sectionDesc}>
                    Form input nilai Try Out di /evaluation pecah jadi 1 input per
                    sub-tes (0-100) per TO; nilai TO per pekan = rata-rata sub-tes.
                    Kosongkan semua untuk kembali ke mode 1 skor total per TO.
                  </p>
                </div>
                <span className={styles.componentMeta}>
                  {(cfg.tryoutSubTests ?? []).length} sub-tes
                </span>
              </div>
              <SubTestListEditor
                list={cfg.tryoutSubTests ?? []}
                onChange={(l) => updateCfg({ tryoutSubTests: l })}
              />
            </div>
          )}

          <div className={styles.totalBox}>
            <div>
              <span className={styles.totalLabel}>Total Poin Maksimal Rapor</span>
              <p className={styles.totalDesc}>
                KBM {kbmTotal.toLocaleString("id-ID")} + UAS {(kognitifTotal + afektifTotal + englishTotal).toLocaleString("id-ID")}
              </p>
            </div>
            <span className={styles.totalValue}>{totalMax.toLocaleString("id-ID")}</span>
          </div>
        </>
      )}
    </>
  );
}

function ComponentListEditor({
  list,
  onChange,
}: {
  list: UasComponent[];
  onChange: (l: UasComponent[]) => void;
}) {
  const update = (idx: number, patch: Partial<UasComponent>) => {
    const next = list.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };
  const add = () => {
    onChange([...list, { subject: "", label: "", maxScore: 0 }]);
  };
  const remove = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  return (
    <div className={styles.componentEditor}>
      {list.length === 0 ? (
        <div className={styles.componentEmpty}>
          Belum ada komponen untuk bagian ini.
        </div>
      ) : (
        <>
          <div className={`${styles.componentRow} ${styles.componentHeaderRow}`}>
            <span />
            <span className={styles.fieldLabel}>Kode Subject</span>
            <span className={styles.fieldLabel}>Label Tampilan</span>
            <span className={styles.fieldLabel}>Max Score</span>
            <span />
          </div>
          {list.map((c, i) => (
            <div key={i} className={styles.componentRow}>
              <span className={styles.componentIndex}>{i + 1}</span>
              <input
                className={styles.input}
                value={c.subject}
                onChange={(e) =>
                  update(i, { subject: e.target.value.toUpperCase().replace(/\s+/g, "_") })
                }
                placeholder="NUMERASI"
              />
              <input
                className={styles.input}
                value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Literasi Numerasi"
              />
              <input
                type="number"
                className={styles.input}
                value={c.maxScore}
                onChange={(e) => update(i, { maxScore: Number(e.target.value) || 0 })}
              />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => remove(i)}
                aria-label="Hapus komponen"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </>
      )}
      <button type="button" className={styles.addRowBtn} onClick={add}>
        + Tambah Komponen
      </button>
    </div>
  );
}

function SubTestListEditor({
  list,
  onChange,
}: {
  list: TryoutSubTest[];
  onChange: (l: TryoutSubTest[]) => void;
}) {
  const update = (idx: number, patch: Partial<TryoutSubTest>) => {
    const next = list.map((c, i) => (i === idx ? { ...c, ...patch } : c));
    onChange(next);
  };
  const add = () => {
    onChange([...list, { code: "", label: "" }]);
  };
  const remove = (idx: number) => {
    onChange(list.filter((_, i) => i !== idx));
  };

  return (
    <div className={styles.componentEditor}>
      {list.length === 0 ? (
        <div className={styles.componentEmpty}>
          Belum ada sub-tes — Try Out diinput sebagai 1 skor total per TO.
        </div>
      ) : (
        <>
          <div className={`${styles.componentRow} ${styles.componentHeaderRow}`}>
            <span />
            <span className={styles.fieldLabel}>Kode Sub-tes</span>
            <span className={styles.fieldLabel}>Label Tampilan</span>
            <span />
            <span />
          </div>
          {list.map((c, i) => (
            <div key={i} className={styles.componentRow}>
              <span className={styles.componentIndex}>{i + 1}</span>
              <input
                className={styles.input}
                value={c.code}
                onChange={(e) =>
                  update(i, { code: e.target.value.toUpperCase().replace(/\s+/g, "_") })
                }
                placeholder="PU"
              />
              <input
                className={styles.input}
                value={c.label}
                onChange={(e) => update(i, { label: e.target.value })}
                placeholder="Penalaran Umum"
              />
              <span />
              <button
                type="button"
                className={styles.removeBtn}
                onClick={() => remove(i)}
                aria-label="Hapus sub-tes"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="6" y1="6" x2="18" y2="18" />
                  <line x1="18" y1="6" x2="6" y2="18" />
                </svg>
              </button>
            </div>
          ))}
        </>
      )}
      <button type="button" className={styles.addRowBtn} onClick={add}>
        + Tambah Sub-tes
      </button>
    </div>
  );
}

// --- Rubric Editor ---

function RubricEditor({
  rubric,
  setRubric,
  saving,
  onSave,
  onReset,
}: {
  rubric: ReportRubric;
  setRubric: (r: ReportRubric) => void;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
}) {
  const [editingNarasi, setEditingNarasi] = useState<NarrativeCode | null>(null);
  const [narasiDraft, setNarasiDraft] = useState<ReportRubric["narasi"]["A"] | null>(null);

  const updatePredikat = (idx: number, patch: Partial<PredikatTier>) => {
    const next = rubric.predikat.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    setRubric({ ...rubric, predikat: next });
  };

  const openNarasiEditor = (code: NarrativeCode) => {
    setEditingNarasi(code);
    setNarasiDraft({ ...rubric.narasi[code] });
  };

  const closeNarasiEditor = () => {
    setEditingNarasi(null);
    setNarasiDraft(null);
  };

  const applyNarasiDraft = () => {
    if (!editingNarasi || !narasiDraft) return;
    setRubric({
      ...rubric,
      narasi: {
        ...rubric.narasi,
        [editingNarasi]: narasiDraft,
      },
    });
    closeNarasiEditor();
  };

  const tierBadgeClass = (code: string) =>
    code === "A" ? styles.tierBadgeA : code === "B" ? styles.tierBadgeB : styles.tierBadgeC;

  return (
    <>
      <div className={styles.toolbar}>
        <span style={{ fontSize: 13, color: "#6b7280" }}>
          Predikat & narasi otomatis dipilih berdasarkan persentase total nilai siswa.
        </span>
        <div className={styles.toolbarRight}>
          <button className={styles.btnDanger} onClick={onReset} disabled={saving}>
            Reset ke Default
          </button>
          <button className={styles.btnPrimary} onClick={onSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Threshold Predikat</h3>
        <p className={styles.sectionDesc}>
          Predikat dengan minPct tertinggi yang ≤ persentase siswa akan dipilih.
        </p>
        <div className={styles.predikatRow} style={{ marginBottom: 4 }}>
          <span className={styles.fieldLabel}>Code</span>
          <span className={styles.fieldLabel}>Label</span>
          <span className={styles.fieldLabel}>Min %</span>
          <span className={styles.fieldLabel}>Deskripsi singkat</span>
        </div>
        {rubric.predikat.map((p, i) => (
          <div key={p.code} className={styles.predikatRow}>
            <div className={styles.predikatBadge}>{p.code}</div>
            <input
              className={styles.input}
              value={p.label}
              onChange={(e) => updatePredikat(i, { label: e.target.value })}
            />
            <input
              type="number"
              min={0}
              max={100}
              className={styles.input}
              value={p.minPct}
              onChange={(e) =>
                updatePredikat(i, { minPct: Number(e.target.value) || 0 })
              }
            />
            <input
              className={styles.input}
              value={p.description}
              onChange={(e) => updatePredikat(i, { description: e.target.value })}
            />
          </div>
        ))}
      </div>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Narasi per Predikat</h3>
        <p className={styles.sectionDesc}>
          Teks ini muncul di Bagian 02 (Penilaian KBM &amp; UAS) rapor untuk tiap siswa, dipilih berdasarkan predikat.
        </p>
        <div className={styles.tierGrid}>
          {(["A", "B", "C"] as const).map((code) => (
            <div key={code} className={styles.tierCard}>
              <div className={styles.narrativeCardHeader}>
                <span className={tierBadgeClass(code)}>Predikat {code}</span>
                <button
                  type="button"
                  className={styles.btnSecondary}
                  onClick={() => openNarasiEditor(code)}
                >
                  Edit Narasi
                </button>
              </div>
              <div className={styles.narrativePreviewList}>
                {NARRATIVE_FIELDS.map((field) => (
                  <div key={field.key} className={styles.narrativePreview}>
                    <span className={styles.fieldLabel}>{field.label}</span>
                    <p>{rubric.narasi[code][field.key]}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <AdminModal
        isOpen={Boolean(editingNarasi && narasiDraft)}
        onClose={closeNarasiEditor}
        title={`Edit Narasi Predikat ${editingNarasi ?? ""}`}
        subtitle="Perubahan diterapkan ke form, lalu simpan halaman untuk menulis ke database."
        size="lg"
        footer={
          <>
            <button type="button" className={styles.btnSecondary} onClick={closeNarasiEditor}>
              Batal
            </button>
            <button type="button" className={styles.btnPrimary} onClick={applyNarasiDraft}>
              Terapkan Narasi
            </button>
          </>
        }
      >
        {narasiDraft && (
          <div className={styles.narrativeModalBody}>
            {NARRATIVE_FIELDS.map((field) => (
              <div key={field.key} className={styles.field}>
                <label className={styles.fieldLabel}>{field.label}</label>
                <textarea
                  className={`${styles.textarea} ${styles.narrativeTextarea}`}
                  value={narasiDraft[field.key]}
                  onChange={(e) =>
                    setNarasiDraft({
                      ...narasiDraft,
                      [field.key]: e.target.value,
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </AdminModal>

      <div className={styles.card}>
        <h3 className={styles.sectionTitle}>Kehadiran (Bagian 03)</h3>
        <p className={styles.sectionDesc}>
          Target persentase kehadiran &amp; narasi yang tampil di rapor berdasarkan capaian siswa.
        </p>
        <div className={styles.fieldRow}>
          <div className={styles.field}>
            <label className={styles.fieldLabel}>Target Kehadiran (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              className={styles.input}
              value={rubric.kehadiran.target}
              onChange={(e) =>
                setRubric({
                  ...rubric,
                  kehadiran: { ...rubric.kehadiran, target: Number(e.target.value) || 0 },
                })
              }
            />
          </div>
          <div />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Narasi Kehadiran Tinggi (≥ target)</label>
          <textarea
            className={styles.textarea}
            value={rubric.kehadiran.narasiTinggi}
            onChange={(e) =>
              setRubric({
                ...rubric,
                kehadiran: { ...rubric.kehadiran, narasiTinggi: e.target.value },
              })
            }
          />
        </div>
        <div className={styles.field}>
          <label className={styles.fieldLabel}>Narasi Kehadiran Rendah (&lt; target)</label>
          <textarea
            className={styles.textarea}
            value={rubric.kehadiran.narasiRendah}
            onChange={(e) =>
              setRubric({
                ...rubric,
                kehadiran: { ...rubric.kehadiran, narasiRendah: e.target.value },
              })
            }
          />
        </div>
      </div>
    </>
  );
}
