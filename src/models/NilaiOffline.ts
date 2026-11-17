import mongoose, { Schema, Document, Model, Types } from "mongoose";
import "./TeamAccount";

/**
 * NilaiOffline = nilai akademik per anak didik per evaluasi.
 *
 * Type:
 *  - TUGAS       = nilai KBM pekanan reguler (3 skor: Konsep, Kuis, Sikap; pakai `week`)
 *  - UAS         = Ujian Akhir Semester (pakai `subject` + `maxScore` + opsional rubrik)
 * Catatan: legacy types (UJIAN, KUIS, UTS) sudah dihapus Mei 2026.
 */
export interface IRubricItem {
  criterion: string;
  score: number;
  maxScore: number;
}

export interface INilaiOffline extends Document {
  studentId: Types.ObjectId;
  teamAccountId: Types.ObjectId;
  moduleId?: Types.ObjectId | null;
  /**
   * Jadwal asal nilai (Juli 2026). Dipakai server untuk memvalidasi konteks
   * pertemuan saat edit tanpa harus percaya scheduleId kiriman client.
   * Nullable untuk record legacy (pra-Juli 2026) — di-backfill saat PUT pertama.
   */
  scheduleId?: Types.ObjectId | null;
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
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    teamAccountId: { type: Schema.Types.ObjectId, ref: "TeamAccount", required: true },
    moduleId: { type: Schema.Types.ObjectId, ref: "Module", default: null },
    scheduleId: { type: Schema.Types.ObjectId, ref: "Schedule", default: null },
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

});

// ── Compound unique indexes (data integrity) ───────────────
// TUGAS: 1 record per anak didik per pekan per semester.
// Mencegah double-insert kalau koneksi flaky / user double-click save.
NilaiOfflineSchema.index(
  { studentId: 1, type: 1, semester: 1, week: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "TUGAS" },
    name: "uniq_tugas_per_pekan",
  }
);
// UAS: 1 record per anak didik per subject per semester.
// Form UAS loop POST per subject — tanpa index, double-click = duplikat.
NilaiOfflineSchema.index(
  { studentId: 1, type: 1, semester: 1, subject: 1 },
  {
    unique: true,
    partialFilterExpression: { type: "UAS" },
    name: "uniq_uas_per_subject",
  }
);

// ── Query performance indexes ──────────────────────────────
NilaiOfflineSchema.index({ teamAccountId: 1, semester: 1 });
NilaiOfflineSchema.index({ studentId: 1, semester: 1 });

export const NilaiOffline: Model<INilaiOffline> =
  (mongoose.models.NilaiOffline as Model<INilaiOffline>) ||
  mongoose.model<INilaiOffline>("NilaiOffline", NilaiOfflineSchema);
