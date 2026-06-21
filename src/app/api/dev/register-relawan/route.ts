import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { TeamAccount } from "@/models/TeamAccount";
import { notFoundInProduction } from "../_utils";

export async function POST(request: Request) {
  const productionGuard = notFoundInProduction();
  if (productionGuard) return productionGuard;

  try {
    const { email, password, teamName, region, role } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi" }, { status: 400 });
    }

    await connectDB();

    // Cek apakah email sudah terdaftar
    const existingUser = await TeamAccount.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new TeamAccount({
      email,
      password: hashedPassword,
      teamName: teamName || "Tim GSB Pusat",
      region: region || "Offline Depok",
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
