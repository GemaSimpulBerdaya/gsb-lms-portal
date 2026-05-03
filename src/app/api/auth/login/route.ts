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

    console.log("==== DEBUG LOGIN ====");
    console.log("EMAIL INPUT:", email);
    console.log("PASSWORD INPUT:", password);

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();

    const relawan = await Relawan.findOne({
      email: email
    }).select("+password");

    console.log("USER DARI DB:", relawan?.email);
    console.log("HASH DARI DB:", relawan?.password);

    if (!relawan) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 }
      );
    }

    // 🔥 test bcrypt hardcode
    const manualTest = await bcrypt.compare(
      "password123",
      "$2b$10$20YFkAbFLrfv6ZqrCR48mOMBzx.fAJv9.jA7t2ZpKmuf3z3cEyTzS"
    );
    console.log("MANUAL HASH TEST:", manualTest);

    // 🔑 compare password
    const isMatch = await bcrypt.compare(password, relawan.password);
    console.log("COMPARE RESULT:", isMatch);

    if (!isMatch) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 }
      );
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
        name: relawan.name || relawan.teamName || relawan.email.split("@")[0],
        role: relawan.role,
        teamName: relawan.teamName,
        region: relawan.region,
      },
    });

    response.cookies.set("gsb_lms_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
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