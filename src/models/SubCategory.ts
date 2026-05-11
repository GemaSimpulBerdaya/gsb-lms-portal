import mongoose from "mongoose";

const SubCategorySchema = new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, enum: ['SNBT', 'OFFLINE'], required: true },
  parentLabel: { type: String, default: "" }, // Misal: "Sekolah Dasar (SD)"
  order: { type: Number, default: 0 }
}, { timestamps: true, collection: 'subcategories' });

// Ensure unique combination of name and type
SubCategorySchema.index({ name: 1, type: 1 }, { unique: true });

export const SubCategory = mongoose.models.SubCategory || mongoose.model("SubCategory", SubCategorySchema);
