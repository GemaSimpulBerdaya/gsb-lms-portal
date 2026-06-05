import mongoose, { Schema, Document, Model, Types } from "mongoose";

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
 * `volunteerId` reference ke `Volunteer` (registry orang) — bukan name string,
 * supaya:
 *   - Pindah tim aman: cukup hapus dari `members[]` Tim A & tambah ke Tim B.
 *   - History `TeamAttendance` tetap konsisten lewat `volunteerId`.
 *   - Rename orang cukup di 1 tempat (Volunteer registry).
 */
export interface IRelawanMember {
  volunteerId: Types.ObjectId;
  role: TeamMemberRole;
  /** Kapan orang ini masuk tim ini. Default = saat di-add. */
  joinedAt: Date;
}

export interface IRelawan extends Document {
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
   * Anggota tim. Tiap akun `Relawan` = 1 tim, members boleh banyak.
   * Aturan:
   *   - 1 orang (`volunteerId`) hanya boleh ada DI SATU TIM aktif pada satu waktu.
   *     Ini DI-ENFORCE di application layer (API), bukan di Mongo unique index,
   *     karena unique compound lintas-dokumen tidak natural di Mongo.
   *   - Saat admin pindahkan orang dari Tim A ke Tim B, API akan: hapus dari A,
   *     tambah ke B (dalam transaction kalau memungkinkan).
   */
  members: Types.DocumentArray<IRelawanMember>;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RelawanMemberSchema = new Schema<IRelawanMember>(
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

const RelawanSchema: Schema<IRelawan> = new Schema(
  {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true, select: false },
    teamName: String,
    region: String,
    name: String,
    role: { type: String, default: "RELAWAN" },
    members: { type: [RelawanMemberSchema], default: [] },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true, collection: "volunteers" }
);

// ── Indexes ─────────────────────────────────────────────────
// Bantu query "tim mana yang punya volunteer X" (untuk validasi pindah tim).
RelawanSchema.index({ "members.volunteerId": 1 });
// Bantu validasi application-layer: 1 lokasi belajar maksimal 1 akun Tim Lokasi.
RelawanSchema.index({ role: 1, region: 1 });

export const Relawan: Model<IRelawan> =
  (mongoose.models.Relawan as Model<IRelawan>) ||
  mongoose.model<IRelawan>("Relawan", RelawanSchema);

// Re-export NilaiOffline dari file baru untuk backward-compat semua import
// yang masih reference `@/models/Relawan`.
export { NilaiOffline } from "./NilaiOffline";
export type { INilaiOffline, IRubricItem } from "./NilaiOffline";
