import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAttendance extends Document {
  relawanId: Types.ObjectId;
  anakDidikId: Types.ObjectId;
  week: number;
  semester: string;
  /** Tanggal kelas. Stored as Date untuk reliable sorting / range queries. */
  date: Date;
  status: "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS";
  notes: string;
  createdAt: Date;
  updatedAt: Date;
}

const AttendanceSchema: Schema<IAttendance> = new Schema(
  {
    relawanId: { type: Schema.Types.ObjectId, ref: "Relawan", required: true },
    anakDidikId: { type: Schema.Types.ObjectId, ref: "AnakDidik", required: true },
    week: { type: Number, required: true },
    semester: { type: String, required: true },
    date: { type: Date, required: true },
    // HADIR | IZIN | SAKIT | ALFA | ASINKRONUS (kelas asinkronus, tidak dihitung absen)
    status: {
      type: String,
      enum: ["HADIR", "IZIN", "SAKIT", "ALFA", "ASINKRONUS"],
      required: true,
    },
    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: "absensi" }
);

// ── Compound unique: 1 absen per anak didik per pekan per semester per tanggal ──
// Mencegah double-mark absen di pertemuan yang sama (relawan refresh / klik save 2x).
AttendanceSchema.index(
  { anakDidikId: 1, week: 1, semester: 1, date: 1 },
  { unique: true, name: "uniq_attendance_per_pertemuan" }
);

// ── Query indexes ──────────────────────────────────────────
AttendanceSchema.index({ relawanId: 1, semester: 1 });
AttendanceSchema.index({ semester: 1, date: -1 });

export const Attendance: Model<IAttendance> =
  (mongoose.models.Attendance as Model<IAttendance>) ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
