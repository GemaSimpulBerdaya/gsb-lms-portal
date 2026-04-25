import mongoose from "mongoose";

const ScheduleSchema = new mongoose.Schema({
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: "Relawan", required: true, unique: true },
  region: { type: String, required: true },
  level: { type: String, enum: ["DISABILITAS", "TK", "SD", "SMP"], required: true },
  activeWeek: { type: Number, default: 1, min: 1 },
}, { timestamps: true, collection: 'jadwal' });

export const Schedule = mongoose.models.Schedule || mongoose.model("Schedule", ScheduleSchema);
