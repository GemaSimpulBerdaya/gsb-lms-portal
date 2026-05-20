import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * NilaiOffline = nilai akademik per anak didik per evaluasi.
 *
 * Type:
 *  - TUGAS = nilai KBM pekanan (3 skor: Konsep, Kuis, Sikap; pakai `week`)
 *  - UAS   = Ujian Akhir Semester (pakai `subject` + `maxScore` + opsional rubrik)
 *
 * Catatan: legacy types (UJIAN, KUIS, UTS, TRYOUT) sudah dihapus dari sistem
 * Mei 2026 beserta data dummy-nya.
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
  type: "TUGAS" | "UAS";
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
      enum: ["TUGAS", "UAS"],
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
  { timestamps: true, collection: "nilai_offline" }
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
