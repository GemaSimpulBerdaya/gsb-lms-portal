import mongoose from "mongoose";

const AttendanceSchema = new mongoose.Schema({
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: "Relawan", required: true },
  anakDidikId: { type: mongoose.Schema.Types.ObjectId, ref: "AnakDidik", required: true },
  week: { type: Number, required: true },
  semester: { type: String, required: true },
  date: { type: String, required: true },
  // HADIR | IZIN | SAKIT | ALFA | ASINKRONUS (kelas asinkronus, tidak dihitung absen)
  status: { type: String, enum: ["HADIR", "IZIN", "SAKIT", "ALFA", "ASINKRONUS"], required: true },
  notes: { type: String, default: "" },
}, { timestamps: true, collection: 'absensi' });

// Re-register untuk refresh enum di dev
if (mongoose.models.Attendance) {
  delete mongoose.models.Attendance;
}

export const Attendance = mongoose.model("Attendance", AttendanceSchema);
