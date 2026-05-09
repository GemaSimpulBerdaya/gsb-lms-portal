import { NextResponse } from "next/server";
import crypto from "crypto";
import nodemailer from "nodemailer";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "Email wajib diisi" }, { status: 400 });
    }

    await connectDB();
    const user = await Relawan.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      // Return success eventhough not found to prevent enumeration
      return NextResponse.json({ message: "Jika email terdaftar, tautan reset telah dikirim." });
    }

    // Generate token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 jam

    user.resetToken = resetToken;
    user.resetTokenExpiry = resetTokenExpiry;
    await user.save();

    const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: `"GSB LMS" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: "Permintaan Reset Password - GSB LMS",
      html: `
        <h2>Halo ${user.name || user.teamName || "Relawan"},</h2>
        <p>Anda telah meminta untuk mereset password akun GSB LMS Anda.</p>
        <p>Silakan klik tautan di bawah ini untuk mengatur ulang password Anda. Tautan ini akan kadaluarsa dalam 1 jam.</p>
        <p><a href="${resetUrl}" style="display:inline-block;padding:10px 20px;background-color:#c0392b;color:#ffffff;text-decoration:none;border-radius:5px;">Reset Password</a></p>
        <p>Jika Anda tidak merasa meminta reset password, abaikan email ini.</p>
        <br/>
        <p>Salam,<br/>Tim Gema Simpul Berdaya</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    return NextResponse.json({ message: "Jika email terdaftar, tautan reset telah dikirim." });
  } catch (error) {
    console.error("[POST /api/auth/forgot-password]", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server. Pastikan email server sudah dikonfigurasi." }, { status: 500 });
  }
}
