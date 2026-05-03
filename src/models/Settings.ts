import mongoose from "mongoose";

const SettingsSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  value: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true, collection: 'settings' });

export const Settings =
  mongoose.models.Settings ||
  mongoose.model("Settings", SettingsSchema, "settings");
