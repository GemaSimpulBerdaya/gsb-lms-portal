"use client";

import { useEffect, useState, useMemo } from "react";
import styles from "./reportConfig.module.css";
import type {
  FaseConfig,
  ReportRubric,
  UasComponent,
  PredikatTier,
} from "@/lib/reportDefaults";

type Tab = "fase" | "rubric";

type Toast = { type: "success" | "error"; text: string } | null;

export default function ReportConfigPage() {
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
    } catch (err: any) {
      showToast("error", err.message || "Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
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
    } catch (err: any) {
      showToast("error", err.message);
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
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  // CRUD fase sekarang dilakukan di /admin/semesters?tab=wilayah.
  // Untuk recovery konfigurasi default, gunakan endpoint
  // GET /api/admin/settings/defaults?key=faseConfig via cURL/admin tool.

  const resetRubricToDefault = async () => {
    if (!confirm("Reset rubrik ke default? Perubahan custom akan hilang.")) return;
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
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className={styles.loading}>Memuat konfigurasi...</div>;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Konfigurasi Raport</h1>
        <p className={styles.subtitle}>
          Atur komponen UAS per fase, threshold predikat, dan narasi raport. Berlaku global untuk seluruh siswa.
        </p>
      </header>

      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${tab === "fase" ? styles.tabActive : ""}`}
          onClick={() => setTab("fase")}
        >
          Komponen UAS per Fase
        </button>
        <button
          className={`${styles.tabBtn} ${tab === "rubric" ? styles.tabActive : ""}`}
          onClick={() => setTab("rubric")}
        >
          Predikat & Narasi
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

  if (fases.length === 0) {
    return (
      <div className={styles.empty}>
        Belum ada fase. Tambah fase dulu di{" "}
        <a href="/admin/semesters?tab=wilayah" style={{ color: "#1d4ed8", fontWeight: 700 }}>
          Wilayah & Fase
        </a>
        , baru komponen UAS-nya bisa diatur di sini.
      </div>
    );
  }

  return (
    <>
      <div
        style={{
          background: "#eff6ff",
          border: "1px solid #bfdbfe",
          borderRadius: 10,
          padding: "10px 14px",
          marginBottom: 16,
          fontSize: 13,
          color: "#1e3a8a",
          lineHeight: 1.5,
        }}
      >
        Tambah/hapus/rename fase dilakukan di{" "}
        <a
          href="/admin/semesters?tab=wilayah"
          style={{ color: "#1d4ed8", fontWeight: 700, textDecoration: "underline" }}
        >
          Wilayah & Fase
        </a>
        . Halaman ini fokus untuk mengatur komponen UAS, KBM, dan label jenjang per fase.
      </div>

      <div className={styles.toolbar}>
        <select
          className={styles.faseSelect}
          value={selectedFase}
          onChange={(e) => setSelectedFase(e.target.value)}
        >
          {fases.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
        <div className={styles.toolbarRight}>
          <button className={styles.btnPrimary} onClick={onSave} disabled={saving}>
            {saving ? "Menyimpan..." : "Simpan Perubahan"}
          </button>
        </div>
      </div>

      {cfg && (
        <>
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
            <h3 className={styles.sectionTitle}>UAS Kognitif (Literasi)</h3>
            <p className={styles.sectionDesc}>
              Subject + label + maxScore tiap komponen kognitif. Dipakai di Lampiran 3 rapor.
            </p>
            <ComponentListEditor
              list={cfg.uasKognitif}
              onChange={(l) => updateComponentList("uasKognitif", l)}
            />
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>UAS Afektif (Sikap)</h3>
            <p className={styles.sectionDesc}>Komponen sikap untuk Lampiran 4 rapor.</p>
            <ComponentListEditor
              list={cfg.uasAfektif}
              onChange={(l) => updateComponentList("uasAfektif", l)}
            />
          </div>

          <div className={styles.card}>
            <h3 className={styles.sectionTitle}>UAS Bahasa Inggris</h3>
            <p className={styles.sectionDesc}>
              Lampiran 5 rapor. Kosongkan jika fase ini tidak punya UAS B. Inggris.
            </p>
            <div className={styles.fieldRow}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Aktif?</label>
                <select
                  className={styles.input}
                  value={cfg.uasBInggris ? "yes" : "no"}
                  onChange={(e) =>
                    updateCfg({
                      uasBInggris: e.target.value === "yes" ? { maxScore: 100 } : null,
                    })
                  }
                >
                  <option value="yes">Ya, ada UAS B. Inggris</option>
                  <option value="no">Tidak ada</option>
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

          <div className={styles.totalBox}>
            <span className={styles.totalLabel}>Total Poin Maksimal Rapor</span>
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
    <>
      {list.length > 0 && (
        <div className={styles.componentRow} style={{ marginBottom: 4 }}>
          <span className={styles.fieldLabel}>Subject (kode)</span>
          <span className={styles.fieldLabel}>Label tampilan</span>
          <span className={styles.fieldLabel}>Max Score</span>
          <span />
        </div>
      )}
      {list.map((c, i) => (
        <div key={i} className={styles.componentRow}>
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
            aria-label="Hapus"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </svg>
          </button>
        </div>
      ))}
      <button type="button" className={styles.addRowBtn} onClick={add}>
        + Tambah Komponen
      </button>
    </>
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
  const updatePredikat = (idx: number, patch: Partial<PredikatTier>) => {
    const next = rubric.predikat.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    setRubric({ ...rubric, predikat: next });
  };

  const updateNarasi = (
    code: "A" | "B" | "C",
    field: keyof ReportRubric["narasi"]["A"],
    value: string
  ) => {
    setRubric({
      ...rubric,
      narasi: {
        ...rubric.narasi,
        [code]: { ...rubric.narasi[code], [field]: value },
      },
    });
  };

  const tierBadgeClass = (code: string) =>
    code === "A" ? styles.tierBadgeA : code === "B" ? styles.tierBadgeB : styles.tierBadgeC;

  return (
    <>
      <div className={styles.warningBanner}>
        ⚠ Threshold predikat (minPct) menentukan tier setiap siswa. Threshold default (A≥70, B≥40, C&lt;40) masih asumsi kerja — konfirmasi ke tim Edukasi sebelum dipakai final.
      </div>

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
          Tier dengan minPct tertinggi yang ≤ persentase siswa akan dipilih.
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
        <h3 className={styles.sectionTitle}>Narasi per Tier</h3>
        <p className={styles.sectionDesc}>
          Teks ini muncul di Bagian 02 (Penilaian KBM &amp; UAS) rapor untuk tiap siswa, dipilih berdasarkan tier.
        </p>
        <div className={styles.tierGrid}>
          {(["A", "B", "C"] as const).map((code) => (
            <div key={code} className={styles.tierCard}>
              <span className={tierBadgeClass(code)}>Tier {code}</span>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Narasi Kognitif</label>
                <textarea
                  className={styles.textarea}
                  value={rubric.narasi[code].kognitif}
                  onChange={(e) => updateNarasi(code, "kognitif", e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Narasi Sikap</label>
                <textarea
                  className={styles.textarea}
                  value={rubric.narasi[code].sikap}
                  onChange={(e) => updateNarasi(code, "sikap", e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Rekomendasi Siswa</label>
                <textarea
                  className={styles.textarea}
                  value={rubric.narasi[code].rekomendasiSiswa}
                  onChange={(e) =>
                    updateNarasi(code, "rekomendasiSiswa", e.target.value)
                  }
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Rekomendasi Orang Tua</label>
                <textarea
                  className={styles.textarea}
                  value={rubric.narasi[code].rekomendasiOrtu}
                  onChange={(e) => updateNarasi(code, "rekomendasiOrtu", e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

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
