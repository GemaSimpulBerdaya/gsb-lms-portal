/**
 * Template PDF rapor GSB — sumber tunggal untuk preview, unduhan individual,
 * dan arsip rapor kolektif.
 *
 * Struktur (lihat SYSTEM_FLOW.md §9.1):
 *  - Cover
 *  - Profil Siswa
 *  - Daftar Isi
 *  - Quote Ki Hajar Dewantara
 *  - Bagian 01: Pengantar
 *  - Bagian 02: Penilaian KBM & UAS (+ narasi + rekomendasi)
 *  - Bagian 03: Kehadiran
 *  - Bagian 04: Lampiran 1-6
 *
 * Data masuk sebagai `ReportPayload` (lihat `./reportTypes.ts`).
 * Styling ada di `./reportStyles.ts` memakai StyleSheet `@react-pdf/renderer`.
 *
 * Bahasa visual mengikuti desain rapor: kertas grid, judul pill hijau, badge
 * semester kuning, dan kartu-kartu membulat.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  Link,
  Svg,
  Path,
} from "@react-pdf/renderer";
import type { ReportPayload, UasComponent } from "./reportTypes";
import { COLOR, styles } from "./reportStyles";
import { formatSubjectLabel } from "@/utils/formatters";

const LOGO_PATH = `${process.cwd()}/public/logo-gsb.png`;

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtDateShort = (d: string | Date | null | undefined): string => {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    if (isNaN(date.getTime())) return String(d);
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
  } catch {
    return String(d);
  }
};

/** Kunci tanggal stabil agar jadwal dan laporan KBM bisa dipasangkan per hari. */
const dateKey = (d: string | Date | null | undefined): string => {
  if (!d) return "";
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    if (isNaN(date.getTime())) return "";

    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((item) => item.type === type)?.value || "";

    return `${part("year")}-${part("month")}-${part("day")}`;
  } catch {
    return "";
  }
};

const AVATAR_COLORS = ["#2ECC71", "#3498DB", "#9B59B6", "#F1C40F", "#E67E22", "#E74C3C"];

const pickAvatarColor = (name: string) => {
  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

// ── Komponen-komponen halaman ──────────────────────────────────────────────

function GridBackground() {
  return (
    <View style={styles.gridLayer}>
      {Array.from({ length: 33 }, (_, index) => (
        <View
          key={`grid-v-${index}`}
          style={[styles.gridVertical, { left: index * 18.75 }]}
        />
      ))}
      {Array.from({ length: 46 }, (_, index) => (
        <View
          key={`grid-h-${index}`}
          style={[styles.gridHorizontal, { top: index * 18.75 }]}
        />
      ))}
    </View>
  );
}

function SectionHeader({ number, title }: { number?: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      {number ? (
        <View style={styles.numberBadge}>
          <Text style={styles.numberBadgeText}>{number}</Text>
        </View>
      ) : null}
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function CoverStickers() {
  return (
    <View style={styles.coverStickerRow}>
      <View style={styles.stickerStar}>
        <Svg width={27} height={27} viewBox="0 0 24 24">
          <Path
            fill="#FACC15"
            d="m12 2.2 3.02 6.12 6.76.98-4.89 4.77 1.16 6.73L12 17.62 5.95 20.8l1.16-6.73L2.22 9.3l6.76-.98L12 2.2Z"
          />
        </Svg>
      </View>
      <View style={styles.stickerRocket}>
        <Svg width={30} height={30} viewBox="0 0 24 24">
          <Path fill="#F97316" d="M8.2 14.7 4.4 18.5l1.1-4.8 3.2-3.2 2.8 1.4-3.3 2.8Z" />
          <Path fill="#EA580C" d="M9 13.8C10.5 7.2 14.8 3 21 3c0 6.2-4.2 10.5-10.8 12L9 13.8Z" />
          <Path fill="#FFF7ED" d="M15.1 7.1a1.8 1.8 0 1 1 2.55 2.55 1.8 1.8 0 0 1-2.55-2.55Z" />
          <Path fill="#FACC15" d="M7.2 16.8c-1.6.4-3 1.8-3.8 3.8 2-.8 3.4-2.2 3.8-3.8Z" />
        </Svg>
      </View>
    </View>
  );
}

function CoverPage({ data }: { data: ReportPayload }) {
  const faseLabel = data.fase || "—";

  return (
    <Page size="A4" style={[styles.page, styles.coverPage]}>
      <GridBackground />
      <Text style={styles.watermark}>GSB</Text>
      <View style={styles.coverInner}>
        <CoverStickers />
        <View style={styles.coverBrand}>
          {/* eslint-disable-next-line jsx-a11y/alt-text */}
          <Image src={LOGO_PATH} style={styles.coverLogo} />
          <Text style={styles.coverTitle}>Rapor Siswa{"\n"}GSB</Text>
          {data.semester ? (
            <Text style={styles.coverSemester}>{data.semester}</Text>
          ) : null}
          <Text style={styles.coverSubtitle}>Laporan Hasil Belajar Siswa</Text>
        </View>

        <View style={styles.coverStudentCard}>
          <View style={styles.washiTape} />
          <Text style={styles.coverName}>{data.name}</Text>
          <Text style={styles.coverFase}>{faseLabel} · {data.region || "—"}</Text>
        </View>
        <Text style={styles.coverFooter}>Komunitas Gerakan Suka Baca (GSB)</Text>
      </View>
    </Page>
  );
}

function ProfilePage({ data }: { data: ReportPayload }) {
  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <SectionHeader number="01" title="Profil Siswa" />

      <View style={styles.profileCard}>
        <View style={[styles.profileAvatar, { backgroundColor: pickAvatarColor(data.name) }]}>
          <Text style={styles.profileAvatarText}>{data.name.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.profileRows}>
          <Row label="Nama Lengkap" value={data.name} />
          <Row label="Orang Tua / Wali" value={data.parentName || "—"} />
          <Row label="Jenjang / Fase" value={data.fase || "—"} />
          <Row label="Lokasi Belajar" value={data.region || "—"} />
          <Row label="Status" value="Aktif" />
        </View>
      </View>

      <View style={[styles.blueBubble, { marginTop: "auto" }]}>
        <Text style={[styles.italic, { color: COLOR.text, fontSize: 9.75 }]}>
          &ldquo;Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan,
          Anda dapat mengubah dunia.&rdquo; — Nelson Mandela
        </Text>
      </View>
    </Page>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.rowProfile}>
      <Text style={styles.rowProfileLabel}>{label}</Text>
      <Text style={styles.rowProfileValue}>{value}</Text>
    </View>
  );
}

function PengantarPage({ data }: { data: ReportPayload }) {
  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <SectionHeader number="02" title="Pengantar" />
      <View style={{ lineHeight: 1.65 }}>
        <Text style={{ marginBottom: 6 }}>
          Rapor ini merupakan evaluasi sekaligus apresiasi hasil belajar siswa GSB selama{" "}
          <Text style={styles.bold}>{data.semester || "satu semester"}</Text> dengan sistem
          penilaian poin belajar.
        </Text>
        <Text style={{ marginBottom: 6 }}>
          Pembelajaran dilaksanakan setiap hari Minggu pukul 10.00–12.00, dengan metode
          kelas luring di beberapa lokasi belajar (Sekolah Master dan Rumah Belajar) serta
          kelas daring melalui Zoom Meeting. Pada waktu tertentu, kegiatan belajar juga
          dilakukan secara asinkronus sesuai kebutuhan.
        </Text>
        <Text style={{ marginBottom: 6 }}>
          Angka yang tertulis pada rapor merupakan{" "}
          <Text style={styles.bold}>akumulasi poin belajar</Text>, yaitu gabungan penilaian
          yang menggambarkan pemahaman siswa terhadap materi, hasil latihan untuk menguatkan
          pemahaman, serta sikap siswa selama mengikuti pembelajaran.
        </Text>

        <View style={styles.box}>
          <Text style={{ marginBottom: 4.5 }}>
            <Text style={styles.bold}>Poin Konsep (Pemahaman): </Text>
            Penilaian pemahaman siswa terhadap materi pada literasi numerasi, sains, Bahasa
            Indonesia, dan Bahasa Inggris.
          </Text>
          <Text style={{ marginBottom: 4.5 }}>
            <Text style={styles.bold}>Poin Kuis (Latihan Soal): </Text>
            Poin dari latihan/kuis pekanan untuk menguji pemahaman siswa selama KBM.
          </Text>
          <Text>
            <Text style={styles.bold}>Poin Sikap (Afektif): </Text>
            Penilaian sikap siswa selama mengikuti pembelajaran, seperti kedisiplinan,
            partisipasi, kerja sama, dan tanggung jawab.
          </Text>
        </View>
      </View>
    </Page>
  );
}

function PenilaianPage({ data }: { data: ReportPayload }) {
  const p = data.penilaian;
  const totalKbm = p.kbm.konsep.siswa + p.kbm.kuis.siswa + p.kbm.sikap.siswa;
  const totalUas = Math.max(0, p.totalPoin - totalKbm);

  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <SectionHeader number="03" title="Penilaian Belajar" />

      <View style={styles.predikatBox}>
        <Text style={{ fontSize: 13.5 }}>
          Total Poin: <Text style={[styles.bold, { color: "#047857" }]}>{Math.round(p.totalPoin)}</Text>
        </Text>
        <Text style={{ fontSize: 12, marginTop: 3 }}>
          Predikat:{" "}
          <Text style={[styles.bold, { color: "#B91C1C" }]}>
            {p.predikat.code} ({p.predikat.label})
          </Text>
        </Text>
        <Text style={[styles.italic, { fontSize: 9.75, marginTop: 7.5, color: "#374151" }]}>
          &ldquo;{p.predikat.description}&rdquo;
        </Text>
      </View>

      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 3 }]}>Komponen Penilaian</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Poin Siswa</Text>
        </View>
        <ScoreSectionRow label="Nilai KBM (Kegiatan Belajar Mengajar)" />
        <ScoreRow label="• Akumulasi Konsep Mingguan" score={p.kbm.konsep.siswa} indent />
        <ScoreRow label="• Akumulasi Kuis Mingguan" score={p.kbm.kuis.siswa} indent />
        <ScoreRow label="• Akumulasi Adab & Sikap" score={p.kbm.sikap.siswa} indent />
        <ScoreSectionRow label="Nilai Evaluasi Semester" />
        <ScoreRow label="• Ujian Akhir Semester (UAS)" score={totalUas} indent />
        <View style={[styles.tr, { backgroundColor: "#FEFCE8" }]}>
          <Text style={[styles.td, styles.bold, { flex: 3 }]}>TOTAL POIN AKHIR</Text>
          <Text style={[styles.td, styles.bold, { flex: 1, textAlign: "center" }]}>
            {Math.round(p.totalPoin)}
          </Text>
        </View>
      </View>

      <View style={styles.blueBubble}>
        <Text style={[styles.bold, { marginBottom: 4.5 }]}>Catatan Perkembangan:</Text>
        <Text>
          Siswa menunjukkan antusiasme yang baik dalam mengikuti setiap sesi pembelajaran.{" "}
          {p.persentase >= 80
            ? "Pertahankan prestasi dan semangat belajarnya!"
            : "Teruslah berlatih agar pemahaman konsep semakin matang."}
        </Text>
      </View>
    </Page>
  );
}

function ScoreSectionRow({ label }: { label: string }) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, styles.bold, { flex: 3 }]}>{label}</Text>
      <Text style={[styles.td, { flex: 1 }]} />
    </View>
  );
}

function ScoreRow({ label, score, indent = false }: { label: string; score: number; indent?: boolean }) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, { flex: 3, paddingLeft: indent ? 19.5 : 7.5 }]}>{label}</Text>
      <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>{Math.round(score)}</Text>
    </View>
  );
}

function NarrativePage({ data }: { data: ReportPayload }) {
  const p = data.penilaian;
  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <SectionHeader title="Narasi & Rekomendasi" />
      <Text>
        <Text style={styles.bold}>Halo {data.name}, </Text>
        total poin belajarmu di semester ini mencapai {p.persentase}% yang artinya…
      </Text>
      <Text style={{ marginTop: 6 }}>
        <Text style={styles.bold}>Secara kognitif, </Text>
        {p.narasi.kognitif}
      </Text>
      <Text style={{ marginTop: 6 }}>
        <Text style={styles.bold}>Secara sikap, </Text>
        {p.narasi.sikap}
      </Text>

      <Text style={[styles.h3, { marginTop: 15 }]}>Rekomendasi</Text>
      <View style={styles.box} wrap={false}>
        <Text style={[styles.bold, { marginBottom: 3 }]}>Untuk Siswa</Text>
        <Text>{p.narasi.rekomendasiSiswa}</Text>
      </View>
      <View style={styles.box} wrap={false}>
        <Text style={[styles.bold, { marginBottom: 3 }]}>Untuk Orang Tua</Text>
        <Text>{p.narasi.rekomendasiOrtu}</Text>
      </View>
      <PageFooter name={data.name} page="Narasi" />
    </Page>
  );
}

function KehadiranPage({ data }: { data: ReportPayload }) {
  const s = data.attendanceSummary;
  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <SectionHeader number="04" title="Kehadiran" />

      <View style={styles.statGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Persentase Kehadiran</Text>
          <Text style={[styles.statValue, { color: "#2563EB" }]}>{data.kehadiran.hadirPct}%</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Total Pertemuan</Text>
          <Text style={[styles.statValue, { color: COLOR.muted }]}>{s.total}</Text>
        </View>
      </View>

      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 3 }]}>Status Presensi</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>Jumlah</Text>
        </View>
        <AttendanceRow label="Hadir" count={s.HADIR} />
        <AttendanceRow label="Izin" count={s.IZIN} />
        <AttendanceRow label="Sakit" count={s.SAKIT} />
        <AttendanceRow label="Alfa / Tanpa Keterangan" count={s.ALFA} />
        {s.ASINKRONUS > 0 ? (
          <AttendanceRow label="Asinkronus" count={s.ASINKRONUS} />
        ) : null}
      </View>

      <View style={styles.blueBubble}>
        <Text style={[styles.bold, { marginBottom: 4.5 }]}>Rekomendasi Kehadiran:</Text>
        <Text>{data.kehadiran.narasi}</Text>
      </View>
    </Page>
  );
}

function AttendanceRow({ label, count }: { label: string; count: number }) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, { flex: 3 }]}>{label}</Text>
      <Text style={[styles.td, { flex: 1, textAlign: "center" }]}>{count}</Text>
    </View>
  );
}

function DetailMingguanPage({ data }: { data: ReportPayload }) {
  const rows = data.meetings.length > 0
    ? data.meetings
    : data.weeklyGrades.map((grade) => ({ ...grade, meetingIndex: 1 }));

  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <SectionHeader number="05" title="Lampiran: Detail Mingguan" />
      <Text style={[styles.muted, { marginBottom: 10.5 }]}>
        Berikut adalah rincian penilaian yang diperoleh setiap pekannya:
      </Text>

      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { width: 67.5 }]}>Minggu</Text>
          <Text style={[styles.th, { flex: 1 }]}>Materi / Aktivitas</Text>
          <Text style={[styles.th, { width: 52.5, textAlign: "center" }]}>Konsep</Text>
          <Text style={[styles.th, { width: 52.5, textAlign: "center" }]}>Kuis</Text>
          <Text style={[styles.th, { width: 52.5, textAlign: "center" }]}>Adab</Text>
        </View>
        {rows.length === 0 ? (
          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 1, textAlign: "center", color: "#94A3B8", padding: 22.5 }]}>
              Belum ada data penilaian mingguan.
            </Text>
          </View>
        ) : (
          rows.map((row, index) => {
            const meetingsInWeek = rows.filter((item) => item.week === row.week).length;
            return (
              <View key={`${row.week}-${row.meetingIndex}-${index}`} style={styles.tr} wrap={false}>
                <View style={[styles.td, { width: 67.5 }]}>
                  <Text>Minggu {row.week}</Text>
                  {meetingsInWeek > 1 ? (
                    <Text style={{ fontSize: 7.5, color: COLOR.muted, fontFamily: "Helvetica-Bold" }}>
                      Pertemuan {row.meetingIndex}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.td, { flex: 1 }]}>{row.title || `Pertemuan ke-${row.week}`}</Text>
                <Text style={[styles.td, styles.bold, { width: 52.5, textAlign: "center", color: "#0369A1" }]}>
                  {row.scoreConcept}
                </Text>
                <Text style={[styles.td, styles.bold, { width: 52.5, textAlign: "center", color: "#991B1B" }]}>
                  {row.scoreQuiz}
                </Text>
                <Text style={[styles.td, styles.bold, { width: 52.5, textAlign: "center", color: "#166534" }]}>
                  {row.scoreAttitude}
                </Text>
              </View>
            );
          })
        )}
      </View>

      <View style={styles.footerCaption}>
        <Text style={[styles.bold, { fontSize: 11.25, color: "#2563EB" }]}>
          &ldquo;Setiap Anak Hebat! Setiap Anak Berbakat!&rdquo;
        </Text>
        <Text style={{ fontSize: 9, color: "#94A3B8", marginTop: 3 }}>
          Gerakan Suka Baca — @komunitasgsb
        </Text>
      </View>
    </Page>
  );
}

// Lampiran 1: Materi & Dokumentasi
function Lampiran1Page({ data }: { data: ReportPayload }) {
  const reportDocsByDate = new Map<
    string,
    { date: string | Date; titles: Set<string>; links: string[] }
  >();

  for (const doc of data.documentations || []) {
    if (!doc.photoUrl) continue;
    const key = dateKey(doc.date);
    if (!key) continue;

    const current = reportDocsByDate.get(key) || {
      date: doc.date,
      titles: new Set<string>(),
      links: [],
    };
    current.titles.add(doc.title.replace(/\s+\(\d+\/\d+\)$/, ""));
    if (!current.links.includes(doc.photoUrl)) current.links.push(doc.photoUrl);
    reportDocsByDate.set(key, current);
  }

  const scheduledDateKeys = new Set<string>();
  const rows = (data.kbmDates || []).map((kbm, index) => {
    const key = dateKey(kbm.date);
    if (key) scheduledDateKeys.add(key);
    const reportDocs = reportDocsByDate.get(key);
    const documentationLinks = [
      ...(kbm.documentationLink ? [kbm.documentationLink] : []),
      ...(reportDocs?.links || []),
    ].filter((link, linkIndex, allLinks) => allLinks.indexOf(link) === linkIndex);

    return {
      key: `schedule-${key || index}-${index}`,
      date: kbm.date,
      topic: kbm.topic || (reportDocs ? Array.from(reportDocs.titles).join(", ") : ""),
      materialLink: kbm.materialLink,
      documentationLinks,
    };
  });

  // Dokumentasi tetap muncul meski laporan dibuat di luar tanggal jadwal.
  for (const [key, docs] of reportDocsByDate) {
    if (scheduledDateKeys.has(key)) continue;
    rows.push({
      key: `report-${key}`,
      date: docs.date,
      topic: Array.from(docs.titles).join(", "),
      materialLink: undefined,
      documentationLinks: docs.links,
    });
  }

  rows.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <Text style={styles.sectionTitle}>Lampiran: Materi & Dokumentasi</Text>
      <View style={styles.hr} />

      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 1 }]}>Tanggal KBM</Text>
          <Text style={[styles.th, { flex: 2 }]}>Materi</Text>
          <Text style={[styles.th, { flex: 1 }]}>Link Materi</Text>
          <Text style={[styles.th, { flex: 1 }]}>Link Dokumentasi</Text>
        </View>
        {rows.length === 0 ? (
          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 5 }]}>Belum ada data KBM.</Text>
          </View>
        ) : (
          rows.map((d) => (
            <View key={d.key} style={styles.tr} wrap={false}>
              <Text style={[styles.td, { flex: 1 }]}>{fmtDateShort(d.date)}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{d.topic || "—"}</Text>
              <Text style={[styles.td, { flex: 1 }]}>
                {d.materialLink ? <Link src={d.materialLink}>klik disini</Link> : "—"}
              </Text>
              <View style={[styles.td, { flex: 1 }]}>
                {d.documentationLinks.length > 0 ? (
                  d.documentationLinks.map((link, index) => (
                    <Link
                      key={`${link}-${index}`}
                      src={link}
                      style={{ marginBottom: index < d.documentationLinks.length - 1 ? 2 : 0 }}
                    >
                      {d.documentationLinks.length > 1 ? `dokumen ${index + 1}` : "klik disini"}
                    </Link>
                  ))
                ) : (
                  <Text>—</Text>
                )}
              </View>
            </View>
          ))
        )}
      </View>
      <PageFooter name={data.name} page="Lampiran 1" />
    </Page>
  );
}

// Lampiran 2: Kehadiran & Penilaian KBM per tanggal
function Lampiran2Page({ data }: { data: ReportPayload }) {
  const rows = data.attendanceDays;
  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <Text style={styles.sectionTitle}>Lampiran: Kehadiran & Penilaian KBM</Text>
      <View style={styles.hr} />

      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 1 }]}>Tanggal</Text>
          <Text style={[styles.th, { flex: 1 }]}>Kehadiran</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: "right" }]}>Konsep</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: "right" }]}>Kuis</Text>
          <Text style={[styles.th, { flex: 0.8, textAlign: "right" }]}>Sikap</Text>
        </View>
        {rows.length === 0 ? (
          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 5 }]}>Belum ada data kehadiran.</Text>
          </View>
        ) : (
          rows.map((d, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>{fmtDateShort(d.date)}</Text>
              <Text style={[styles.td, { flex: 1 }]}>{d.status}</Text>
              <Text style={[styles.td, { flex: 0.8, textAlign: "right" }]}>
                {d.scoreConcept ?? 0}
              </Text>
              <Text style={[styles.td, { flex: 0.8, textAlign: "right" }]}>
                {d.scoreQuiz ?? 0}
              </Text>
              <Text style={[styles.td, { flex: 0.8, textAlign: "right" }]}>
                {d.scoreAttitude ?? 0}
              </Text>
            </View>
          ))
        )}
      </View>
      <Text style={[styles.muted, { marginTop: 6, fontSize: 9 }]}>
        Catatan: UAS tidak dimasukkan di tabel ini. Lihat Lampiran 3–5 untuk rubrik UAS.
      </Text>
      <PageFooter name={data.name} page="Lampiran 2" />
    </Page>
  );
}

// Lampiran 3-5: Rubrik UAS
function RubrikUasPage({
  data,
  title,
  components,
  pageTag,
}: {
  data: ReportPayload;
  title: string;
  components: UasComponent[];
  pageTag: string;
}) {
  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.hr} />
      {components.length === 0 ? (
        <Text style={styles.muted}>Belum ada data UAS untuk kategori ini.</Text>
      ) : (
        components.map((c, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <Text style={styles.h3}>{formatSubjectLabel(c.label)}</Text>
            <View style={styles.table}>
              <View style={[styles.tr, styles.thead]}>
                <Text style={[styles.th, { flex: 3 }]}>Rubrik Penilaian</Text>
                <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Nilai</Text>
              </View>
              {c.rubricItems.length === 0 ? (
                <View style={styles.tr}>
                  <Text style={[styles.td, { flex: 3 }]}>
                    {c.title || "Penilaian ringkas (tanpa rubrik detail)."}
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>
                    {c.score} / {c.maxScore}
                  </Text>
                </View>
              ) : (
                c.rubricItems.map((r, j) => (
                  <View key={j} style={styles.tr}>
                    <Text style={[styles.td, { flex: 3 }]}>{r.criterion}</Text>
                    <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>
                      {r.score} / {r.maxScore}
                    </Text>
                  </View>
                ))
              )}
              <View style={[styles.tr, { backgroundColor: COLOR.bgSoft }]}>
                <Text style={[styles.td, styles.bold, { flex: 3 }]}>Total</Text>
                <Text style={[styles.td, styles.bold, { flex: 1, textAlign: "right" }]}>
                  {c.score} / {c.maxScore}
                </Text>
              </View>
            </View>
          </View>
        ))
      )}
      <PageFooter name={data.name} page={pageTag} />
    </Page>
  );
}

function PageFooter({ name, page }: { name: string; page: string }) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text>Rapor GSB · {name}</Text>
      <Text>{page}</Text>
    </View>
  );
}

// ── Dokumen utama ──────────────────────────────────────────────────────────

// Lampiran 6: Karya Siswa
function Lampiran6Page({ data }: { data: ReportPayload }) {
  const karya = data.portfolio || [];

  // Cek apakah URL bisa di-render @react-pdf sebagai gambar.
  // Drive `view` link bukan direct image — fallback ke link.
  const isImgUrl = (url: string) => /\.(png|jpe?g|gif|webp)(\?|$)/i.test(url);

  // Render satu kartu (4-up grid)
  const Card = ({
    src,
    href,
    title,
    sub,
  }: {
    src: string | null;
    href: string;
    title: string;
    sub?: string;
  }) => (
    <View
      style={{
        width: "32%",
        border: `1px solid ${COLOR.border}`,
        borderRadius: 4,
        overflow: "hidden",
        marginBottom: 8,
      }}
    >
      <View
        style={{
          aspectRatio: 4 / 3,
          backgroundColor: "#f5f5f5",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {src ? (
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={src} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Text style={{ fontSize: 8, color: COLOR.muted }}>📁 link eksternal</Text>
        )}
      </View>
      <View style={{ padding: 6 }}>
        <Text style={{ fontSize: 8, fontWeight: 700, marginBottom: 2 }}>{title}</Text>
        {sub ? (
          <Text style={{ fontSize: 7, color: COLOR.muted, marginBottom: 3 }}>{sub}</Text>
        ) : null}
        <Link src={href} style={{ fontSize: 7, color: COLOR.green }}>
          buka link ↗
        </Link>
      </View>
    </View>
  );

  return (
    <Page size="A4" style={styles.page}>
      <GridBackground />
      <Text style={styles.sectionTitle}>Lampiran 6 · Karya Siswa</Text>
      <View style={styles.hr} />
      <Text style={[styles.td, { marginBottom: 4 }]}>
        Kumpulan karya individu siswa sepanjang semester.
      </Text>

      {karya.length === 0 ? (
        <Text style={[styles.td, { paddingVertical: 8 }]}>Belum ada karya siswa.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {karya.map((p) => {
            const src = p.thumbnailUrl || (isImgUrl(p.fileUrl) ? p.fileUrl : null);
            const sub = [
              p.week ? `Pekan ${p.week}` : "",
              p.date ? fmtDateShort(p.date) : "",
            ]
              .filter(Boolean)
              .join(" · ");
            return <Card key={p._id} src={src} href={p.fileUrl} title={p.title} sub={sub} />;
          })}
        </View>
      )}

      <PageFooter name={data.name} page="Lampiran 6" />
    </Page>
  );
}

export function ReportDocument({ data }: { data: ReportPayload }) {
  const hasBing =
    data.penilaian.uasBahasaInggris.length > 0 ||
    (data.faseConfig?.uasBInggris != null);

  return (
    <Document
      title={`Rapor GSB — ${data.name}`}
      author="Komunitas Gerakan Suka Baca (GSB)"
      subject="Laporan Hasil Belajar Siswa"
    >
      <CoverPage data={data} />
      <ProfilePage data={data} />
      <PengantarPage data={data} />
      <PenilaianPage data={data} />
      <KehadiranPage data={data} />
      <DetailMingguanPage data={data} />
      <NarrativePage data={data} />
      <Lampiran1Page data={data} />
      <Lampiran2Page data={data} />
      <RubrikUasPage
        data={data}
        title="Lampiran 3 · Rubrik Kognitif UAS Literasi"
        components={data.penilaian.uasLiterasi.kognitif}
        pageTag="Lampiran 3"
      />
      <RubrikUasPage
        data={data}
        title="Lampiran 4 · Rubrik Afektif UAS Literasi"
        components={data.penilaian.uasLiterasi.afektif}
        pageTag="Lampiran 4"
      />
      {hasBing ? (
        <RubrikUasPage
          data={data}
          title="Lampiran 5 · Rubrik UAS Bahasa Inggris"
          components={data.penilaian.uasBahasaInggris}
          pageTag="Lampiran 5"
        />
      ) : null}
      {data.portfolio && data.portfolio.length > 0 ? (
        <Lampiran6Page data={data} />
      ) : null}
    </Document>
  );
}

export default ReportDocument;
