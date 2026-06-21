import mongoose, { Schema, Document, Model, Types } from "mongoose";
import "./TeamAccount";

export interface IAttendance extends Document {
  teamAccountId: Types.ObjectId;
  /** Schedule yang berisi pertemuan ini. Optional untuk data lama. */
  scheduleId?: Types.ObjectId;
  studentId: Types.ObjectId;
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
    teamAccountId: { type: Schema.Types.ObjectId, ref: "TeamAccount", required: true },
    scheduleId: { type: Schema.Types.ObjectId, ref: "Schedule", required: false },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
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
  { timestamps: true, collection: "attendances" }
);

// ── Compound unique: 1 absen per anak didik per pekan per semester per tanggal ──
// Mencegah double-mark absen di pertemuan yang sama (relawan refresh / klik save 2x).
AttendanceSchema.index(
  { studentId: 1, scheduleId: 1, week: 1, semester: 1, date: 1 },
  {
    unique: true,
    name: "uniq_attendance_per_schedule_per_pertemuan",
    partialFilterExpression: { scheduleId: { $exists: true } },
  }
);

// ── Query indexes ──────────────────────────────────────────
AttendanceSchema.index({ teamAccountId: 1, semester: 1 });
AttendanceSchema.index({ scheduleId: 1, semester: 1, week: 1, date: 1 });
AttendanceSchema.index({ semester: 1, date: -1 });

export const Attendance: Model<IAttendance> =
  (mongoose.models.Attendance as Model<IAttendance>) ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
