import mongoose from "mongoose";

const ModuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  description: String,
  category: { type: String, enum: ['SNBT', 'OFFLINE'], required: true },
  subCategory: { type: String, default: "" },
  week: { type: Number, default: null }, // Minggu ke-N, khusus modul OFFLINE
  fileUrl: String,
  order: { type: Number, default: 0 },
  semester: { type: String, default: '2025-1' },
  prerequisiteModule: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null }
}, { timestamps: true, collection: 'modul' });

if (mongoose.models.Module) {
  delete (mongoose.models as any).Module;
}
export const Module = mongoose.model("Module", ModuleSchema);
