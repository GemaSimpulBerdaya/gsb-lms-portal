import mongoose, { Schema, Document, Model, Types } from "mongoose";

/**
 * StudentPortfolio = KARYA siswa per pertemuan KBM.
 *
 * Dipakai untuk Lampiran "Portofolio Siswa" di raport (Bagian 04 lanjutan,
 * section "Karya Siswa"). Untuk DOKUMENTASI KBM (foto kelas), gunakan koleksi
 * `reports` (model `Report`) yang sudah ada — scope-nya per schedule, bukan
 * per siswa, sehingga 1 foto tidak duplikat di tiap rapor.
 *
 * Storage policy (Mei 2026):
 *  - Sekarang: relawan paste LINK EKSTERNAL (Drive, Photos, dst.)
 *    → `storageType = "EXTERNAL_LINK"`, `fileUrl` = URL.
 *  - Nanti (jika perlu): tambah handler `CLOUDINARY` / `S3` tanpa ubah schema.
 *
 * Kontrak penting:
 *  - Setiap entry milik 1 anak didik (`anakDidikId`) dan 1 jadwal (`scheduleId`),
 *    di-scope per `semester` supaya rapor selalu ambil periode yang benar.
 *  - `week` & `date` opsional: relawan bisa input karya "global semester"
 *    tanpa terikat pertemuan tertentu (mis. proyek akhir).
 */
export interface IStudentPortfolio extends Document {
  anakDidikId: Types.ObjectId;
  scheduleId: Types.ObjectId;
  relawanId: Types.ObjectId;
  semester: string;
  region: string;
  level: string;

  title: string;
  description?: string;

  // Storage agnostic fields
  storageType: "EXTERNAL_LINK" | "CLOUDINARY" | "S3";
  fileUrl: string;
  thumbnailUrl?: string;
  mimeHint?: string; // image/jpeg, video/mp4, application/pdf — untuk render preview

  // Optional kontekstual KBM
  week?: number;
  date?: Date;

  createdAt: Date;
  updatedAt: Date;
}

const StudentPortfolioSchema: Schema<IStudentPortfolio> = new Schema(
  {
    anakDidikId: {
      type: Schema.Types.ObjectId,
      ref: "AnakDidik",
      required: true,
      index: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
      index: true,
    },
    relawanId: {
      type: Schema.Types.ObjectId,
      ref: "Relawan",
      required: true,
      index: true,
    },
    semester: { type: String, required: true, index: true },
    region: { type: String, required: true },
    level: { type: String, required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    storageType: {
      type: String,
      enum: ["EXTERNAL_LINK", "CLOUDINARY", "S3"],
      default: "EXTERNAL_LINK",
      required: true,
    },
    fileUrl: { type: String, required: true, trim: true },
    thumbnailUrl: { type: String, trim: true },
    mimeHint: { type: String, trim: true },

    week: { type: Number, min: 1 },
    date: { type: Date },
  },
  {
    timestamps: true,
    collection: "student_portfolio",
  }
);

// Composite index untuk query raport (per siswa per semester sort by date)
StudentPortfolioSchema.index({ anakDidikId: 1, semester: 1, date: -1 });
// Untuk listing volunteer
StudentPortfolioSchema.index({ relawanId: 1, semester: 1 });

const StudentPortfolio: Model<IStudentPortfolio> =
  mongoose.models.StudentPortfolio ||
  mongoose.model<IStudentPortfolio>(
    "StudentPortfolio",
    StudentPortfolioSchema
  );

export default StudentPortfolio;
