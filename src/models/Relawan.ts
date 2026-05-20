import mongoose, { Schema, Document, Model } from "mongoose";

export interface IRelawan extends Document {
  email: string;
  password: string;
  teamName?: string;
  region?: string;
  name?: string;
  role: string;
  resetToken?: string;
  resetTokenExpiry?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const RelawanSchema: Schema<IRelawan> = new Schema(
  {
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true, select: false },
    teamName: String,
    region: String,
    name: String,
    role: { type: String, default: "RELAWAN" },
    resetToken: { type: String },
    resetTokenExpiry: { type: Date },
  },
  { timestamps: true, collection: "relawans" }
);

export const Relawan: Model<IRelawan> =
  (mongoose.models.Relawan as Model<IRelawan>) ||
  mongoose.model<IRelawan>("Relawan", RelawanSchema);

// Re-export NilaiOffline dari file baru untuk backward-compat semua import
// yang masih reference `@/models/Relawan`.
export { NilaiOffline } from "./NilaiOffline";
export type { INilaiOffline, IRubricItem } from "./NilaiOffline";
