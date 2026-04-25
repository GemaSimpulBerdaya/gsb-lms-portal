import mongoose from "mongoose";

const ModuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  description: String,
  category: { type: String, enum: ['SNBT', 'OFFLINE'], required: true },
  subCategory: { type: String, enum: ['DISABILITAS', 'TK', 'SD', 'SMP', 'Matematika', 'IPA', 'IPS', 'Bahasa Indonesia', 'Bahasa Inggris'] },
  week: { type: Number, default: null }, // Minggu ke-N, khusus modul OFFLINE
  fileUrl: String,
  order: { type: Number, default: 0 },
  prerequisiteModule: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null }
}, { timestamps: true, collection: 'modul' });

export const Module = mongoose.models.Module || mongoose.model("Module", ModuleSchema);
