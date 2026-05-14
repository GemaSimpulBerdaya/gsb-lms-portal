"use client";

/**
 * RaportContent — komponen isi raport siswa.
 *
 * Reusable di:
 *  - Modal preview di halaman /admin/grades
 *  - Halaman print /print/raport (full-page, printable)
 *
 * Design: lihat `RaportContent.module.css`. Ukuran tiap `.page` = A4
 * (210mm x 297mm) supaya preview on-screen dan output print konsisten.
 */

import React from "react";
import styles from "./RaportContent.module.css";

export type RaportMeeting = {
  week: number;
  meetingIndex: number;
  scoreConcept: number;
  scoreQuiz: number;
  scoreAttitude: number;
  score: number;
  title: string;
};

export type UasSubjectScore = {
  subject: string;
  label: string;
  score: number;
  maxScore: number;
};

export type TryoutScore = {
  week: number;
  tryoutNumber: number;
  score: number;
};

export type RaportStudent = {
  _id: string;
  name: string;
  category: string;
  region: string;
  parentName: string;
  weeklyGrades: Record<
    number,
    {
      scoreConcept: number;
      scoreQuiz: number;
      scoreAttitude: number;
      score: number;
      title: string;
    }
  >;
  /** Raw list per-pertemuan (bisa >1 per minggu). Optional untuk backward-compat. */
  meetings?: RaportMeeting[];
  utsScore: number;
  uasScore: number;
  /** Breakdown UAS per subject — optional untuk backward-compat. */
  penilaian?: {
    uasLiterasi: {
      kognitif: UasSubjectScore[];
      afektif: UasSubjectScore[];
    };
    uasBahasaInggris: UasSubjectScore[];
  };
  /** List tryout SNBT (hanya untuk kelas yang relevan). */
  tryouts?: TryoutScore[];
  attendanceSummary: {
    HADIR: number;
    IZIN: number;
    SAKIT: number;
    ALFA: number;
    total: number;
  };
  summary: {
    avgConcept: number;
    avgQuiz: number;
    avgAttitude: number;
    finalScore: number;
    totalKbmConcept?: number;
    totalKbmQuiz?: number;
    totalKbmAttitude?: number;
    totalKbm?: number;
  };
};

interface Props {
  student: RaportStudent;
  semester: string;
  /** Versi bersih untuk halaman print (tanpa background krem besar). */
  clean?: boolean;
}

const AVATAR_COLORS = [
  "#2ecc71",
  "#3498db",
  "#9b59b6",
  "#f1c40f",
  "#e67e22",
  "#e74c3c",
];

function pickColor(str: string) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getPredicate(score: number) {
  if (score >= 85)
    return {
      letter: "A",
      label: "Sangat Baik",
      desc: "Siswa tuntas dengan pencapaian tinggi dan mampu mengaplikasikan konsep secara mandiri.",
    };
  if (score >= 75)
    return {
      letter: "B",
      label: "Baik",
      desc: "Siswa menunjukkan pemahaman yang baik dan mampu menyelesaikan tugas dengan mandiri.",
    };
  if (score >= 60)
    return {
      letter: "C",
      label: "Cukup",
      desc: "Siswa memahami konsep dasar namun masih memerlukan bimbingan.",
    };
  return {
    letter: "D",
    label: "Perlu Bimbingan",
    desc: "Siswa memerlukan bimbingan intensif untuk memahami konsep dasar.",
  };
}

function calculateTotalPoints(s: RaportStudent) {
  // Prefer totals dari API (akurat kalau ada >1 pertemuan per minggu),
  // fallback ke iterasi weeklyGrades kalau field tidak ada.
  const kbmTotal =
    s.summary.totalKbm ??
    Object.values(s.weeklyGrades).reduce(
      (acc, wg) =>
        acc + (wg.scoreConcept || 0) + (wg.scoreQuiz || 0) + (wg.scoreAttitude || 0),
      0
    );
  return kbmTotal + (s.utsScore || 0) + (s.uasScore || 0);
}

export default function RaportContent({ student, semester, clean = false }: Props) {
  const avatarColor = pickColor(student.name);
  const predicate = getPredicate(student.summary.finalScore);
  const totalPoints = calculateTotalPoints(student);
  const kbmConcept =
    student.summary.totalKbmConcept ??
    student.summary.avgConcept * Object.keys(student.weeklyGrades).length;
  const kbmQuiz =
    student.summary.totalKbmQuiz ??
    student.summary.avgQuiz * Object.keys(student.weeklyGrades).length;
  const kbmAttitude =
    student.summary.totalKbmAttitude ??
    student.summary.avgAttitude * Object.keys(student.weeklyGrades).length;
  const weeks = Array.from({ length: 16 }, (_, i) => i + 1);
  const weeklyEntries = Object.keys(student.weeklyGrades).length;
  const hadirPct = student.attendanceSummary.total
    ? Math.round(
        (student.attendanceSummary.HADIR / student.attendanceSummary.total) * 100
      )
    : 0;

  return (
    <div
      id="raport-content"
      className={clean ? styles.viewportClean : styles.viewport}
    >
      {/* PAGE 1: COVER */}
      <div className={styles.page}>
        <div className={styles.watermark}>GSB</div>
        <span className={styles.sticker} style={{ top: "30px", left: "30px" }}>
          ⭐
        </span>
        <span className={styles.sticker} style={{ top: "80px", right: "40px" }}>
          🚀
        </span>
        <div className={styles.coverPage}>
          <div className={styles.brand}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-gsb.png" alt="Logo GSB" className={styles.brandLogo} />
            <div className={styles.titleBubble}>
              Rapor Siswa
              <br />
              GSB
            </div>
            <div className={styles.yearBadge}>{semester}</div>
            <p className={styles.brandSubtitle}>Laporan Hasil Belajar Siswa</p>
          </div>

          <div className={styles.studentInfoCard}>
            <div className={styles.washiTape}></div>
            <p className={styles.studentName}>{student.name}</p>
            <p className={styles.studentMeta}>
              {student.category} · {student.region}
            </p>
          </div>

          <div className={styles.coverFooter}>
            Komunitas Gerakan Suka Baca (GSB)
          </div>
        </div>
      </div>

      {/* PAGE 2: PROFIL SISWA */}
      <div className={styles.page}>
        <div className={styles.numberBadge}>01</div>
        <h2 className={styles.greenTitle}>Profil Siswa</h2>
        <div className={styles.introBox} style={{ textAlign: "center" }}>
          <div
            className={styles.profileAvatar}
            style={{ background: avatarColor }}
          >
            {student.name.charAt(0)}
          </div>
          <div className={styles.profileGrid}>
            <div className={styles.profileLabel}>Nama Lengkap</div>
            <div className={styles.profileValue}>{student.name}</div>

            <div className={styles.profileLabel}>Orang Tua / Wali</div>
            <div className={styles.profileValue}>
              {student.parentName || "-"}
            </div>

            <div className={styles.profileLabel}>Jenjang / Fase</div>
            <div className={styles.profileValue}>{student.category}</div>

            <div className={styles.profileLabel}>Wilayah Belajar</div>
            <div className={styles.profileValue}>{student.region}</div>

            <div className={styles.profileLabel}>Status</div>
            <div className={styles.profileValue}>Aktif</div>
          </div>
        </div>
        <div className={styles.blueBubble} style={{ marginTop: "auto" }}>
          <p style={{ fontStyle: "italic", fontSize: "13px" }}>
            &ldquo;Pendidikan adalah senjata paling mematikan di dunia, karena
            dengan pendidikan, Anda dapat mengubah dunia.&rdquo; — Nelson
            Mandela
          </p>
        </div>
      </div>

      {/* PAGE 3: PENGANTAR */}
      <div className={styles.page}>
        <div className={styles.numberBadge}>02</div>
        <h2 className={styles.greenTitle}>Pengantar</h2>
        <div className={styles.introText}>
          <p>
            Rapor ini merupakan evaluasi sekaligus apresiasi hasil belajar
            siswa GSB selama <strong>{semester}</strong> dengan sistem
            penilaian poin belajar.
          </p>
          <p>
            Pembelajaran dilaksanakan setiap hari Minggu pukul 10.00–12.00,
            dengan metode kelas luring di beberapa lokasi belajar (Sekolah
            Master dan Rumah Belajar) serta kelas daring melalui Zoom Meeting.
            Pada waktu tertentu, kegiatan belajar juga dilakukan secara
            asinkronus sesuai kebutuhan.
          </p>
          <p>
            Angka yang tertulis pada rapor merupakan{" "}
            <strong>akumulasi poin belajar</strong>, yaitu gabungan penilaian
            yang menggambarkan pemahaman siswa terhadap materi, hasil latihan
            untuk menguatkan pemahaman, serta sikap siswa selama mengikuti
            pembelajaran.
          </p>

          <div className={styles.introBox}>
            <p>
              <strong>Poin Konsep (Pemahaman):</strong> Penilaian pemahaman
              siswa terhadap materi pada literasi numerasi, sains, Bahasa
              Indonesia, dan Bahasa Inggris.
            </p>
            <p>
              <strong>Poin Kuis (Latihan Soal):</strong> Poin dari latihan/kuis
              pekanan untuk menguji pemahaman siswa selama KBM.
            </p>
            <p>
              <strong>Poin Sikap (Afektif):</strong> Penilaian sikap siswa
              selama mengikuti pembelajaran, seperti kedisiplinan, partisipasi,
              kerja sama, dan tanggung jawab.
            </p>
          </div>
        </div>
      </div>

      {/* PAGE 4: PENILAIAN */}
      <div className={styles.page}>
        <div className={styles.numberBadge}>03</div>
        <h2 className={styles.greenTitle}>Penilaian Belajar</h2>
        <div className={styles.highlightBox}>
          <p style={{ fontSize: "18px" }}>
            Total Poin:{" "}
            <strong style={{ color: "#047857" }}>{totalPoints}</strong>
          </p>
          <p style={{ fontSize: "16px", marginTop: 4 }}>
            Predikat:{" "}
            <strong style={{ color: "#b91c1c" }}>
              {predicate.letter} ({predicate.label})
            </strong>
          </p>
          <p
            style={{
              fontStyle: "italic",
              fontSize: "13px",
              marginTop: "10px",
              color: "#374151",
            }}
          >
            &ldquo;{predicate.desc}&rdquo;
          </p>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Komponen Penilaian</th>
              <th style={{ textAlign: "center", width: "25%" }}>Poin Siswa</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>Nilai KBM (Kegiatan Belajar Mengajar)</strong>
              </td>
              <td style={{ textAlign: "center" }}></td>
            </tr>
            <tr>
              <td style={{ paddingLeft: "26px" }}>
                • Akumulasi Konsep Mingguan
              </td>
              <td style={{ textAlign: "center" }}>{kbmConcept}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: "26px" }}>• Akumulasi Kuis Mingguan</td>
              <td style={{ textAlign: "center" }}>{kbmQuiz}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: "26px" }}>• Akumulasi Adab & Sikap</td>
              <td style={{ textAlign: "center" }}>{kbmAttitude}</td>
            </tr>
            <tr>
              <td>
                <strong>Nilai Evaluasi Semester</strong>
              </td>
              <td style={{ textAlign: "center" }}></td>
            </tr>
            <tr>
              <td style={{ paddingLeft: "26px" }}>
                • Ujian Tengah Semester (UTS)
              </td>
              <td style={{ textAlign: "center" }}>{student.utsScore || 0}</td>
            </tr>
            <tr>
              <td style={{ paddingLeft: "26px" }}>
                • Ujian Akhir Semester (UAS)
              </td>
              <td style={{ textAlign: "center" }}>{student.uasScore || 0}</td>
            </tr>
            <tr style={{ background: "#fefce8", fontWeight: 900 }}>
              <td>TOTAL POIN AKHIR</td>
              <td style={{ textAlign: "center" }}>{totalPoints}</td>
            </tr>
          </tbody>
        </table>

        <div className={styles.blueBubble}>
          <p>
            <strong>Catatan Perkembangan:</strong>
          </p>
          <p>
            Siswa menunjukkan antusiasme yang baik dalam mengikuti setiap sesi
            pembelajaran.
            {student.summary.finalScore >= 80
              ? " Pertahankan prestasi dan semangat belajarnya!"
              : " Teruslah berlatih agar pemahaman konsep semakin matang."}
          </p>
        </div>
      </div>

      {/* PAGE 5: KEHADIRAN */}
      <div className={styles.page}>
        <div className={styles.numberBadge}>04</div>
        <h2 className={styles.greenTitle}>Kehadiran</h2>

        <div className={styles.statGrid}>
          <div className={styles.statBox}>
            <p className={styles.statLabel}>Persentase Kehadiran</p>
            <p className={`${styles.statValue} ${styles.statValueBlue}`}>
              {hadirPct}%
            </p>
          </div>
          <div className={styles.statBox}>
            <p className={styles.statLabel}>Total Pertemuan</p>
            <p className={`${styles.statValue} ${styles.statValueSlate}`}>
              {student.attendanceSummary.total}
            </p>
          </div>
        </div>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status Presensi</th>
              <th style={{ textAlign: "center", width: "30%" }}>Jumlah</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Hadir</td>
              <td style={{ textAlign: "center" }}>
                {student.attendanceSummary.HADIR}
              </td>
            </tr>
            <tr>
              <td>Izin</td>
              <td style={{ textAlign: "center" }}>
                {student.attendanceSummary.IZIN}
              </td>
            </tr>
            <tr>
              <td>Sakit</td>
              <td style={{ textAlign: "center" }}>
                {student.attendanceSummary.SAKIT}
              </td>
            </tr>
            <tr>
              <td>Alfa / Tanpa Keterangan</td>
              <td style={{ textAlign: "center" }}>
                {student.attendanceSummary.ALFA}
              </td>
            </tr>
          </tbody>
        </table>

        <div className={styles.blueBubble}>
          <p>
            <strong>Rekomendasi Kehadiran:</strong>
          </p>
          <p>
            {student.attendanceSummary.total > 0 &&
            student.attendanceSummary.HADIR /
              student.attendanceSummary.total >=
              0.8
              ? "Kehadiran sangat baik dan konsisten. Pertahankan kedisiplinan ini untuk hasil belajar yang maksimal."
              : "Kehadiran perlu ditingkatkan. Pastikan untuk selalu hadir tepat waktu agar tidak tertinggal materi pembelajaran."}
          </p>
        </div>

        <div className={styles.signatureRow}>
          <div className={styles.signatureBox}>
            <p>
              Mengetahui,
              <br />
              <strong>Orang Tua / Wali</strong>
            </p>
            <div className={styles.signatureLine}></div>
          </div>
          <div className={styles.signatureBox}>
            <p>
              Jakarta,{" "}
              {new Date().toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              <br />
              <strong>Admin GSB</strong>
            </p>
            <div className={styles.signatureLine}></div>
            <p style={{ marginTop: 4 }}>
              <strong>( Koordinator )</strong>
            </p>
          </div>
        </div>
      </div>

      {/* PAGE 6: LAMPIRAN */}
      <div className={styles.page}>
        <div className={styles.numberBadge}>05</div>
        <h2 className={styles.greenTitle}>Lampiran: Detail Mingguan</h2>
        <p
          style={{
            fontSize: "13px",
            color: "#64748b",
            marginBottom: "14px",
          }}
        >
          Berikut adalah rincian penilaian yang diperoleh setiap pekannya:
        </p>

        {/* Kalau ada raw meetings (>1 pertemuan/minggu), tampilkan per
         * pertemuan supaya tiap skor konsep/kuis/sikap tetap dalam skala
         * 0–100 (tidak terakumulasi jadi angka aneh di tabel ini).
         * Fallback ke weeklyGrades aggregated kalau field meetings belum
         * disediakan oleh API. */}
        <table className={styles.table} style={{ fontSize: "12px" }}>
          <thead>
            <tr>
              <th style={{ width: "80px" }}>Minggu</th>
              <th>Materi / Aktivitas</th>
              <th style={{ textAlign: "center", width: "70px" }}>Konsep</th>
              <th style={{ textAlign: "center", width: "70px" }}>Kuis</th>
              <th style={{ textAlign: "center", width: "70px" }}>Adab</th>
            </tr>
          </thead>
          <tbody>
            {student.meetings && student.meetings.length > 0 ? (
              student.meetings.map((m) => {
                // Hitung berapa banyak pertemuan di minggu ini untuk
                // decide apakah perlu label "Pertemuan N" di kolom minggu.
                const totalInWeek = student.meetings!.filter(
                  (x) => x.week === m.week
                ).length;
                return (
                  <tr key={`${m.week}-${m.meetingIndex}`}>
                    <td>
                      Minggu {m.week}
                      {totalInWeek > 1 ? (
                        <>
                          <br />
                          <span
                            style={{
                              fontSize: "10px",
                              color: "#64748b",
                              fontWeight: 600,
                            }}
                          >
                            Pertemuan {m.meetingIndex}
                          </span>
                        </>
                      ) : null}
                    </td>
                    <td>{m.title || `Pertemuan ke-${m.week}`}</td>
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#0369a1",
                      }}
                    >
                      {m.scoreConcept}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#991b1b",
                      }}
                    >
                      {m.scoreQuiz}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#166534",
                      }}
                    >
                      {m.scoreAttitude}
                    </td>
                  </tr>
                );
              })
            ) : (
              weeks.map((w) => {
                const wg = student.weeklyGrades[w];
                if (!wg) return null;
                return (
                  <tr key={w}>
                    <td>Minggu {w}</td>
                    <td>{wg.title || `Pertemuan ke-${w}`}</td>
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#0369a1",
                      }}
                    >
                      {wg.scoreConcept}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#991b1b",
                      }}
                    >
                      {wg.scoreQuiz}
                    </td>
                    <td
                      style={{
                        textAlign: "center",
                        fontWeight: 700,
                        color: "#166534",
                      }}
                    >
                      {wg.scoreAttitude}
                    </td>
                  </tr>
                );
              })
            )}
            {(!student.meetings || student.meetings.length === 0) &&
              weeklyEntries === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      textAlign: "center",
                      padding: "30px",
                      color: "#94a3b8",
                    }}
                  >
                    Belum ada data penilaian mingguan.
                  </td>
                </tr>
              )}
          </tbody>
        </table>

        <div className={styles.footerCaption}>
          <p
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "#2563eb",
            }}
          >
            &ldquo;Setiap Anak Hebat! Setiap Anak Berbakat!&rdquo; ✨
          </p>
          <p
            style={{
              fontSize: "12px",
              color: "#94a3b8",
              marginTop: "4px",
            }}
          >
            Gerakan Suka Baca — @komunitasgsb
          </p>
        </div>
      </div>
    </div>
  );
}
