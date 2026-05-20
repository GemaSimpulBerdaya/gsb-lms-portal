import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IAttendance extends Document {
  relawanId: Types.ObjectId;
  anakDidikId: Types.ObjectId;
  week: number;
  semester: string;
  date: string;
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
    date: { type: String, required: true },
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

export const Attendance: Model<IAttendance> =
  (mongoose.models.Attendance as Model<IAttendance>) ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
