import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema({
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: "Relawan", required: true },
  anakDidikId: { type: mongoose.Schema.Types.ObjectId, ref: "AnakDidik", required: true },
  week: { type: Number, required: true },
  semester: { type: String, required: true },
  status: { type: String, enum: ["HADIR", "IZIN", "SAKIT", "ALFA"], required: true },
  notes: { type: String, default: "" },
  date: { type: Date, default: Date.now },
}, { timestamps: true, collection: 'absensi' });

export const Attendance = mongoose.models.Attendance || mongoose.model("Attendance", AttendanceSchema);
