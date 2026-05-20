import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IReport extends Document {
  relawanId: Types.ObjectId;
  scheduleId?: Types.ObjectId;
  region?: string;
  level?: string;
  title: string;
  description: string;
  date: Date;
  semester: string;
  /** Legacy single-photo (data URL atau URL eksternal). Backward-compat. */
  photoUrl?: string;
  /** Foto bukti, bisa lebih dari satu. Source of truth untuk write baru. */
  photoUrls: string[];
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema: Schema<IReport> = new Schema(
  {
    relawanId: { type: Schema.Types.ObjectId, ref: "Relawan", required: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: "Schedule", required: false },
    region: { type: String, required: false },
    level: { type: String, required: false },
    title: { type: String, required: true },
    description: { type: String, required: true },
    date: { type: Date, required: true },
    // Wajib diisi supaya laporan selalu bisa di-scope ke periode yang benar
    // dan tidak lolos pengecekan `closedSemesters`.
    semester: { type: String, required: true },
    photoUrl: String,
    photoUrls: { type: [String], default: [] },
    location: String,
  },
  { timestamps: true, collection: "reports" }
);

// ── Query indexes ──────────────────────────────────────────
ReportSchema.index({ relawanId: 1, semester: 1, date: -1 });
ReportSchema.index({ semester: 1, date: -1 });

export const Report: Model<IReport> =
  (mongoose.models.Report as Model<IReport>) ||
  mongoose.model<IReport>("Report", ReportSchema, "reports");
