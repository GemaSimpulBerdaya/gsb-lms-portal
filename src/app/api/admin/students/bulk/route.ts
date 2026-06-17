import { NextResponse } from "next/server";
import mongoose from "mongoose";
import AnakDidik from "@/models/AnakDidik";
import { withAdmin } from "@/lib/apiAuth";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

const ALLOWED_FIELDS = [
  "name",
  "region",
  "fase",
  "parentName",
  "studentCode",
  "pic",
  "program",
  "gender",
  "birthPlace",
  "birthDate",
  "schoolOrigin",
  "phone",
  "parentPhone",
  "address",
  "profil",
] as const;

type RawStudent = Record<string, unknown>;

function pickAllowed(body: RawStudent) {
  const out: Record<string, unknown> = {};
  for (const f of ALLOWED_FIELDS) {
    const v = body[f];
    if (v === undefined || v === null || v === "") continue;
    // profil: object kosong dianggap tidak ada
    if (f === "profil" && typeof v === "object" && Object.keys(v as object).length === 0) continue;
    out[f] = v;
  }
  return out;
}

export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const { students } = body as { students: RawStudent[] };

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "Data siswa tidak valid" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    // Sanitasi + minimal harus punya name + fase.
    const validStudents = students
      .map(pickAllowed)
      .filter((s) => s.name && s.fase);

    if (validStudents.length === 0) {
      return NextResponse.json(
        { error: "Tidak ada data siswa valid untuk diimpor (butuh minimal Nama + Fase)" },
        { status: 400 }
      );
    }

    // Pisahkan profil agar bisa di-merge (bukan overwrite) per field.
    const toProfilSet = (profil: unknown) => {
      const set: Record<string, unknown> = {};
      if (profil && typeof profil === "object") {
        for (const [k, v] of Object.entries(profil as Record<string, unknown>)) {
          set[`profil.${k}`] = v;
        }
      }
      return set;
    };

    // Upsert by studentCode (No. Induk) bila ada → idempoten, re-import = update.
    // Tanpa studentCode → insert baru (tidak bisa dedup, beri tahu di response).
    const ops = validStudents.map((s) => {
      const { profil, studentCode, ...rest } = s;
      const setFields = { ...rest, ...toProfilSet(profil) };

      if (studentCode) {
        return {
          updateOne: {
            filter: { studentCode },
            update: { $set: { ...setFields, studentCode } },
            upsert: true,
          },
        };
      }
      // Tanpa No. Induk: selalu insert (tidak ada kunci dedup).
      return { insertOne: { document: { ...setFields } } };
    });

    const result = await AnakDidik.bulkWrite(ops, { ordered: false });

    const inserted = (result.insertedCount || 0) + (result.upsertedCount || 0);
    const updated = result.modifiedCount || 0;
    const noCodeCount = validStudents.filter((s) => !s.studentCode).length;

    let message = `Impor selesai: ${inserted} ditambahkan, ${updated} diperbarui`;
    if (noCodeCount > 0) {
      message += `. ${noCodeCount} baris tanpa No. Induk diinput sebagai data baru (tidak bisa dicek duplikat)`;
    }

    return NextResponse.json({
      message,
      inserted,
      updated,
      noCodeCount,
    });
  } catch (error) {
    console.error("Bulk Import Students Error:", error);
    return NextResponse.json({ error: "Gagal mengimpor data siswa" }, { status: 500 });
  }
});
