import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";

export async function POST(request: Request) {
  // Hanya aktif di development untuk keamanan
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { email, password, teamName, region, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    await connectDB();

    // Cek apakah email sudah terdaftar
    const existingUser = await Relawan.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new Relawan({
      email,
      password: hashedPassword,
      teamName: teamName || "Tim GSB Pusat",
      region: region || "Jakarta",
      role: role || "RELAWAN",
    });

    await newUser.save();

    return NextResponse.json({ 
      message: "User berhasil dibuat", 
      user: { email, teamName, region, role } 
    });
  } catch (error) {
    console.error("[DEV REGISTER ERROR]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
