import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { signInternalJWT } from "@/lib/jwt";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    await connectDB();

    const relawan = await Relawan.findOne({ email }).select("+password");
    if (!relawan) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    const isMatch = await bcrypt.compare(password, relawan.password);
    if (!isMatch) {
      return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
    }

    const token = await signInternalJWT({
      id: relawan._id.toString(),
      role: relawan.role,
      email: relawan.email,
    });

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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
