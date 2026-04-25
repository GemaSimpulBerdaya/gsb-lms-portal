import mongoose from "mongoose";

const RelawanSchema = new mongoose.Schema({
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true }, // Hashed
  teamName: String,
  region: String,
  role: { type: String, default: 'RELAWAN' }
}, { timestamps: true, collection: 'relawan' });

const AnakDidikSchema = new mongoose.Schema({
  name: { type: String, required: true },
  region: String,
  category: { type: String, enum: ['DISABILITAS', 'TK', 'SD', 'SMP'], required: true },
  parentName: String
}, { timestamps: true, collection: 'anak_didik' });

const NilaiOfflineSchema = new mongoose.Schema({
  anakDidikId: { type: mongoose.Schema.Types.ObjectId, ref: 'AnakDidik', required: true },
  relawanId: { type: mongoose.Schema.Types.ObjectId, ref: 'Relawan', required: true },
  moduleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null },
  type: { type: String, enum: ['TUGAS', 'UJIAN', 'KUIS'], required: true },
  week: { type: Number, default: null }, // null untuk UJIAN
  score: { type: Number, required: true, min: 0, max: 100 },
  notes: String,
  semester: { type: String, required: true }, // e.g., '2025-Ganjil'
}, { timestamps: true, collection: 'nilai_offline' });

export const Relawan = mongoose.models.Relawan || mongoose.model("Relawan", RelawanSchema);
export const AnakDidik = mongoose.models.AnakDidik || mongoose.model("AnakDidik", AnakDidikSchema);
export const NilaiOffline = mongoose.models.NilaiOffline || mongoose.model("NilaiOffline", NilaiOfflineSchema);
