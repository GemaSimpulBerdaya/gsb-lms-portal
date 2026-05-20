/**
 * Template rapor GSB — mereplikasi format PDF di `public/raport/*.pdf`.
 *
 * Struktur (lihat SYSTEM_FLOW.md §9.1):
 *  - Cover
 *  - Profil Siswa
 *  - Daftar Isi
 *  - Quote Ki Hajar Dewantara
 *  - Bagian 01: Pengantar
 *  - Bagian 02: Penilaian KBM & UAS (+ narasi + rekomendasi)
 *  - Bagian 03: Kehadiran
 *  - Bagian 04: Lampiran 1-5
 *
 * Data masuk sebagai `ReportPayload` (lihat `./reportTypes.ts`).
 * Styling pakai StyleSheet `@react-pdf/renderer` — tidak pakai CSS eksternal.
 *
 * Palet warna mengikuti brand GSB (green, orange, sand) di Tailwind config.
 */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
} from "@react-pdf/renderer";
import type { ReportPayload, UasComponent } from "./reportTypes";

// ── Warna brand GSB ────────────────────────────────────────────────────────
const COLOR = {
  green: "#2F7D3A",
  orange: "#F28C28",
  sand: "#F6EFDE",
  text: "#1F2937",
  muted: "#6B7280",
  border: "#E5E7EB",
  bgSoft: "#FAF8F2",
};

// ── Style global ───────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  page: {
    paddingTop: 40,
    paddingBottom: 40,
    paddingHorizontal: 48,
    fontSize: 10.5,
    lineHeight: 1.4,
    color: COLOR.text,
    fontFamily: "Helvetica",
  },
  coverPage: {
    padding: 0,
    backgroundColor: COLOR.sand,
    color: COLOR.text,
  },
  coverInner: {
    flex: 1,
    paddingTop: 120,
    paddingHorizontal: 64,
    alignItems: "center",
  },
  coverTitle: {
    fontSize: 36,
    fontFamily: "Helvetica-Bold",
    color: COLOR.green,
    marginBottom: 4,
  },
  coverSubtitle: {
    fontSize: 18,
    color: COLOR.text,
    marginBottom: 32,
  },
  coverSemester: {
    fontSize: 12,
    color: COLOR.muted,
    marginBottom: 96,
  },
  coverName: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
    marginBottom: 4,
  },
  coverFase: {
    fontSize: 14,
    color: COLOR.muted,
    textAlign: "center",
  },
  coverFooter: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    color: COLOR.muted,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: COLOR.green,
    marginBottom: 4,
  },
  h2: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    marginTop: 12,
    marginBottom: 6,
  },
  h3: {
    fontSize: 11.5,
    fontFamily: "Helvetica-Bold",
    marginTop: 8,
    marginBottom: 4,
  },
  muted: { color: COLOR.muted },
  italic: { fontFamily: "Helvetica-Oblique" },
  bold: { fontFamily: "Helvetica-Bold" },
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    marginVertical: 8,
  },
  rowProfile: { flexDirection: "row", marginBottom: 3 },
  rowProfileLabel: { width: 140, color: COLOR.muted },
  rowProfileValue: { flex: 1 },

  // Tabel
  table: { marginTop: 6, marginBottom: 6 },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLOR.border },
  thead: {
    backgroundColor: COLOR.bgSoft,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  th: {
    fontFamily: "Helvetica-Bold",
    paddingVertical: 5,
    paddingHorizontal: 4,
    fontSize: 9.5,
  },
  td: { paddingVertical: 5, paddingHorizontal: 4, fontSize: 9.5 },

  // Kotak narasi
  box: {
    borderWidth: 0.75,
    borderColor: COLOR.border,
    borderRadius: 4,
    padding: 10,
    backgroundColor: COLOR.bgSoft,
    marginTop: 6,
  },
  predikatBox: {
    backgroundColor: COLOR.green,
    color: "#FFFFFF",
    padding: 12,
    borderRadius: 6,
    marginVertical: 10,
  },
  predikatTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 2 },
  predikatText: { fontSize: 10, color: "#FFFFFF" },

  pageFooter: {
    position: "absolute",
    bottom: 20,
    left: 48,
    right: 48,
    fontSize: 8,
    color: COLOR.muted,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: COLOR.border,
    paddingTop: 4,
  },
});

// ── Helpers ────────────────────────────────────────────────────────────────

const fmtDate = (d: string | Date | null | undefined): string => {
  if (!d) return "—";
  try {
    const date = typeof d === "string" ? new Date(d) : d;
    if (isNaN(date.getTime())) return String(d);
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return String(d);
  }
};

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

const pts = (n: number) => `${Math.round(n).toLocaleString("id-ID")} poin`;

// ── Komponen-komponen halaman ──────────────────────────────────────────────

function CoverPage({ data }: { data: ReportPayload }) {
  const jenjang = data.faseConfig?.jenjang || "";
  const faseLabel = data.category ? `${data.category}${jenjang ? ` · ${jenjang}` : ""}` : jenjang;

  return (
    <Page size="A4" style={[styles.page, styles.coverPage]}>
      <View style={styles.coverInner}>
        <Text style={styles.coverTitle}>Rapor Siswa</Text>
        <Text style={styles.coverTitle}>GSB</Text>
        <Text style={styles.coverSubtitle}>Laporan Hasil Belajar Siswa</Text>
        {data.semester ? (
          <Text style={styles.coverSemester}>Semester {data.semester}</Text>
        ) : null}

        <Text style={styles.coverName}>{data.name}</Text>
        <Text style={styles.coverFase}>{faseLabel}</Text>
      </View>
      <Text style={styles.coverFooter}>Komunitas Gerakan Suka Baca (GSB)</Text>
    </Page>
  );
}

function ProfilePage({ data }: { data: ReportPayload }) {
  const p = data.profile;
  const ttl = [p.birthPlace, fmtDate(p.birthDate)].filter(Boolean).join(", ");
  const kelasFase = [data.category, data.faseConfig?.jenjang].filter(Boolean).join(" · ");
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Profil Siswa</Text>
      <View style={styles.hr} />
      <Row label="Nama Lengkap" value={data.name} />
      <Row label="Jenis Kelamin" value={p.gender || "—"} />
      <Row label="Tempat, Tanggal Lahir" value={ttl || "—"} />
      <Row label="Kelas/Fase" value={kelasFase || "—"} />
      <Row label="Asal Sekolah" value={p.schoolOrigin || "—"} />
      <Row label="Nomor WhatsApp" value={p.phone || "—"} />
      <Row label="Alamat Domisili" value={p.address || "—"} />
      <Row label="Nama Orang Tua" value={data.parentName || "—"} />
      {p.studentCode ? <Row label="No. Induk" value={p.studentCode} /> : null}
      {p.pic ? <Row label="PIC Relawan" value={p.pic} /> : null}

      <View style={[styles.box, { marginTop: 24 }]}>
        <Text style={[styles.bold, { marginBottom: 4 }]}>Isi Rapor</Text>
        <Text>01 · Pengantar — deskripsi isi rapor & sistem penilaian.</Text>
        <Text>02 · Penilaian — poin belajar, predikat, rekomendasi.</Text>
        <Text>03 · Kehadiran — rekap hadir/izin/sakit/alpa.</Text>
        <Text>04 · Lampiran — materi, dokumentasi, penilaian KBM, rubrik UAS.</Text>
      </View>

      <View style={[styles.box, { marginTop: 16 }]}>
        <Text style={[styles.italic, { color: COLOR.muted }]}>
          &ldquo;Mempunyai ketetapan, tidak tergoyahkan, berisi dengan berilmu pengetahuan,
          hingga yakin dengan seyakin-yakinnya bahwa apa yang dilakukannya adalah benar dan baik.&rdquo;
        </Text>
        <Text style={[{ marginTop: 4, textAlign: "right" }]}>— Ki Hajar Dewantara</Text>
      </View>
      <PageFooter name={data.name} page="Profil" />
    </Page>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <View style={styles.rowProfile}>
      <Text style={styles.rowProfileLabel}>{label}</Text>
      <Text style={styles.rowProfileValue}>: {value}</Text>
    </View>
  );
}

function PengantarPage({ data }: { data: ReportPayload }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>01 · Pengantar</Text>
      <Text style={styles.muted}>Deskripsi isi rapor dan sistem penilaian belajar.</Text>
      <View style={styles.hr} />
      <Text>
        Rapor ini merupakan evaluasi sekaligus apresiasi hasil belajar siswa GSB selama satu
        semester dengan sistem penilaian poin belajar. Pembelajaran dilaksanakan setiap hari
        Minggu pukul 10.00–12.00, dengan metode kelas luring di beberapa lokasi belajar
        (Sekolah Master dan Rumah Belajar) serta kelas daring melalui Zoom Meeting. Pada
        waktu tertentu, kegiatan belajar juga dilakukan secara asinkronus sesuai kebutuhan.
      </Text>
      <Text style={{ marginTop: 8 }}>
        Angka yang tertulis pada rapor merupakan akumulasi poin belajar, yaitu gabungan
        penilaian yang menggambarkan pemahaman siswa terhadap materi, hasil latihan untuk
        menguatkan pemahaman, serta sikap siswa selama mengikuti pembelajaran.
      </Text>

      <View style={styles.box}>
        <Text style={styles.bold}>Poin Konsep (Pemahaman)</Text>
        <Text>
          Penilaian pemahaman siswa terhadap materi pada literasi numerasi, sains, Bahasa
          Indonesia, dan Bahasa Inggris. Penilaian UAS termasuk dalam poin ini.
        </Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.bold}>Poin Kuis (Latihan Soal)</Text>
        <Text>
          Poin dari latihan/kuis pekanan untuk menguji pemahaman siswa selama KBM (tidak
          berlaku pada UAS).
        </Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.bold}>Poin Sikap (Afektif)</Text>
        <Text>
          Penilaian sikap siswa selama mengikuti pembelajaran, seperti kedisiplinan,
          partisipasi, kerja sama, dan tanggung jawab. Penilaian UAS juga termasuk dalam poin
          ini.
        </Text>
      </View>
      <PageFooter name={data.name} page="01 Pengantar" />
    </Page>
  );
}

function PenilaianPage({ data }: { data: ReportPayload }) {
  const p = data.penilaian;

  const hasBing = p.uasBahasaInggris.length > 0 || (data.faseConfig?.uasBInggris != null);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>02 · Penilaian KBM & UAS</Text>
      <Text style={styles.muted}>Poin belajar, predikat, dan rekomendasi pembelajaran.</Text>
      <View style={styles.hr} />

      <View style={styles.predikatBox}>
        <Text style={styles.predikatTitle}>
          {data.name} mendapat {pts(p.totalPoin)} dengan Predikat {p.predikat.code}
        </Text>
        <Text style={styles.predikatText}>
          {p.predikat.label} · {p.predikat.description}
        </Text>
        <Text style={[styles.predikatText, { marginTop: 2 }]}>
          Capaian: {p.persentase}% dari total {pts(p.totalPoinMax)}.
        </Text>
      </View>

      {/* Tabel komponen */}
      <View style={styles.table}>
        <View style={[styles.tr, styles.thead]}>
          <Text style={[styles.th, { flex: 2 }]}>Komponen Penilaian</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Poin Siswa</Text>
          <Text style={[styles.th, { flex: 1, textAlign: "right" }]}>Poin Maksimal</Text>
        </View>
        <RowTotal label="Nilai KBM — Konsep" siswa={p.kbm.konsep.siswa} max={p.kbm.konsep.max} />
        <RowTotal label="Nilai KBM — Kuis" siswa={p.kbm.kuis.siswa} max={p.kbm.kuis.max} />
        <RowTotal label="Nilai KBM — Sikap" siswa={p.kbm.sikap.siswa} max={p.kbm.sikap.max} />

        {p.uasLiterasi.kognitif.map((c) => (
          <RowTotal
            key={`kg-${c.subject}`}
            label={`UAS Kognitif — ${c.label}`}
            siswa={c.score}
            max={c.maxScore}
          />
        ))}
        {p.uasLiterasi.afektif.map((c) => (
          <RowTotal
            key={`af-${c.subject}`}
            label={`UAS Afektif — ${c.label}`}
            siswa={c.score}
            max={c.maxScore}
          />
        ))}
        {hasBing && p.uasBahasaInggris.length === 0 ? (
          <RowTotal label="UAS Bahasa Inggris" siswa={0} max={data.faseConfig?.uasBInggris?.maxScore || 100} />
        ) : null}
        {p.uasBahasaInggris.map((c, i) => (
          <RowTotal
            key={`bing-${i}`}
            label={`UAS Bahasa Inggris${c.label && c.label !== "BING" ? ` — ${c.label}` : ""}`}
            siswa={c.score}
            max={c.maxScore}
          />
        ))}
        <View style={[styles.tr, { backgroundColor: COLOR.sand }]}>
          <Text style={[styles.td, styles.bold, { flex: 2 }]}>Total Poin Belajar</Text>
          <Text style={[styles.td, styles.bold, { flex: 1, textAlign: "right" }]}>{pts(p.totalPoin)}</Text>
          <Text style={[styles.td, styles.bold, { flex: 1, textAlign: "right" }]}>{pts(p.totalPoinMax)}</Text>
        </View>
      </View>

      <Text style={styles.h3}>Narasi</Text>
      <Text>
        <Text style={styles.bold}>Halo {data.name}, </Text>
        total poin belajarmu di semester ini mencapai {p.persentase}% yang artinya…
      </Text>
      <Text style={{ marginTop: 4 }}>
        <Text style={styles.bold}>Secara kognitif, </Text>
        {p.narasi.kognitif}
      </Text>
      <Text style={{ marginTop: 4 }}>
        <Text style={styles.bold}>Secara sikap, </Text>
        {p.narasi.sikap}
      </Text>

      <Text style={styles.h3}>Rekomendasi</Text>
      <View style={styles.box}>
        <Text style={styles.bold}>Untuk Siswa</Text>
        <Text>{p.narasi.rekomendasiSiswa}</Text>
      </View>
      <View style={styles.box}>
        <Text style={styles.bold}>Untuk Orang Tua</Text>
        <Text>{p.narasi.rekomendasiOrtu}</Text>
      </View>

      <PageFooter name={data.name} page="02 Penilaian" />
    </Page>
  );
}

function RowTotal({ label, siswa, max }: { label: string; siswa: number; max: number }) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, { flex: 2 }]}>{label}</Text>
      <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{pts(siswa)}</Text>
      <Text style={[styles.td, { flex: 1, textAlign: "right" }]}>{pts(max)}</Text>
    </View>
  );
}

function KehadiranPage({ data }: { data: ReportPayload }) {
  const s = data.attendanceSummary;
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>03 · Kehadiran</Text>
      <Text style={styles.muted}>Rekap kehadiran dan rekomendasi.</Text>
      <View style={styles.hr} />

      <View style={styles.table}>
        <RowKehadiran label="Hadir" count={s.HADIR} total={data.kehadiran.totalLuring} />
        <RowKehadiran label="Izin" count={s.IZIN} total={data.kehadiran.totalLuring} />
        <RowKehadiran label="Sakit" count={s.SAKIT} total={data.kehadiran.totalLuring} />
        <RowKehadiran label="Alpa" count={s.ALFA} total={data.kehadiran.totalLuring} />
        {s.ASINKRONUS > 0 ? (
          <View style={styles.tr}>
            <Text style={[styles.td, { flex: 2 }]}>Asinkronus</Text>
            <Text style={[styles.td, { flex: 2 }]}>{s.ASINKRONUS} kelas (tidak dihitung)</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.box}>
        <Text>
          <Text style={styles.bold}>Halo {data.name}, </Text>
          kehadiranmu di semester ini mencapai {data.kehadiran.hadirPct}%.
        </Text>
        <Text style={{ marginTop: 4 }}>{data.kehadiran.narasi}</Text>
        <Text style={{ marginTop: 6, fontStyle: "italic" }}>
          Target berikutnya: pertahankan kehadiranmu agar lebih dari {data.kehadiran.target}%.
        </Text>
      </View>

      <PageFooter name={data.name} page="03 Kehadiran" />
    </Page>
  );
}

function RowKehadiran({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  return (
    <View style={styles.tr}>
      <Text style={[styles.td, { flex: 1 }]}>{label}</Text>
      <Text style={[styles.td, { flex: 2 }]}>
        {count} dari {total} kelas luring
      </Text>
    </View>
  );
}

// Lampiran 1: Materi & Dokumentasi
function Lampiran1Page({ data }: { data: ReportPayload }) {
  const rows = data.kbmDates.length ? data.kbmDates : [];
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.sectionTitle}>Lampiran 1 · Materi & Dokumentasi</Text>
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
          rows.map((d, i) => (
            <View key={i} style={styles.tr}>
              <Text style={[styles.td, { flex: 1 }]}>{fmtDateShort(d.date)}</Text>
              <Text style={[styles.td, { flex: 2 }]}>{d.topic || "—"}</Text>
              <Text style={[styles.td, { flex: 1 }]}>
                {d.materialLink ? <Link src={d.materialLink}>klik disini</Link> : "—"}
              </Text>
              <Text style={[styles.td, { flex: 1 }]}>
                {d.documentationLink ? <Link src={d.documentationLink}>klik disini</Link> : "—"}
              </Text>
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
      <Text style={styles.sectionTitle}>Lampiran 2 · Kehadiran & Penilaian KBM</Text>
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
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.hr} />
      {components.length === 0 ? (
        <Text style={styles.muted}>Belum ada data UAS untuk kategori ini.</Text>
      ) : (
        components.map((c, i) => (
          <View key={i} style={{ marginBottom: 10 }}>
            <Text style={styles.h3}>{c.label}</Text>
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

// Lampiran 6: Portofolio Siswa (Karya + Dokumentasi KBM)
function Lampiran6Page({ data }: { data: ReportPayload }) {
  const karya = data.portfolio || [];
  const dokumentasi = data.documentations || [];

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
      <Text style={styles.sectionTitle}>Lampiran 6 · Portofolio Siswa</Text>
      <View style={styles.hr} />
      <Text style={[styles.td, { marginBottom: 4 }]}>
        Kumpulan karya individu dan dokumentasi KBM sepanjang semester.
      </Text>

      {/* Section: Karya Siswa */}
      <Text style={{ fontSize: 10, fontWeight: 700, color: COLOR.green, marginTop: 10, marginBottom: 6 }}>
        Karya Siswa
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

      {/* Section: Dokumentasi KBM */}
      <Text style={{ fontSize: 10, fontWeight: 700, color: COLOR.green, marginTop: 14, marginBottom: 6 }}>
        Dokumentasi KBM
      </Text>
      {dokumentasi.length === 0 ? (
        <Text style={[styles.td, { paddingVertical: 8 }]}>Belum ada dokumentasi KBM.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {dokumentasi.map((d) => {
            // photoUrl di Report bisa jadi data:image base64 atau URL.
            // @react-pdf bisa handle keduanya selama format-nya valid.
            const src = d.photoUrl || null;
            const sub = [
              fmtDateShort(d.date),
              d.location || "",
            ]
              .filter(Boolean)
              .join(" · ");
            return (
              <Card
                key={d._id}
                src={src}
                href={d.photoUrl || "#"}
                title={d.title}
                sub={sub}
              />
            );
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
      {data.portfolio && data.portfolio.length > 0 ||
       data.documentations && data.documentations.length > 0 ? (
        <Lampiran6Page data={data} />
      ) : null}
    </Document>
  );
}

export default ReportDocument;
