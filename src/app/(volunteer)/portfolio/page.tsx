"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./portfolio.module.css";

type ScheduleLite = {
  _id: string;
  region: string;
  level: string;
  semester: string;
  activeWeek: number;
};

type StudentLite = {
  _id: string;
  name: string;
  region: string;
  category: string;
};

type PortfolioItem = {
  _id: string;
  anakDidikId:
    | { _id: string; name: string; region?: string; category?: string }
    | string;
  scheduleId: string;
  semester: string;
  region: string;
  level: string;
  title: string;
  description?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  storageType: string;
  week?: number;
  date?: string;
  createdAt: string;
};

type Toast = { type: "success" | "error"; text: string } | null;

const getCurrentSemester = () => {
  const d = new Date();
  return `${d.getFullYear()}-1`;
};

const formatSemester = (sem: string) => {
  if (!sem) return "-";
  const [year, term] = sem.split("-");
  return `Semester ${term} - ${year}`;
};

const studentIdOf = (item: PortfolioItem): string => {
  if (typeof item.anakDidikId === "string") return item.anakDidikId;
  return item.anakDidikId?._id || "";
};

export default function VolunteerPortfolioPage() {
  const [schedules, setSchedules] = useState<ScheduleLite[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string>("");
  const [semester, _setSemester] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("activeSemester") || getCurrentSemester();
    }
    return getCurrentSemester();
  });
  const [students, setStudents] = useState<StudentLite[]>([]);
  const [items, setItems] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<Toast>(null);

  // Modal states
  const [uploadFor, setUploadFor] = useState<StudentLite | null>(null);
  const [detailFor, setDetailFor] = useState<StudentLite | null>(null);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 3500);
  };

  // --- Fetch schedules milik relawan ---
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/volunteer/schedule");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const list: ScheduleLite[] = data.schedules || [];
        setSchedules(list);
        const inSem = list.filter((s) => s.semester === semester);
        if (inSem.length > 0) {
          setSelectedScheduleId((prev) => prev || inSem[0]._id);
        } else if (list.length > 0) {
          setSelectedScheduleId((prev) => prev || list[0]._id);
        }
      } catch (err) {
        console.error("Gagal memuat jadwal", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [semester]);

  // --- Sync siswa untuk jadwal terpilih ---
  useEffect(() => {
    let active = true;
    if (!selectedScheduleId) {
      setStudents([]);
      return;
    }
    const sched = schedules.find((s) => s._id === selectedScheduleId);
    if (!sched) return;
    (async () => {
      try {
        const url = `/api/volunteer/students?region=${encodeURIComponent(
          sched.region
        )}&level=${encodeURIComponent(sched.level)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setStudents(data.students || []);
      } catch (err) {
        console.error("Gagal memuat siswa", err);
      }
    })();
    return () => {
      active = false;
    };
  }, [selectedScheduleId, schedules]);

  // --- Persist semester ---
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("activeSemester", semester);
    }
  }, [semester]);

  // --- Fetch portfolio untuk schedule terpilih ---
  const refreshItems = async () => {
    if (!selectedScheduleId) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("scheduleId", selectedScheduleId);
      params.set("semester", semester);
      const res = await fetch(`/api/volunteer/portfolio?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memuat portofolio");
      setItems(data.portfolio || []);
    } catch (err: any) {
      showToast("error", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedScheduleId, semester]);

  // --- Group portfolio per siswa ---
  const portfolioByStudent = useMemo(() => {
    const map: Record<string, { karya: number; items: PortfolioItem[] }> = {};
    for (const it of items) {
      const sid = studentIdOf(it);
      if (!map[sid]) map[sid] = { karya: 0, items: [] };
      map[sid].karya += 1;
      map[sid].items.push(it);
    }
    return map;
  }, [items]);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus karya siswa ini?")) return;
    try {
      const res = await fetch(`/api/volunteer/portfolio/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menghapus");
      showToast("success", "Karya dihapus");
      setItems((prev) => prev.filter((it) => it._id !== id));
    } catch (err: any) {
      showToast("error", err.message);
    }
  };

  const selectedSchedule = schedules.find((s) => s._id === selectedScheduleId);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Karya Siswa</h1>
        <p className={styles.subtitle}>
          Catat karya individu siswa (lukisan, tulisan, prakarya). Tempel link Drive/Photos — akan tampil di Lampiran rapor akhir semester.
        </p>
      </header>

      <div className={styles.banner}>
        <span style={{ fontSize: 18 }}>💡</span>
        <div>
          <strong>Untuk dokumentasi KBM (foto kelas)</strong>, gunakan menu{" "}
          <Link href="/reporting" className={styles.bannerLink}>
            Dokumentasi KBM
          </Link>
          . Foto yang di-upload di sana otomatis muncul di rapor seluruh siswa kelas tersebut.
        </div>
      </div>

      <div className={styles.toolbar}>
        <select
          className={styles.select}
          value={selectedScheduleId}
          onChange={(e) => setSelectedScheduleId(e.target.value)}
        >
          <option value="">— Pilih Jadwal —</option>
          {schedules.map((s) => (
            <option key={s._id} value={s._id}>
              {s.region} — {s.level} ({formatSemester(s.semester)})
            </option>
          ))}
        </select>

        <div className={styles.statsBox}>
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Total Karya</span>
            <span className={styles.statValue}>{items.length}</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <span className={styles.statLabel}>Siswa</span>
            <span className={styles.statValue}>{students.length}</span>
          </div>
        </div>
      </div>

      {!selectedScheduleId ? (
        <div className={styles.empty}>
          Pilih jadwal mengajar dulu di toolbar di atas.
        </div>
      ) : students.length === 0 ? (
        <div className={styles.empty}>Belum ada siswa di jadwal ini.</div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: 50 }}>#</th>
                <th>Nama Siswa</th>
                <th style={{ width: 120, textAlign: "center" }}>Karya</th>
                <th style={{ width: 240, textAlign: "right" }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={4} className={styles.tableLoading}>
                    Memuat...
                  </td>
                </tr>
              ) : (
                students.map((s, i) => {
                  const stat = portfolioByStudent[s._id] || { karya: 0, items: [] };
                  return (
                    <tr key={s._id}>
                      <td className={styles.tdMuted}>{i + 1}</td>
                      <td>
                        <div className={styles.studentName}>{s.name}</div>
                        <div className={styles.studentMeta}>
                          {s.region} · {s.category}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <CountPill count={stat.karya} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className={styles.btnGhost}
                          onClick={() => setDetailFor(s)}
                          disabled={stat.items.length === 0}
                        >
                          Lihat ({stat.items.length})
                        </button>
                        <button
                          className={styles.btnUpload}
                          onClick={() => setUploadFor(s)}
                        >
                          + Upload
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: Upload */}
      {uploadFor && selectedSchedule && (
        <PortfolioFormModal
          schedule={selectedSchedule}
          student={uploadFor}
          onClose={() => setUploadFor(null)}
          onSaved={() => {
            setUploadFor(null);
            refreshItems();
            showToast("success", "Karya tersimpan");
          }}
          onError={(msg) => showToast("error", msg)}
        />
      )}

      {/* MODAL: Detail per siswa */}
      {detailFor && (
        <StudentPortfolioModal
          student={detailFor}
          items={portfolioByStudent[detailFor._id]?.items || []}
          onClose={() => setDetailFor(null)}
          onDelete={async (id) => {
            await handleDelete(id);
            const remaining = (portfolioByStudent[detailFor._id]?.items || []).filter(
              (it) => it._id !== id
            );
            if (remaining.length === 0) setDetailFor(null);
          }}
          onAddNew={() => {
            setDetailFor(null);
            setUploadFor(detailFor);
          }}
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

// ------------------------------------------------------------
// Count pill
// ------------------------------------------------------------
function CountPill({ count }: { count: number }) {
  if (count === 0) {
    return <span className={styles.countZero}>—</span>;
  }
  return <span className={`${styles.countPill} ${styles.countKarya}`}>{count}</span>;
}

// ------------------------------------------------------------
// Modal: detail karya per siswa
// ------------------------------------------------------------
function StudentPortfolioModal({
  student,
  items,
  onClose,
  onDelete,
  onAddNew,
}: {
  student: StudentLite;
  items: PortfolioItem[];
  onClose: () => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.modal}
        style={{ maxWidth: 720 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.modalHead}>
          <div>
            <h2 className={styles.modalTitle}>{student.name}</h2>
            <p className={styles.modalDesc}>
              {student.region} · {student.category} · {items.length} karya
            </p>
          </div>
          <button className={styles.modalSubmit} style={{ flex: "0 0 auto" }} onClick={onAddNew}>
            + Tambah
          </button>
        </div>

        {items.length === 0 ? (
          <div className={styles.empty}>Belum ada karya untuk siswa ini.</div>
        ) : (
          <div className={styles.detailGrid}>
            {items.map((it) => {
              const isImg =
                it.thumbnailUrl ||
                /\.(png|jpe?g|gif|webp)(\?|$)/i.test(it.fileUrl);
              const previewSrc = it.thumbnailUrl || (isImg ? it.fileUrl : "");
              return (
                <div key={it._id} className={styles.detailCard}>
                  <div className={styles.detailThumb}>
                    {previewSrc ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={previewSrc} alt={it.title} />
                    ) : (
                      <span>📁 link</span>
                    )}
                  </div>
                  <div className={styles.detailBody}>
                    <div className={styles.badgeRow}>
                      <span className={`${styles.badge} ${styles.badgeKarya}`}>Karya</span>
                      {it.week && (
                        <span className={`${styles.badge} ${styles.badgeMeta}`}>
                          Pekan {it.week}
                        </span>
                      )}
                    </div>
                    <div className={styles.cardTitle}>{it.title}</div>
                    {it.description && (
                      <div className={styles.studentMeta} style={{ marginTop: 4 }}>
                        {it.description}
                      </div>
                    )}
                    <div className={styles.cardActions} style={{ padding: "10px 0 0" }}>
                      <a
                        className={styles.linkBtn}
                        href={it.fileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Buka link ↗
                      </a>
                      <button
                        className={styles.deleteBtn}
                        onClick={() => onDelete(it._id)}
                        aria-label="Hapus"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className={styles.modalActions} style={{ marginTop: 16 }}>
          <button type="button" className={styles.modalCancel} onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// Modal: upload form (siswa di-pre-fill)
// ------------------------------------------------------------
function PortfolioFormModal({
  schedule,
  student,
  onClose,
  onSaved,
  onError,
}: {
  schedule: ScheduleLite;
  student: StudentLite;
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [week, setWeek] = useState<string>(String(schedule.activeWeek || ""));
  const [date, setDate] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !fileUrl.trim()) {
      onError("Lengkapi field wajib (judul, link).");
      return;
    }
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        anakDidikId: student._id,
        scheduleId: schedule._id,
        title: title.trim(),
        description: description.trim() || undefined,
        fileUrl: fileUrl.trim(),
        thumbnailUrl: thumbnailUrl.trim() || undefined,
      };
      if (week) body.week = Number(week);
      if (date) body.date = date;

      const res = await fetch("/api/volunteer/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal menyimpan");
      onSaved();
    } catch (err: any) {
      onError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.modalTitle}>Tambah Karya Siswa</h2>
        <p className={styles.modalDesc}>
          <strong>{student.name}</strong> · {schedule.region} — {schedule.level} ·{" "}
          {formatSemester(schedule.semester)}
        </p>

        <form onSubmit={handleSubmit}>
          <div className={styles.field}>
            <label className={styles.label}>Judul Karya</label>
            <input
              className={styles.modalInput}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="contoh: Lukisan jari pertemuan ke-3"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Link File / Folder (Drive, Photos, dll.)</label>
            <input
              type="url"
              className={styles.modalInput}
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>
              Link Thumbnail (opsional, untuk preview gambar di kartu)
            </label>
            <input
              type="url"
              className={styles.modalInput}
              value={thumbnailUrl}
              onChange={(e) => setThumbnailUrl(e.target.value)}
              placeholder="https://...image.jpg"
            />
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.field}>
              <label className={styles.label}>Pekan Ke- (opsional)</label>
              <input
                type="number"
                min={1}
                className={styles.modalInput}
                value={week}
                onChange={(e) => setWeek(e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Tanggal (opsional)</label>
              <input
                type="date"
                className={styles.modalInput}
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Catatan (opsional)</label>
            <textarea
              className={`${styles.modalInput} ${styles.modalTextarea}`}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="contoh: hasil eksplorasi finger painting tema laut"
            />
          </div>

          <div className={styles.modalActions}>
            <button type="button" className={styles.modalCancel} onClick={onClose}>
              Batal
            </button>
            <button type="submit" className={styles.modalSubmit} disabled={submitting}>
              {submitting ? "Menyimpan..." : "Simpan Karya"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
