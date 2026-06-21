import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { TeamAccount } from "@/models/TeamAccount";
import { signInternalJWT } from "@/lib/jwt";
import { enforceRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    // Anti brute-force: 5 percobaan login per IP tiap menit.
    const limited = enforceRateLimit(request, "login", { limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const body = await request.json();
    const email = body.email?.toLowerCase().trim();
    const password = body.password;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email dan password wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();

    const relawan = await TeamAccount.findOne({
      email: email
    }).select("+password");

    if (!relawan) {
      return NextResponse.json(
        { error: "Email atau password salah" },
        { status: 401 }
      );
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, relawan.password);

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