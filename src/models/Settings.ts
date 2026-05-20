import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISettings extends Document {
  key: string;
  /** Mixed value — bentuk tergantung key. faseConfig untuk key='faseConfig', dst.
   *  Pakai `any` (bukan `unknown`) supaya consumer tidak harus narrow di setiap call. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema: Schema<ISettings> = new Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true, collection: "settings" }
);

export const Settings: Model<ISettings> =
  (mongoose.models.Settings as Model<ISettings>) ||
  mongoose.model<ISettings>("Settings", SettingsSchema, "settings");
