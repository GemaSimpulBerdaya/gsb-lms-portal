import mongoose, { Schema, Document, Model, Types } from "mongoose";

export const TEAM_ACCOUNT_COLLECTION =
  process.env.MONGODB_TEAM_ACCOUNT_COLLECTION || "volunteers";

/**
 * Role anggota di dalam 1 tim. Single-role per slot (bukan multi).
 * Kalau di kemudian hari butuh multi-role, ubah `role` jadi `roles: TeamMemberRole[]`
 * dan migrate datanya.
 */
export type TeamMemberRole =
  | "FASILITATOR"
  | "PENGAJAR"
  | "DOKUMENTASI"
  | "AKADEMIK";

export const TEAM_MEMBER_ROLES: TeamMemberRole[] = [
  "FASILITATOR",
  "PENGAJAR",
  "DOKUMENTASI",
  "AKADEMIK",
];

export function normalizeTeamMemberRole(role: unknown): TeamMemberRole | null {
  if (typeof role !== "string") return null;

  const normalized = role.trim().toUpperCase();
  if (normalized === "FACILITATOR" || normalized === "FASILITATOR") {
    return "FASILITATOR";
  }
  if (normalized === "PENGAJAR") return "PENGAJAR";
  if (normalized === "DOKUMENTASI") return "DOKUMENTASI";
  if (normalized === "AKADEMIK") return "AKADEMIK";

  return null;
}

/**
 * Sub-document: satu anggota tim.
 * `volunteerId` reference ke `Volunteer` (registry orang) - bukan name string,
 * supaya:
 *   - Pindah tim aman: cukup hapus dari `members[]` Tim A & tambah ke Tim B.
 *   - History `TeamAttendance` tetap konsisten lewat `volunteerId`.
 *   - Rename orang cukup di 1 tempat (Volunteer registry).
 */
export interface ITeamAccountMember {
  volunteerId: Types.ObjectId;
  role: TeamMemberRole;
  /** Kapan orang ini masuk tim ini. Default = saat di-add. */
  joinedAt: Date;
}

export interface ITeamAccount extends Document {
  email: string;
  password: string;
  teamName?: string;
  region?: string;
  /**
   * Legacy field: nama yang dulu dipakai sebelum konsep tim.
   * Tetap dipertahankan untuk backward-compat selama migrasi.
   * Setelah migrate selesai, field ini umumnya = nama facilitator.
   */
  name?: string;
  role: string;
  /**
   * Anggota tim. Tiap akun = 1 tim, members boleh banyak.
   * Aturan:
   *   - 1 orang (`volunteerId`) hanya boleh ada DI SATU TIM aktif pada satu waktu.
   *     Ini DI-ENFORCE di application layer (API), bukan di Mongo unique index,
   *     karena unique compound lintas-dokumen tidak natural di Mongo.
   *   - Saat admin pindahkan orang dari Tim A ke Tim B, API akan: hapus dari A,
   *     tambah ke B (dalam transaction kalau memungkinkan).
   */
  members: Types.DocumentArray<ITeamAccountMember>;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const TeamAccountMemberSchema = new Schema<ITeamAccountMember>(
  {
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
    joinedAt: { type: Date, default: () => new Date() },
  },
  { _id: true },
);

const TeamAccountSchema: Schema<ITeamAccount> = new Schema(
  {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true, select: false },
    teamName: String,
    region: String,
    name: String,
    role: { type: String, default: "RELAWAN" },
    members: { type: [TeamAccountMemberSchema], default: [] },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true, collection: TEAM_ACCOUNT_COLLECTION },
);

TeamAccountSchema.index({ "members.volunteerId": 1 });
TeamAccountSchema.index({ role: 1, region: 1 });

export const TeamAccount: Model<ITeamAccount> =
  (mongoose.models.TeamAccount as Model<ITeamAccount>) ||
  mongoose.model<ITeamAccount>(
    "TeamAccount",
    TeamAccountSchema,
    TEAM_ACCOUNT_COLLECTION,
  );


