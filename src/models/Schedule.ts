import mongoose, { Schema, Document, Model, Types } from "mongoose";

export interface IKbmDate {
  week: number;
  date: Date;
  topic?: string;
  materialLink?: string;
  documentationLink?: string;
}

export interface ISchedule extends Document {
  relawanId: Types.ObjectId;
  region: string;
  level: string;
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
    level: { type: String, required: true },
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
        },
      ],
      default: [],
    },
  },
  { timestamps: true, collection: "jadwal" }
);

export const Schedule: Model<ISchedule> =
  (mongoose.models.Schedule as Model<ISchedule>) ||
  mongoose.model<ISchedule>("Schedule", ScheduleSchema);
