import mongoose from "mongoose";

const ModuleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  description: String,
  category: { type: String, enum: ['SNBT', 'OFFLINE'], required: true },
  subCategory: String, // e.g., 'Matematika', 'Disabilitas', 'TK'
  fileUrl: String,
  order: { type: Number, default: 0 }, // For SMA progression
  prerequisiteModule: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', default: null }
}, { timestamps: true });

export const Module = mongoose.models.Module || mongoose.model("Module", ModuleSchema);
