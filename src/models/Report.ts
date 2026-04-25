import mongoose from "mongoose";

const ReportSchema = new mongoose.Schema({
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: "Relawan", required: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  date: { type: Date, required: true },
  photoUrl: String,
  location: String,
}, { timestamps: true, collection: 'laporan' });

export const Report = mongoose.models.Report || mongoose.model("Report", ReportSchema);
