import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * MateriAjar — bahan ajar (PPT/PDF) untuk RELAWAN ngajar di kelas.
 * Beda dari `Module` (yg dibaca SISWA via student portal).
 *
 * Relasi ke Modul:
 *   Tidak nempel ke modul spesifik. Materi nempel ke kombinasi
 *   programType + learningLocation + fase + subject + week + semester.
 *   Pas relawan ngajar modul tertentu, FE bisa cocokin materi yg cocok
 *   berdasar kombinasi itu (1 PPT bisa kepake di banyak modul yg metadatanya sama).
 */
export interface IMateriAjar extends Document {
  title: string;
  description?: string;
  fileUrl: string;
  programType: "SNBT" | "OFFLINE";
  learningLocation?: string;
  fase: string;
  subject: string;
  week?: number | null;
  month?: number | null;
  semester: string;
  uploadedBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MateriAjarSchema: Schema<IMateriAjar> = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    fileUrl: { type: String, required: true },
    programType: { type: String, enum: ["SNBT", "OFFLINE"], required: true },
    learningLocation: { type: String, default: "" },
    fase: { type: String, default: "" },
    subject: { type: String, default: "" },
    week: { type: Number, default: null },
    month: { type: Number, default: null, min: 1, max: 12 },
    semester: { type: String, default: "" },
    uploadedBy: { type: String, default: "" },
  },
  { timestamps: true, collection: "materi_ajar" }
);

// Index untuk pencarian cepat berdasar metadata kombinasi
MateriAjarSchema.index({
  programType: 1,
  learningLocation: 1,
  fase: 1,
  subject: 1,
  week: 1,
  semester: 1,
});

export const MateriAjar: Model<IMateriAjar> =
  (mongoose.models.MateriAjar as Model<IMateriAjar>) ||
  mongoose.model<IMateriAjar>("MateriAjar", MateriAjarSchema);
