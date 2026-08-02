import mongoose, { Schema, Document, Model } from "mongoose";

export const VOLUNTEER_COLLECTION =
  process.env.MONGODB_VOLUNTEER_COLLECTION || "volunteers";

/**
 * Volunteer (registry orang)
 * --------------------------
 * Beda dengan `TeamAccount` (akun login per TIM):
 *   - `TeamAccount` = AKUN tim (email/password, region, teamName, members[])
 *   - `Volunteer` = ORANG individu, lintas tim, lintas semester
 *
 * Member di tim refer ke `_id` collection ini (lihat `TeamAccount.members.volunteerId`).
 * History kehadiran tim disimpan di `TeamAttendance` dengan `volunteerId` reference,
 * jadi kalau orang pindah tim, riwayat tetap konsisten dan dapat di-query lifetime.
 *
 * Kenapa pisah dari `TeamAccount`?
 *   1. Akun login tetap "1 akun = 1 tim" (sederhana untuk facilitator-led flow).
 *   2. Orang bisa pindah tim tanpa rename + tanpa perlu reset password.
 *   3. Reporting lifetime per orang → query by volunteerId, bukan name string.
 */
export interface IVolunteer extends Document {
  name: string;
  /** Nomor HP / WA, optional. Format bebas (admin yang isi). */
  phone?: string;
  /** Email kontak personal (BEDA dari email login akun tim). Optional. */
  email?: string;
  /** Tahun pertama jadi relawan, untuk cohort tracking. */
  joinedYear?: number;
  assignmentRegion?: string;
  assignmentRole?: string;
  assignmentFase?: string;
  assignmentWeek?: string;
  /** false = alumni / tidak aktif. Tidak dihapus supaya history aman. */
  isActive: boolean;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VolunteerSchema: Schema<IVolunteer> = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    joinedYear: { type: Number },
    assignmentRegion: { type: String, trim: true },
    assignmentRole: { type: String, trim: true },
    assignmentFase: { type: String, trim: true },
    assignmentWeek: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
  },
  { timestamps: true, collection: VOLUNTEER_COLLECTION },
);

// ── Indexes ─────────────────────────────────────────────────
// Pencarian by name (case-insensitive). Collation ci ditangani di query level.
VolunteerSchema.index({ name: 1 });
VolunteerSchema.index({ isActive: 1, name: 1 });
// Email opsional, tapi kalau diisi sebaiknya unik. Pakai sparse index supaya
// banyak dokumen tanpa email tidak konflik di unique constraint.
VolunteerSchema.index(
  { email: 1 },
  { unique: true, sparse: true, name: "uniq_volunteer_email_sparse" },
);

export const Volunteer: Model<IVolunteer> =
  (mongoose.models.Volunteer as Model<IVolunteer>) ||
  mongoose.model<IVolunteer>("Volunteer", VolunteerSchema);
