import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { AnakDidik } from "@/models/Relawan";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { students } = body;

    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ error: "Data siswa tidak valid" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    // Filter data yang valid (minimal ada nama dan kategori)
    const validStudents = students.filter(s => s.name && s.category);

    if (validStudents.length === 0) {
      return NextResponse.json({ error: "Tidak ada data siswa valid untuk diimpor" }, { status: 400 });
    }

    // Insert many
    const result = await AnakDidik.insertMany(validStudents);

    return NextResponse.json({ 
      message: `${result.length} data siswa berhasil diimpor`,
      count: result.length 
    });
  } catch (error) {
    console.error("Bulk Create Students Error:", error);
    return NextResponse.json({ error: "Gagal mengimpor data siswa" }, { status: 500 });
  }
}
