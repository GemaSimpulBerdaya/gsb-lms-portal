import mongoose from "mongoose";

const RelawanSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true, select: false },
  teamName: String,
  region: String,
  name: String,
  role: { type: String, default: 'RELAWAN' },
  resetToken: { type: String },
  resetTokenExpiry: { type: Date }
}, { timestamps: true, collection: 'relawans' });



const NilaiOfflineSchema = new mongoose.Schema({
  anakDidikId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnakDidik', required: true },
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Relawan', required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null },
  title: { type: String, default: "" }, // Nama tugas, misal: Tugas 1
  // TUGAS = nilai KBM pekanan (3 skor: Konsep, Kuis, Sikap)
  // KUIS  = kuis pekanan (legacy)
  // UJIAN = legacy
  // UTS   = Ujian Tengah Semester (satu skor akhir)
  // UAS   = Ujian Akhir Semester, pakai field subject + rubric + maxScore
  // TRYOUT = khusus kelas SNBT (pakai tryoutNumber)
  type: { type: String, enum: ['TUGAS', 'UJIAN', 'KUIS', 'UTS', 'UAS', 'TRYOUT'], required: true },
  week: { type: Number, default: null }, // null untuk UJIAN/UTS/UAS
  score: { type: Number, required: true, min: 0 }, // Nilai total / rata-rata
  scoreConcept: { type: Number, default: 0, min: 0, max: 100 },
  scoreQuiz: { type: Number, default: 0, min: 0, max: 100 },
  scoreAttitude: { type: Number, default: 0, min: 0, max: 100 },

  // ── Khusus UAS ─────────────────────────────────────────────
  // subject: mata pelajaran/domain UAS. Dulu enum terbatas; sekarang String
  // bebas supaya bisa menampung komponen khas tiap fase (misal
  // MENGENAL_ANGKA untuk Tunas/Pucuk, MENYIMAK untuk Pelita,
  // SIKAP_ILMIAH untuk Fase D, KETEKUNAN untuk Fase E, dst.).
  // Validasi/whitelist dilakukan di layer API berdasar `faseConfig`
  // di koleksi settings, bukan di schema.
  subject: { type: String, default: null, trim: true, uppercase: true },
  // Poin maksimal untuk komponen ini (mis. 30, 20, 15)
  // Jika null, default 100 (untuk TUGAS/KUIS biasa)
  maxScore: { type: Number, default: null, min: 0 },

  // Rubrik detail untuk UAS (kognitif/afektif/B.Inggris).
  // Setiap item = satu kriteria rubrik yang tampil di Lampiran 3-5 rapor.
  // `score` item boleh 0 untuk kriteria yang dilampirkan tapi belum dinilai.
  // Jumlah skor item tidak wajib sama dengan `score` subject —
  // admin/relawan yang memastikan konsistensi.
  rubricItems: {
    type: [{
      criterion: { type: String, required: true, trim: true },
      score: { type: Number, required: true, min: 0 },
      maxScore: { type: Number, required: true, min: 0 },
    }],
    default: [],
  },

  // ── Khusus TRYOUT SNBT ─────────────────────────────────────
  tryoutNumber: { type: Number, default: null }, // 1 atau 2

  notes: String,
  semester: { type: String, required: true }, // e.g., '2025-Ganjil'
}, { timestamps: true, collection: 'nilai_offline' });

// Paksa re-register model agar perubahan enum/field aktif di dev
if (mongoose.models.NilaiOffline) {
  delete mongoose.models.NilaiOffline;
}

export const Relawan = mongoose.models.Relawan || mongoose.model("Relawan", RelawanSchema);
export const NilaiOffline = mongoose.model("NilaiOffline", NilaiOfflineSchema);
