import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Interface untuk TypeScript
 */
export interface IAnakDidik extends Document {
    // Core identity
    name: string;
    region: string;
    category: string;
    parentName: string;

    // Data dari Excel (import)
    studentCode?: string; // "No. Induk" dari Excel, mis. "2526001"
    kodeKelas?: string; // "Kode" dari Excel: S-0FD | S-OFB | S-ONR | S-ONS
    pic?: string; // Nama relawan PIC sesuai Excel

    // Data tambahan untuk raport (manual input admin)
    gender?: "Laki-laki" | "Perempuan";
    birthPlace?: string;
    birthDate?: Date;
    schoolOrigin?: string;
    phone?: string;
    address?: string;

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
            required: [true, "Kategori wajib diisi"],
        },
        parentName: {
            type: String,
            required: [true, "Nama orang tua wajib diisi"],
            trim: true,
        },

        // ── Data Excel ─────────────────────────────────────────
        studentCode: { type: String, trim: true, index: true },
        kodeKelas: { type: String, trim: true },
        pic: { type: String, trim: true },

        // ── Data tambahan untuk raport ─────────────────────────
        gender: { type: String, enum: ["Laki-laki", "Perempuan"] },
        birthPlace: { type: String, trim: true },
        birthDate: { type: Date },
        schoolOrigin: { type: String, trim: true },
        phone: { type: String, trim: true },
        address: { type: String, trim: true },
    },
    {
        timestamps: true, // otomatis createdAt & updatedAt
        collection: "anak_didik", // sesuai dengan collection MongoDB kamu
    }
);

/**
 * Prevent overwrite model di Next.js (hot reload)
 */
// Paksa hapus model lama jika ada (untuk refresh skema tanpa enum)
if (mongoose.models.AnakDidik) {
    delete mongoose.models.AnakDidik;
}

const AnakDidik: Model<IAnakDidik> = mongoose.model<IAnakDidik>("AnakDidik", AnakDidikSchema);

export default AnakDidik;
