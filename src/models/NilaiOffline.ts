import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * NilaiOffline = nilai akademik per anak didik per evaluasi.
 *
 * Type:
 *  - TUGAS       = nilai KBM pekanan reguler (3 skor: Konsep, Kuis, Sikap; pakai `week`)
 *  - UAS         = Ujian Akhir Semester (pakai `subject` + `maxScore` + opsional rubrik)
 *  - TUGAS_SNBT  = nilai KBM SNBT pekanan (1 skor 0-100 di `score`; pakai `week`).
 *                  Skor Konsep/Kuis/Sikap tidak relevan untuk SNBT — disimpan 0.
 *  - TRYOUT      = Try Out SNBT (1 skor 0-100 di `score`; pakai `week` + `subject`
 *                  bernilai "TO1" atau "TO2" untuk membedakan TO sebelum vs sesudah KBM).
 *
 * Catatan: legacy types (UJIAN, KUIS, UTS) sudah dihapus Mei 2026. Type TRYOUT
 * dihidupkan kembali Juni 2026 untuk dukungan Kelas Online SNBT — tapi shape-nya
 * minimalis (tanpa rubricItems/maxScore), beda dari UAS.
 */
export interface IRubricItem {
  criterion: string;
  score: number;
  maxScore: number;
}

export interface INilaiOffline extends Document {
  anakDidikId: Types.ObjectId;
  relawanId: Types.ObjectId;
  moduleId?: Types.ObjectId | null;
  title: string;
  type: "TUGAS" | "UAS" | "TUGAS_SNBT" | "TRYOUT";
  week?: number | null;
  score: number;
  scoreConcept: number;
  scoreQuiz: number;
  scoreAttitude: number;
  subject?: string | null;
  maxScore?: number | null;
  rubricItems: IRubricItem[];
  notes?: string;
  semester: string;
  createdAt: Date;
  updatedAt: Date;
}

const NilaiOfflineSchema: Schema<INilaiOffline> = new Schema(
  {
    anakDidikId: { type: Schema.Types.ObjectId, ref: "AnakDidik", required: true },
    relawanId: { type: Schema.Types.ObjectId, ref: "Relawan", required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", default: null },
    title: { type: String, default: "" },
    type: {
      type: String,
      enum: ["TUGAS", "UAS", "TUGAS_SNBT", "TRYOUT"],
      required: true,
    },
    week: { type: Number, default: null },
    score: { type: Number, required: true, min: 0 },
    scoreConcept: { type: Number, default: 0, min: 0, max: 100 },
    scoreQuiz: { type: Number, default: 0, min: 0, max: 100 },
    scoreAttitude: { type: Number, default: 0, min: 0, max: 100 },

    // ── UAS-specific ─────────────────────────────────────────
    subject: { type: String, default: null, trim: true, uppercase: true },
    maxScore: { type: Number, default: null, min: 0 },
    rubricItems: {
      type: [
        {
          criterion: { type: String, required: true, trim: true },
          score: { type: Number, required: true, min: 0 },
          maxScore: { type: Number, required: true, min: 0 },
        },
      ],
      default: [],
    },

    notes: String,
    semester: { type: String, required: true },
  },
  { timestamps: true, collection: "offline_grades" }
);

// ── Pre-save validators (cross-field) ──────────────────────
// Hindari data invalid masuk lewat seed/script yang skip API layer.
NilaiOfflineSchema.pre("save", function () {
  const doc = this as INilaiOffline;
  if (doc.type === "TUGAS" && doc.week == null) {
    throw new Error("TUGAS wajib ada week");
  }
  if (doc.type === "UAS") {
    if (!doc.subject) throw new Error("UAS wajib ada subject");
    if (doc.maxScore == null || doc.maxScore <= 0) {
      throw new Error("UAS wajib ada maxScore > 0");
    }
  }
  // SNBT KBM per pertemuan → wajib `week` (agar bisa di-bucket per minggu di aggregator).
  if (doc.type === "TUGAS_SNBT" && doc.week == null) {
    throw new Error("TUGAS_SNBT wajib ada week");
  }
  // TRYOUT pakai subject "TO1" / "TO2" untuk bedain TO sebelum vs sesudah KBM
  // di pekan yg sama. Tanpa subject, aggregator gak bisa tau TO mana.
  if (doc.type === "TRYOUT") {
    if (doc.week == null) throw new Error("TRYOUT wajib ada week");
    if (!doc.subject) throw new Error("TRYOUT wajib ada subject (TO1/TO2)");
  }
});

// ── Compound unique indexes (data integrity) ───────────────
// TUGAS: 1 record per anak didik per pekan per semester.
// Mencegah double-insert kalau koneksi flaky / user double-click save.
NilaiOfflineSchema.index(
  { anakDidikId: 1, type: 1, semester: 1, week: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "TUGAS" },
    name: "uniq_tugas_per_pekan",
  }
);
// UAS: 1 record per anak didik per subject per semester.
// Form UAS loop POST per subject — tanpa index, double-click = duplikat.
NilaiOfflineSchema.index(
  { anakDidikId: 1, type: 1, semester: 1, subject: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "UAS" },
    name: "uniq_uas_per_subject",
  }
);

// ── Query performance indexes ──────────────────────────────
NilaiOfflineSchema.index({ relawanId: 1, semester: 1 });
NilaiOfflineSchema.index({ anakDidikId: 1, semester: 1 });

export const NilaiOffline: Model<INilaiOffline> =
  (mongoose.models.NilaiOffline as Model<INilaiOffline>) ||
  mongoose.model<INilaiOffline>("NilaiOffline", NilaiOfflineSchema);
