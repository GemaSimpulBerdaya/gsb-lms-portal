import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISubCategory extends Document {
  name: string;
  type: "SNBT" | "OFFLINE";
  parentLabel: string;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

const SubCategorySchema: Schema<ISubCategory> = new Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ["SNBT", "OFFLINE"], required: true },
    parentLabel: { type: String, default: "" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true, collection: "subcategories" }
);

// Ensure unique combination of name and type
SubCategorySchema.index({ name: 1, type: 1 }, { unique: true });

export const SubCategory: Model<ISubCategory> =
  (mongoose.models.SubCategory as Model<ISubCategory>) ||
  mongoose.model<ISubCategory>("SubCategory", SubCategorySchema);
