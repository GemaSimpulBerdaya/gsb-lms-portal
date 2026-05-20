import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IReport extends Document {
  relawanId: Types.ObjectId;
  scheduleId?: Types.ObjectId;
  region?: string;
  level?: string;
  title: string;
  description: string;
  date: Date;
  semester?: string;
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
    semester: { type: String, required: false },
    photoUrl: String,
    photoUrls: { type: [String], default: [] },
    location: String,
  },
  { timestamps: true, collection: "reports" }
);

export const Report: Model<IReport> =
  (mongoose.models.Report as Model<IReport>) ||
  mongoose.model<IReport>("Report", ReportSchema, "reports");
