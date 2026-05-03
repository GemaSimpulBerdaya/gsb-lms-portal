import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { Relawan } from "@/models/Relawan";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

export async function GET() {
  try {
    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(MONGODB_URI);
    }

    // Ambil semua relawan, urutkan berdasarkan yang terbaru
    const volunteers = await Relawan.find({ role: "RELAWAN" }).sort({ createdAt: -1 });

    return NextResponse.json({ volunteers });
  } catch (error) {
    console.error("Fetch Volunteers Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data relawan" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, teamName, region, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan Password wajib diisi" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    // Cek apakah email sudah ada
    const existing = await Relawan.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
    }

    // Create new volunteer
    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);

    const newVolunteer = new Relawan({
      name,
      email,
      password: hashedPassword,
      teamName,
      region,
      role: "RELAWAN"
    });

    await newVolunteer.save();

    return NextResponse.json({ message: "Relawan berhasil ditambahkan", volunteer: newVolunteer });
  } catch (error) {
    console.error("Create Volunteer Error:", error);
    return NextResponse.json({ error: "Gagal menambah relawan" }, { status: 500 });
  }
}
