import mongoose, { Schema, Document, Model } from "mongoose";

/**
 * Interface untuk TypeScript
 */
export interface IStudent extends Document {
    // Core identity
    name: string;
    region: string;
    fase: string;
    parentName?: string; // rapor GSB tidak mencantumkan nama ortu — optional

    // Data dari Excel (import)
    studentCode?: string; // "No. Induk" dari Excel, mis. "2526001" — KUNCI dedup & relasi sheet penilaian
    pic?: string; // Nama relawan PIC sesuai Excel

    // Data tambahan untuk raport (manual input admin / dari form)
    gender?: "Laki-laki" | "Perempuan";
    birthPlace?: string;
    birthDate?: Date;
    schoolOrigin?: string;
    phone?: string; // No. WhatsApp siswa
    parentPhone?: string; // No. HP orang tua/wali (kepisah dari phone)
    email?: string;
    address?: string;
    program?: string; // "Pilih Program yang Akan Diikuti" dari form

    // Data survei lengkap dari Google Form intake (dipakai di menu Direktori).
    // Disimpan apa adanya (key camelCase dari studentImportMapping.ts) — bentuknya
    // fleksibel (Mixed) supaya field survei baru tidak perlu migrasi schema.
    profil?: Record<string, unknown>;

    createdAt: Date;
    updatedAt: Date;
}

/**
 * Schema MongoDB
 */
const StudentSchema: Schema<IStudent> = new Schema(
    {
        name: {
            type: String,
            required: [true, "Nama wajib diisi"],
            trim: true,
        },
        region: {
            type: String,
            required: [true, "Lokasi Belajar wajib diisi"],
        },
        fase: {
            type: String,
            required: [true, "Fase wajib diisi"],
        },
        parentName: {
            type: String,
            trim: true,
        },

        // ── Data Excel ─────────────────────────────────────────
        studentCode: { type: String, trim: true, index: true },
        pic: { type: String, trim: true },

        // ── Data tambahan untuk raport ─────────────────────────
        gender: { type: String, enum: ["Laki-laki", "Perempuan"] },
        birthPlace: { type: String, trim: true },
        birthDate: { type: Date },
        schoolOrigin: { type: String, trim: true },
        phone: { type: String, trim: true },
        parentPhone: { type: String, trim: true },
        email: { type: String, trim: true },
        address: { type: String, trim: true },
        program: { type: String, trim: true },

        // ── Data survei lengkap (Direktori) ────────────────────
        // Mixed: simpan mentah dari form, key bebas mengikuti mapper.
        profil: { type: Schema.Types.Mixed, default: undefined },
    },
    {
        timestamps: true, // otomatis createdAt & updatedAt
        collection: "students", // sesuai dengan collection MongoDB kamu
    }
);

/**
 * Prevent overwrite model di Next.js (hot reload)
 */
const Student: Model<IStudent> =
    (mongoose.models.Student as Model<IStudent>) ||
    mongoose.model<IStudent>("Student", StudentSchema);

export default Student;
