import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema({
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: "Relawan", required: true },
  scheduleId: { type: mongoose.Schema.Types.ObjectId, ref: "Schedule", required: false },
  region: { type: String, required: false },
  level: { type: String, required: false },
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  photoUrl: String,
  location: String,
}, { timestamps: true, collection: 'reports' });

export const Report =
  mongoose.models.Report ||
  mongoose.model("Report", ReportSchema, "reports");