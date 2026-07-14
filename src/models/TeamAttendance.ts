import mongoose, { Schema, Document, Model, Types } from "mongoose";
import {
  TEAM_MEMBER_ROLES,
  normalizeTeamMemberRole,
  type TeamMemberRole,
} from "./TeamAccount";

/**
 * Status kehadiran tim (anggota relawan).
 * Sengaja disamakan style dengan Attendance siswa biar UI dropdown konsisten.
 */
export type TeamAttendanceStatus = "HADIR" | "IZIN" | "SAKIT" | "ALFA" | "ASINKRONUS";

export const TEAM_ATTENDANCE_STATUSES: TeamAttendanceStatus[] = [
  "HADIR",
  "IZIN",
  "SAKIT",
  "ALFA",
  "ASINKRONUS"
];

/**
 * Audit log: tiap edit dokumen `TeamAttendance` push 1 entry ke `editHistory`
 * sebelum field di-update. Tujuannya supaya admin bisa melihat: siapa pernah
 * ngubah status apa jadi apa dan kapan.
 */
export interface IEditHistoryEntry {
  at: Date;
  /** ObjectId akun tim yang melakukan edit. */
  by: Types.ObjectId;
  prevStatus: TeamAttendanceStatus;
  newStatus: TeamAttendanceStatus;
  prevNotes?: string;
  newNotes?: string;
  /** IP saat edit (dari X-Forwarded-For), max 45 char (IPv6 max). */
  ip?: string;
  /** UA truncated 200 char, untuk forensik kasar. */
  userAgent?: string;
}

const EditHistorySchema = new Schema<IEditHistoryEntry>(
  {
    at: { type: Date, default: () => new Date() },
    by: { type: Schema.Types.ObjectId, ref: "TeamAccount", required: true },
    prevStatus: { type: String, enum: TEAM_ATTENDANCE_STATUSES, required: true },
    newStatus: { type: String, enum: TEAM_ATTENDANCE_STATUSES, required: true },
    prevNotes: { type: String },
    newNotes: { type: String },
    ip: { type: String, maxlength: 45 },
    userAgent: { type: String, maxlength: 200 },
  },
  { _id: false },
);

export interface ITeamAttendance extends Document {
  /** Akun tim yang menaungi pertemuan ini. */
  teamAccountId: Types.ObjectId;
  /** Schedule yang berisi pertemuan ini. */
  scheduleId: Types.ObjectId;
  /** Pekan ke-berapa di dalam schedule. */
  week: number;
  semester: string;
  /** Tanggal pertemuan. Diambil snapshot dari `Schedule.kbmDates[i].date`. */
  date: Date;

  /** Reference ke `Volunteer` (registry orang). Bukan name string. */
  volunteerId: Types.ObjectId;
  /**
   * Role saat pertemuan ini berlangsung. Snapshot dari `TeamAccount.members[i].role`,
   * supaya laporan historis tetap akurat walau role-nya diubah belakangan.
   */
  role: TeamMemberRole;

  status: TeamAttendanceStatus;
  notes: string;

  // ── Audit log (Layer 3 anti-fraud) ───────────────────────────
  /** Akun login yang menyimpan record ini (= akun tim, biasanya facilitator). */
  markedBy: Types.ObjectId;
  markedAt: Date;
  markedFromIp?: string;
  userAgent?: string;
  editHistory: Types.DocumentArray<IEditHistoryEntry>;

  /**
   * True kalau admin pernah mengubah record ini lewat panel admin.
   */
  unlockedByAdmin?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const TeamAttendanceSchema: Schema<ITeamAttendance> = new Schema(
  {
    teamAccountId: { type: Schema.Types.ObjectId, ref: "TeamAccount", required: true },
    scheduleId: {
      type: Schema.Types.ObjectId,
      ref: "Schedule",
      required: true,
    },
    week: { type: Number, required: true },
    semester: { type: String, required: true },
    date: { type: Date, required: true },

    volunteerId: {
      type: Schema.Types.ObjectId,
      ref: "Volunteer",
      required: true,
    },
    role: {
      type: String,
      enum: TEAM_MEMBER_ROLES,
      set: (role: unknown) => normalizeTeamMemberRole(role) ?? role,
      required: true,
    },

    status: {
      type: String,
      enum: TEAM_ATTENDANCE_STATUSES,
      required: true,
      default: "HADIR",
    },
    notes: { type: String, default: "" },

    markedBy: { type: Schema.Types.ObjectId, ref: "TeamAccount", required: true },
    markedAt: { type: Date, default: () => new Date() },
    markedFromIp: { type: String, maxlength: 45 },
    userAgent: { type: String, maxlength: 200 },
    editHistory: { type: [EditHistorySchema], default: [] },

    unlockedByAdmin: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "team_attendances" },
);

// ── Compound unique: 1 record per anggota per pertemuan ─────────
// Mencegah double-mark kalau facilitator klik save 2x. Di endpoint pakai
// upsert by query yang sama, supaya retry idempotent.
TeamAttendanceSchema.index(
  { volunteerId: 1, scheduleId: 1, week: 1, date: 1 },
  { unique: true, name: "uniq_team_attendance_per_pertemuan_per_anggota" },
);

// ── Query indexes ───────────────────────────────────────────────
// Lifetime query per orang lintas tim (dipakai di /admin/volunteers/[id]/history).
TeamAttendanceSchema.index({ volunteerId: 1, semester: 1, date: -1 });
// Filter tim per semester (dipakai di dashboard tim).
TeamAttendanceSchema.index({ teamAccountId: 1, semester: 1, date: -1 });
// Anomaly query: cari yang `markedAt - date > 24h` butuh range scan; pakai
// composite index ini untuk speed up.
TeamAttendanceSchema.index({ semester: 1, markedAt: -1 });

export const TeamAttendance: Model<ITeamAttendance> =
  (mongoose.models.TeamAttendance as Model<ITeamAttendance>) ||
  mongoose.model<ITeamAttendance>("TeamAttendance", TeamAttendanceSchema);
