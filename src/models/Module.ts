import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IModule extends Document {
  title: string;
  slug: string;
  description?: string;
  programType: "SNBT" | "OFFLINE";
  fase: string;
  subCategoryId?: Types.ObjectId | null;
  week?: number | null;
  fileUrl?: string;
  order: number;
  semester: string;
  prerequisiteModule?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const ModuleSchema: Schema<IModule> = new Schema(
  {
    title: { type: String, required: true },
    slug: { type: String, unique: true, required: true },
    description: String,
    programType: { type: String, enum: ["SNBT", "OFFLINE"], required: true },
    // Untuk modul OFFLINE: nama fase (mis. "FASE A"). Validasi value dari `faseConfig` di API.
    // Untuk modul SNBT: kosong.
    fase: { type: String, default: "" },
    // Hanya untuk modul SNBT: referensi ke koleksi SubCategory
    subCategoryId: { type: Schema.Types.ObjectId, ref: "SubCategory", default: null },
    week: { type: Number, default: null },
    fileUrl: String,
    order: { type: Number, default: 0 },
    semester: { type: String, default: "2025-1" },
    prerequisiteModule: {
      type: Schema.Types.ObjectId,
      ref: "Module",
      default: null,
    },
  },
  { timestamps: true, collection: "modules" }
);

export const Module: Model<IModule> =
  (mongoose.models.Module as Model<IModule>) ||
  mongoose.model<IModule>("Module", ModuleSchema);
