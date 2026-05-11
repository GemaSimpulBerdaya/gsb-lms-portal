import mongoose from "mongoose";

const ScheduleSchema = new mongoose.Schema({
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: "Relawan", required: true },
  region: { type: String, required: true },
  level: {
    type: String,
    required: true
  },
  semester: { type: String, required: true, default: "2024-1" },
  activeWeek: { type: Number, default: 1, min: 1 },
  // Daftar tanggal KBM per pekan (index 0 = pekan 1, dst)
  // Opsional; dipakai untuk Lampiran 1 (Materi & Dokumentasi) pada raport.
  kbmDates: {
    type: [{
      week: { type: Number, required: true },
      date: { type: Date, required: true },
      topic: { type: String, default: "" }, // Materi yang dibahas
      materialLink: { type: String, default: "" },
      documentationLink: { type: String, default: "" },
    }],
    default: [],
  },
}, { timestamps: true, collection: 'jadwal' });

if (mongoose.models.Schedule) {
  delete mongoose.models.Schedule;
}

export const Schedule = mongoose.model("Schedule", ScheduleSchema);
