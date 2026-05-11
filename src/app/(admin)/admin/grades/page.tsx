"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import styles from "./grades.module.css";
import Modal from "@/components/ui/Modal/Modal";

type GradeSummary = {
  _id: string;
  name: string;
  category: string;
  region: string;
  parentName: string;
  weeklyGrades: Record<number, {
    scoreConcept: number;
    scoreQuiz: number;
    scoreAttitude: number;
    score: number;
    title: string;
  }>;
  utsScore: number;
  uasScore: number;
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
  };
};

function GradesContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<GradeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [selectedRegion, setSelectedRegion] = useState("ALL");
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);
  const [selectedLevel, setSelectedLevel] = useState("ALL");
  const [availableLevels, setAvailableLevels] = useState<string[]>([]);

  const [selectedStudent, setSelectedStudent] = useState<GradeSummary | null>(null);

  const getPredicate = (score: number) => {
    if (score >= 85) return { letter: "A", label: "Sangat Baik", desc: "Siswa tuntas dengan pencapaian tinggi dan mampu mengaplikasikan konsep secara mandiri." };
    if (score >= 75) return { letter: "B", label: "Baik", desc: "Siswa menunjukkan pemahaman yang baik dan mampu menyelesaikan tugas dengan mandiri." };
    if (score >= 60) return { letter: "C", label: "Cukup", desc: "Siswa memahami konsep dasar namun masih memerlukan bimbingan." };
    return { letter: "D", label: "Perlu Bimbingan", desc: "Siswa memerlukan bimbingan intensif untuk memahami konsep dasar." };
  };

  const calculateTotalPoints = (student: GradeSummary) => {
    let total = 0;
    Object.values(student.weeklyGrades).forEach(wg => {
      total += (wg.scoreConcept || 0) + (wg.scoreQuiz || 0) + (wg.scoreAttitude || 0);
    });
    total += (student.utsScore || 0) + (student.uasScore || 0);
    return total;
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const d = await res.json();
        if (d.availableSemesters) setAvailableSemesters(d.availableSemesters);
        if (d.availableRegions) setAvailableRegions(d.availableRegions);
        if (d.availableLevels) setAvailableLevels(d.availableLevels);
        if (d.activeSemester) setSelectedSemester(d.activeSemester);
      }
    } catch (err) { console.error(err); }
  };

  const fetchGrades = useCallback(async () => {
    if (!selectedSemester) return;
    setLoading(true);
    try {
      const query = new URLSearchParams({
        semester: selectedSemester,
        region: selectedRegion,
        level: selectedLevel
      });
      const res = await fetch(`/api/admin/grades?${query.toString()}`);
      if (res.ok) {
        const result = await res.json();
        setData(result.data);
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [selectedSemester, selectedRegion, selectedLevel]);

  useEffect(() => { fetchSettings(); }, []);
  useEffect(() => { fetchGrades(); }, [fetchGrades]);

  useEffect(() => {
    const studentId = searchParams.get("student");
    if (studentId && data.length > 0) {
      const student = data.find(s => s._id === studentId);
      if (student) setSelectedStudent(student);
    }
  }, [searchParams, data]);

  const getRandomColor = (str: string) => {
    const colors = ["#2ecc71", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
    let hash = 0;
    for (let i = 0; i < str.length; i++) { hash = str.charCodeAt(i) + ((hash << 5) - hash); }
    return colors[Math.abs(hash) % colors.length];
  };

  const weeks = Array.from({ length: 16 }, (_, i) => i + 1);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Rekap Penilaian & Raport</h1>
        <p className={styles.subtitle}>Pantau capaian akademik siswa dan generate raport otomatis.</p>
      </header>

      <div className={styles.toolbar}>
        <div className={styles.filters}>
          <select className={styles.filterSelect} value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
            {availableSemesters.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={styles.filterSelect} value={selectedRegion} onChange={e => setSelectedRegion(e.target.value)}>
            <option value="ALL">Semua Wilayah</option>
            {availableRegions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select className={styles.filterSelect} value={selectedLevel} onChange={e => setSelectedLevel(e.target.value)}>
            <option value="ALL">Semua Jenjang</option>
            {availableLevels.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.tableWrapper}>
        {loading ? <div className={styles.loading}>Menghitung rekap penilaian...</div> : (
          <div className={styles.scrollArea}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ position: 'sticky', left: 0, zIndex: 10, background: '#fcfcfc' }}>Anak Didik</th>
                  {weeks.map(w => <th key={w} className={styles.weekCol}>W{w}</th>)}
                  <th className={styles.summaryCol}>Rata-rata</th>
                  <th>Presensi</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data.map(student => (
                  <tr key={student._id}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 9, background: '#fff' }}>
                      <div className={styles.studentInfo}>
                        <div className={styles.avatar} style={{ background: getRandomColor(student.name) }}>{student.name.charAt(0)}</div>
                        <div>
                          <span className={styles.studentName}>{student.name}</span>
                          <span className={styles.regionName}>{student.region} - {student.category}</span>
                        </div>
                      </div>
                    </td>
                    {weeks.map(w => {
                      const wg = student.weeklyGrades[w];
                      return (
                        <td key={w} className={styles.weekCol}>
                          {wg ? (
                            <div className={styles.scoreGroup}>
                              <div className={styles.scoreBox} style={{ background: '#e0f2fe', color: '#0369a1' }}>{wg.scoreConcept}</div>
                              <div className={styles.scoreBox} style={{ background: '#fef2f2', color: '#991b1b' }}>{wg.scoreQuiz}</div>
                              <div className={styles.scoreBox} style={{ background: '#f0fdf4', color: '#166534' }}>{wg.scoreAttitude}</div>
                            </div>
                          ) : "-"}
                        </td>
                      );
                    })}
                    <td className={styles.summaryCol}><div className={styles.finalScore}>{student.summary.finalScore}</div></td>
                    <td style={{ fontSize: '12px' }}>{student.attendanceSummary.HADIR}/{student.attendanceSummary.total}</td>
                    <td><button className={styles.raportBtn} onClick={() => setSelectedStudent(student)}>📄 Raport</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedStudent && (
        <Modal
          isOpen={!!selectedStudent}
          onClose={() => setSelectedStudent(null)}
          title={`Preview Raport - ${selectedStudent.name}`}
          maxWidth="900px"
          footer={<button className={styles.raportBtn} onClick={() => window.print()}>🖨️ Cetak Raport</button>}
        >
          <div id="raport-content" className={styles.raportPreview}>
            {/* PAGE 1: COVER */}
            <div className={styles.raportPage}>
              <div className={styles.raportWatermark}>GSB</div>
              <span className={styles.sticker} style={{ top: '40px', left: '40px' }}>⭐</span>
              <span className={styles.sticker} style={{ top: '100px', right: '60px' }}>🚀</span>
              <div className={styles.raportCoverPage}>
                <div className={styles.raportBrand}>
                  <img src="/logo-gsb.png" alt="Logo" style={{ width: '180px', marginBottom: '40px' }} />
                  <div className={styles.raportTitleBubble}>Rapor Siswa<br/>GSB</div>
                  <div className={styles.raportYearBadge}>{selectedSemester}</div>
                  <p style={{ fontSize: '18px', fontWeight: 600, color: '#64748b', marginTop: '20px' }}>Laporan Hasil Belajar Siswa</p>
                </div>
                
                <div className={styles.raportStudentInfoCard}>
                  <div className={styles.washiTape}></div>
                  <p style={{ fontSize: '36px', fontWeight: 900, color: '#1e293b', margin: '0 0 10px' }}>{selectedStudent.name}</p>
                  <p style={{ fontSize: '20px', color: '#64748b' }}>{selectedStudent.category} - {selectedStudent.region}</p>
                </div>

                <div style={{ marginTop: 'auto', padding: '20px 40px', background: '#fff', borderRadius: '50px', border: '2px solid #f1f5f9', fontWeight: 700, color: '#475569' }}>
                  Komunitas Gerakan Suka Baca (GSB)
                </div>
              </div>
            </div>

            {/* PAGE 2: PROFIL SISWA */}
            <div className={styles.raportPage}>
              <div className={styles.raportNumberBadge}>01</div>
              <h2 className={styles.raportGreenTitle}>Profil Siswa</h2>
              <div className={styles.raportIntroBox} style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{ width: '150px', height: '150px', background: getRandomColor(selectedStudent.name), borderRadius: '30px', margin: '0 auto 30px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px', color: 'white', fontWeight: 900 }}>
                  {selectedStudent.name.charAt(0)}
                </div>
                <div className={styles.raportProfileGrid}>
                  <div className={styles.raportProfileLabel}>Nama Lengkap</div>
                  <div className={styles.raportProfileValue}>{selectedStudent.name}</div>
                  
                  <div className={styles.raportProfileLabel}>Orang Tua / Wali</div>
                  <div className={styles.raportProfileValue}>{selectedStudent.parentName || "-"}</div>
                  
                  <div className={styles.raportProfileLabel}>Jenjang / Fase</div>
                  <div className={styles.raportProfileValue}>{selectedStudent.category}</div>
                  
                  <div className={styles.raportProfileLabel}>Wilayah Belajar</div>
                  <div className={styles.raportProfileValue}>{selectedStudent.region}</div>

                  <div className={styles.raportProfileLabel}>Status</div>
                  <div className={styles.raportProfileValue}>Aktif</div>
                </div>
              </div>
              <div className={styles.raportBlueBubble} style={{ marginTop: 'auto' }}>
                <p style={{ margin: 0, fontStyle: 'italic', fontSize: '14px' }}>
                  "Pendidikan adalah senjata paling mematikan di dunia, karena dengan pendidikan, Anda dapat mengubah dunia." — Nelson Mandela
                </p>
              </div>
            </div>

            {/* PAGE 3: PENGANTAR */}
            <div className={styles.raportPage}>
              <div className={styles.raportNumberBadge}>02</div>
              <h2 className={styles.raportGreenTitle}>Pengantar</h2>
              <div className={styles.raportIntroText}>
                <p>Rapor ini merupakan evaluasi sekaligus apresiasi hasil belajar siswa GSB selama <strong>{selectedSemester}</strong> dengan sistem penilaian poin belajar.</p>
                <p>Pembelajaran dilaksanakan setiap hari Minggu pukul 10.00–12.00, dengan metode kelas luring di beberapa lokasi belajar (Sekolah Master dan Rumah Belajar) serta kelas daring melalui Zoom Meeting. Pada waktu tertentu, kegiatan belajar juga dilakukan secara asinkronus sesuai kebutuhan.</p>
                <p>Angka yang tertulis pada rapor merupakan <strong>akumulasi poin belajar</strong>, yaitu gabungan penilaian yang menggambarkan pemahaman siswa terhadap materi, hasil latihan untuk menguatkan pemahaman, serta sikap siswa selama mengikuti pembelajaran.</p>
                
                <div className={styles.raportIntroBox}>
                  <p><strong>Poin Konsep (Pemahaman):</strong> Penilaian pemahaman siswa terhadap materi pada literasi numerasi, sains, Bahasa Indonesia, dan Bahasa Inggris.</p>
                  <p><strong>Poin Kuis (Latihan Soal):</strong> Poin dari latihan/kuis pekanan untuk menguji pemahaman siswa selama KBM.</p>
                  <p style={{ margin: 0 }}><strong>Poin Sikap (Afektif):</strong> Penilaian sikap siswa selama mengikuti pembelajaran, seperti kedisiplinan, partisipasi, kerja sama, dan tanggung jawab.</p>
                </div>
              </div>
            </div>

            {/* PAGE 4: PENILAIAN */}
            <div className={styles.raportPage}>
              <div className={styles.raportNumberBadge}>03</div>
              <h2 className={styles.raportGreenTitle}>Penilaian Belajar</h2>
              <div className={styles.raportHighlightBox}>
                <p style={{ margin: 0, fontSize: '22px' }}>Total Poin: <strong style={{ color: '#047857' }}>{calculateTotalPoints(selectedStudent)}</strong></p>
                <p style={{ margin: '5px 0 0', fontSize: '18px' }}>Predikat: <strong style={{ color: '#b91c1c' }}>{getPredicate(selectedStudent.summary.finalScore).letter} ({getPredicate(selectedStudent.summary.finalScore).label})</strong></p>
                <p style={{ fontStyle: 'italic', fontSize: '15px', marginTop: '15px', color: '#374151' }}>"{getPredicate(selectedStudent.summary.finalScore).desc}"</p>
              </div>
              
              <table className={styles.raportTable}>
                <thead>
                  <tr>
                    <th>Komponen Penilaian</th>
                    <th style={{ textAlign: 'center' }}>Poin Siswa</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Nilai KBM (Kegiatan Belajar Mengajar)</strong></td>
                    <td style={{ textAlign: 'center' }}></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '30px' }}>• Akumulasi Konsep Mingguan</td>
                    <td style={{ textAlign: 'center' }}>{selectedStudent.summary.avgConcept * Object.keys(selectedStudent.weeklyGrades).length}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '30px' }}>• Akumulasi Kuis Mingguan</td>
                    <td style={{ textAlign: 'center' }}>{selectedStudent.summary.avgQuiz * Object.keys(selectedStudent.weeklyGrades).length}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '30px' }}>• Akumulasi Adab & Sikap</td>
                    <td style={{ textAlign: 'center' }}>{selectedStudent.summary.avgAttitude * Object.keys(selectedStudent.weeklyGrades).length}</td>
                  </tr>
                  <tr>
                    <td><strong>Nilai Evaluasi Semester</strong></td>
                    <td style={{ textAlign: 'center' }}></td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '30px' }}>• Ujian Tengah Semester (UTS)</td>
                    <td style={{ textAlign: 'center' }}>{selectedStudent.utsScore || 0}</td>
                  </tr>
                  <tr>
                    <td style={{ paddingLeft: '30px' }}>• Ujian Akhir Semester (UAS)</td>
                    <td style={{ textAlign: 'center' }}>{selectedStudent.uasScore || 0}</td>
                  </tr>
                  <tr style={{ background: '#fefce8', fontWeight: 900, fontSize: '16px' }}>
                    <td>TOTAL POIN AKHIR</td>
                    <td style={{ textAlign: 'center' }}>{calculateTotalPoints(selectedStudent)}</td>
                  </tr>
                </tbody>
              </table>

              <div className={styles.raportBlueBubble}>
                <strong>Catatan Perkembangan:</strong><br/>
                Siswa menunjukkan antusiasme yang baik dalam mengikuti setiap sesi pembelajaran. 
                {selectedStudent.summary.finalScore >= 80 ? " Pertahankan prestasi dan semangat belajarnya!" : " Teruslah berlatih agar pemahaman konsep semakin matang."}
              </div>
            </div>

            {/* PAGE 5: KEHADIRAN */}
            <div className={styles.raportPage}>
              <div className={styles.raportNumberBadge}>04</div>
              <h2 className={styles.raportGreenTitle}>Kehadiran</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', margin: '20px 0' }}>
                <div className={styles.raportIntroBox} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 10px' }}>Persentase Kehadiran</p>
                  <p style={{ fontSize: '48px', fontWeight: 900, color: '#2563eb', margin: 0 }}>
                    {Math.round((selectedStudent.attendanceSummary.HADIR / (selectedStudent.attendanceSummary.total || 1)) * 100)}%
                  </p>
                </div>
                <div className={styles.raportIntroBox} style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '14px', color: '#64748b', margin: '0 0 10px' }}>Total Pertemuan</p>
                  <p style={{ fontSize: '48px', fontWeight: 900, color: '#64748b', margin: 0 }}>
                    {selectedStudent.attendanceSummary.total}
                  </p>
                </div>
              </div>

              <table className={styles.raportTable}>
                <thead>
                  <tr>
                    <th>Status Presensi</th>
                    <th style={{ textAlign: 'center' }}>Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>Hadir</td><td style={{ textAlign: 'center' }}>{selectedStudent.attendanceSummary.HADIR}</td></tr>
                  <tr><td>Izin</td><td style={{ textAlign: 'center' }}>{selectedStudent.attendanceSummary.IZIN}</td></tr>
                  <tr><td>Sakit</td><td style={{ textAlign: 'center' }}>{selectedStudent.attendanceSummary.SAKIT}</td></tr>
                  <tr><td>Alfa / Tanpa Keterangan</td><td style={{ textAlign: 'center' }}>{selectedStudent.attendanceSummary.ALFA}</td></tr>
                </tbody>
              </table>

              <div className={styles.raportBlueBubble}>
                <p style={{ margin: 0 }}>
                  <strong>Rekomendasi Kehadiran:</strong><br/>
                  {selectedStudent.attendanceSummary.HADIR / selectedStudent.attendanceSummary.total >= 0.8 
                    ? "Kehadiran sangat baik dan konsisten. Pertahankan kedisiplinan ini untuk hasil belajar yang maksimal."
                    : "Kehadiran perlu ditingkatkan. Pastikan untuk selalu hadir tepat waktu agar tidak tertinggal materi pembelajaran."}
                </p>
              </div>

              <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', textAlign: 'center', fontSize: '14px', paddingBottom: '40px' }}>
                <div style={{ width: '200px' }}>
                  <p style={{ marginBottom: '80px' }}>Mengetahui,<br/><strong>Orang Tua / Wali</strong></p>
                  <div style={{ borderBottom: '1px solid #000', margin: '0 20px' }}></div>
                </div>
                <div style={{ width: '200px' }}>
                  <p style={{ marginBottom: '80px' }}>Jakarta, {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}<br/><strong>Admin GSB</strong></p>
                  <p><strong>( Koordinator )</strong></p>
                </div>
              </div>
            </div>

            {/* PAGE 6: LAMPIRAN */}
            <div className={styles.raportPage}>
              <div className={styles.raportNumberBadge}>05</div>
              <h2 className={styles.raportGreenTitle}>Lampiran: Detail Mingguan</h2>
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '20px' }}>Berikut adalah rincian penilaian yang diperoleh setiap pekannya:</p>
              
              <table className={styles.raportTable} style={{ fontSize: '12px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>Minggu</th>
                    <th>Materi / Aktivitas</th>
                    <th style={{ textAlign: 'center' }}>Konsep</th>
                    <th style={{ textAlign: 'center' }}>Kuis</th>
                    <th style={{ textAlign: 'center' }}>Adab</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(w => {
                    const wg = selectedStudent.weeklyGrades[w];
                    if (!wg) return null;
                    return (
                      <tr key={w}>
                        <td>Minggu {w}</td>
                        <td>{wg.title || `Pertemuan ke-${w}`}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#0369a1' }}>{wg.scoreConcept}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#991b1b' }}>{wg.scoreQuiz}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: '#166534' }}>{wg.scoreAttitude}</td>
                      </tr>
                    );
                  })}
                  {Object.keys(selectedStudent.weeklyGrades).length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Belum ada data penilaian mingguan.</td>
                    </tr>
                  )}
                </tbody>
              </table>
              
              <div style={{ marginTop: 'auto', textAlign: 'center', padding: '20px', borderTop: '1px dashed #e2e8f0' }}>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#2563eb', margin: 0 }}>"Setiap Anak Hebat! Setiap Anak Berbakat!" ✨</p>
                <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '5px' }}>Gerakan Suka Baca — @komunitasgsb</p>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default function AdminGradesPage() {
  return (
    <Suspense fallback={<div>Memuat...</div>}>
      <GradesContent />
    </Suspense>
  );
}
