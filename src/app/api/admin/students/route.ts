import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { AnakDidik } from "@/models/Relawan";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

export async function GET() {
  try {
    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    // Ambil semua anak didik, urutkan berdasarkan yang terbaru
    const students = await AnakDidik.find({}).sort({ createdAt: -1 });

    return NextResponse.json({ students });
  } catch (error) {
    console.error("Fetch Students Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data anak didik" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, region, category, parentName } = body;

    if (!name || !category) {
      return NextResponse.json({ error: "Nama dan Kategori wajib diisi" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const newStudent = new AnakDidik({
      name,
      region,
      category,
      parentName
    });

    await newStudent.save();

    return NextResponse.json({ message: "Anak didik berhasil ditambahkan", student: newStudent });
  } catch (error) {
    console.error("Create Student Error:", error);
    return NextResponse.json({ error: "Gagal menambah anak didik" }, { status: 500 });
  }
}
