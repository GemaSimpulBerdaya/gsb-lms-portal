import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { signInternalJWT } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    // 🔒 Validasi input
    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();

    // 🔍 Cari user + ambil password (karena select: false)
    const relawan = await Relawan.findOne({
      email: { $regex: `^${email}$`, $options: "i" }
    }).select("+password");

    console.log("USER DARI DB:", relawan);

    if (!relawan) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 }
      );
    }

    // 🔑 Compare password (bcrypt)
    const isMatch = await bcrypt.compare(password, relawan.password);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 }
      );
    }

    console.log("INPUT PASSWORD:", password);
    console.log("HASH DB:", relawan.password);

    const testCompare = await bcrypt.compare("password123", relawan.password);
    console.log("TEST HARDCODE:", testCompare);

    // 🎟️ Generate JWT
    const token = await signInternalJWT({
      id: relawan._id.toString(),
      role: relawan.role,
      email: relawan.email,
    });
    

    // 📦 Response
    const response = NextResponse.json({
      message: "Login berhasil",
      user: {
        id: relawan._id,
        email: relawan.email,
        role: relawan.role,
        teamName: relawan.teamName,
        region: relawan.region,
      },
    });

    // 🍪 Set cookie
    response.cookies.set("gsb_lms_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 hari
      path: "/",
    });

    return response;
    

  } catch (error) {
    console.error("[POST /api/auth/login]", error);
    return NextResponse.json(
      { error: "Terjadi kesalahan pada server" },
      { status: 500 }
    );
  }
}