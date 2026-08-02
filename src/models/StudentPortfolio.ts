import mongoose, { Schema, Document, Model, Types } from "mongoose";
import "./TeamAccount";

/**
 * StudentPortfolio = KARYA siswa per pertemuan KBM.
 *
 * Dipakai untuk Lampiran "Portofolio Siswa" di raport (Bagian 04 lanjutan,
 * section "Karya Siswa"). Untuk DOKUMENTASI KBM (foto kelas), gunakan koleksi
 * `reports` (model `Report`) yang sudah ada — scope-nya per schedule, bukan
 * per siswa, sehingga 1 foto tidak duplikat di tiap rapor.
 *
 * Storage policy:
 *  - Write baru: foto kamera/galeri di UploadThing
 *    → `storageType = "UPLOADTHING"`, `fileUrl` = URL.
 *  - Data lama dengan `EXTERNAL_LINK` tetap didukung untuk backward compatibility.
 *
 * Kontrak penting:
 *  - Setiap entry milik 1 anak didik (`studentId`) dan 1 jadwal (`scheduleId`),
 *    di-scope per `semester` supaya rapor selalu ambil periode yang benar.
 *  - `week` & `date` opsional: relawan bisa input karya "global semester"
 *    tanpa terikat pertemuan tertentu (mis. proyek akhir).
 */
export interface IStudentPortfolio extends Document {
  studentId: Types.ObjectId;
  scheduleId: Types.ObjectId;
  teamAccountId: Types.ObjectId;
  semester: string;
  region: string;
  fase: string;

  title: string;
  description?: string;

  // Storage agnostic fields
  storageType: "EXTERNAL_LINK" | "CLOUDINARY" | "S3" | "UPLOADTHING";
  fileUrl: string;
  fileUrls: string[];
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
    studentId: {
      type: Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      index: true,
    },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
      index: true,
    },
    teamAccountId: {
      type: Schema.Types.ObjectId,
      ref: "TeamAccount",
      required: true,
      index: true,
    },
    semester: { type: String, required: true, index: true },
    region: { type: String, required: true },
    fase: { type: String, required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    storageType: {
      type: String,
      enum: ["EXTERNAL_LINK", "CLOUDINARY", "S3", "UPLOADTHING"],
      default: "EXTERNAL_LINK",
      required: true,
    },
    fileUrl: { type: String, required: true, trim: true },
    fileUrls: { type: [String], default: [] },
    thumbnailUrl: { type: String, trim: true },
    mimeHint: { type: String, trim: true },

    week: { type: Number, min: 1 },
    date: { type: Date },
  },
  {
    timestamps: true,
    collection: "student_portfolios",
  }
);

// Composite index untuk query raport (per siswa per semester sort by date)
StudentPortfolioSchema.index({ studentId: 1, semester: 1, date: -1 });
// Untuk listing volunteer
StudentPortfolioSchema.index({ teamAccountId: 1, semester: 1 });

const StudentPortfolio: Model<IStudentPortfolio> =
  mongoose.models.StudentPortfolio ||
  mongoose.model<IStudentPortfolio>(
    "StudentPortfolio",
    StudentPortfolioSchema
  );

export default StudentPortfolio;
