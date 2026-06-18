import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IKbmDate {
  week: number;
  date: Date;
  /**
   * Jenis pertemuan. Data lama yang belum punya field ini diperlakukan sebagai
   * KBM oleh UI/API agar tetap backward-compatible.
   */
  meetingType?: string;
  /**
   * Agenda / mata pelajaran pertemuan. Field tetap bernama `topic` untuk
   * backward-compat raport Lampiran 1 (zero migration).
   */
  topic?: string;
  requiresGrades?: boolean;
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
          meetingType: { type: String, default: "KBM" },
          topic: { type: String, default: "" },
          requiresGrades: { type: Boolean, default: true },
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

// Satu tim tidak boleh punya dua jadwal untuk lokasi+jenjang+semester yang sama.
ScheduleSchema.index(
  { relawanId: 1, region: 1, fase: 1, semester: 1 },
  { unique: true, name: "uniq_schedule_team_region_fase_semester" }
);

export const Schedule: Model<ISchedule> =
  (mongoose.models.Schedule as Model<ISchedule>) ||
  mongoose.model<ISchedule>("Schedule", ScheduleSchema);
