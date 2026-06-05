import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IKbmDate {
  week: number;
  date: Date;
  /**
   * Mata pelajaran pertemuan ini. Menggantikan "topik" bebas — diisi dari
   * master data `availableSubjects` (Settings). Field tetap bernama `topic`
   * untuk backward-compat raport Lampiran 1 (zero migration).
   */
  topic?: string;
  materialLink?: string;
  documentationLink?: string;
  /**
   * Petugas yang bertugas di pertemuan ini. Reference ke registry `Volunteer`
   * (sama seperti `Relawan.members.volunteerId`), bukan name string, supaya
   * konsisten dengan TeamAttendance & aman saat orang pindah tim.
   */
  petugas?: Types.ObjectId[];
  // Audit trail: kalau pertemuan pernah di-reschedule
  originalDate?: Date; // tanggal generate awal, baru di-set kalau pernah digeser
  rescheduleReason?: string; // alasan geser (sakit / libur / dst)
  rescheduledAt?: Date; // kapan terakhir digeser
}

export interface ISchedule extends Document {
  relawanId: Types.ObjectId;
  region: string;
  fase: string;
  semester: string;
  activeWeek: number;
  kbmDates: IKbmDate[];
  createdAt: Date;
  updatedAt: Date;
}

const ScheduleSchema: Schema<ISchedule> = new Schema(
  {
    relawanId: { type: Schema.Types.ObjectId, ref: "Relawan", required: true },
    region: { type: String, required: true },
    fase: { type: String, required: true },
    semester: { type: String, required: true, default: "2024-1" },
    activeWeek: { type: Number, default: 1, min: 1 },
    // Daftar tanggal KBM per pekan (index 0 = pekan 1, dst)
    // Opsional; dipakai untuk Lampiran 1 (Materi & Dokumentasi) pada raport.
    kbmDates: {
      type: [
        {
          week: { type: Number, required: true },
          date: { type: Date, required: true },
          topic: { type: String, default: "" },
          materialLink: { type: String, default: "" },
          documentationLink: { type: String, default: "" },
          petugas: {
            type: [{ type: Schema.Types.ObjectId, ref: "Volunteer" }],
            default: [],
          },
          originalDate: { type: Date },
          rescheduleReason: { type: String },
          rescheduledAt: { type: Date },
        },
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "schedules" }
);

export const Schedule: Model<ISchedule> =
  (mongoose.models.Schedule as Model<ISchedule>) ||
  mongoose.model<ISchedule>("Schedule", ScheduleSchema);
