import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Interface untuk TypeScript
 */
export interface IAnakDidik extends Document {
    name: string;
    region: string;
    category: "DISABILITAS" | "TK" | "SD" | "SMP";
    parentName: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Schema MongoDB
 */
const AnakDidikSchema: Schema<IAnakDidik> = new Schema(
    {
        name: {
            type: String,
            required: [true, "Nama wajib diisi"],
            trim: true,
        },
        region: {
            type: String,
            required: [true, "Region wajib diisi"],
        },
        category: {
            type: String,
            enum: ["DISABILITAS", "TK", "SD", "SMP"],
            required: [true, "Kategori wajib diisi"],
        },
        parentName: {
            type: String,
            required: [true, "Nama orang tua wajib diisi"],
            trim: true,
        },
    },
    {
        timestamps: true, // otomatis createdAt & updatedAt
        collection: "anak_didik", // sesuai dengan collection MongoDB kamu
    }
);

/**
 * Prevent overwrite model di Next.js (hot reload)
 */
const AnakDidik: Model<IAnakDidik> =
    mongoose.models.AnakDidik ||
    mongoose.model<IAnakDidik>("AnakDidik", AnakDidikSchema);

export default AnakDidik;