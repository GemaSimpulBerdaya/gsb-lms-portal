import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IModule extends Document {
  title: string;
  slug: string;
  description?: string;
  programType: "OFFLINE";
  learningLocation?: string;
  fase: string;
  subject?: string;
  week?: number | null;
  month?: number | null;
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
    programType: { type: String, enum: ["OFFLINE"], default: "OFFLINE" },
    learningLocation: { type: String, default: "" },
    fase: { type: String, default: "" },
    // Mata pelajaran
    subject: { type: String, default: "" },
    week: { type: Number, default: null },
    // Bulan target modul (1-12, Jan=1...Des=12). Field baru: dipake form admin
    // untuk meng-organize modul per bulan, terpisah dari `week` legacy yg
    // masih dipake jadwal/attendance/dll.
    month: { type: Number, default: null, min: 1, max: 12 },
    fileUrl: String,
    order: { type: Number, default: 0 },
    semester: { type: String, default: "" },
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
