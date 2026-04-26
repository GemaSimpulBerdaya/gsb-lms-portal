import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";

export async function POST(req: Request) {
    try {
        const body = await req.json();

        const { email, password, teamName, region, role } = body;

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email dan password wajib diisi" },
                { status: 400 }
            );
        }

        await connectDB();

        // cek user sudah ada
        const existing = await Relawan.findOne({ email });
        if (existing) {
            return NextResponse.json(
                { error: "User sudah ada" },
                { status: 400 }
            );
        }

        // 🔥 HASH PASSWORD (INI YANG PENTING)
        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await Relawan.create({
            email,
            password: hashedPassword,
            teamName,
            region,
            role: role || "RELAWAN",
        });

        return NextResponse.json({
            message: "User berhasil dibuat",
            user: newUser,
        });

    } catch (err) {
        console.error(err);
        return NextResponse.json(
            { error: "Server error" },
            { status: 500 }
        );
    }
}