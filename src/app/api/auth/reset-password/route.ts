import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/lib/mongodb";
import { Relawan } from "@/models/Relawan";
import { enforceRateLimit } from "@/lib/rateLimit";
import { parseJsonBody } from "@/lib/validation";
import { z } from "zod";

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, "Token dan password baru wajib diisi"),
  newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
});

export async function POST(request: Request) {
  try {
    // Anti token-guessing: 5 percobaan reset per IP tiap menit.
    const limited = enforceRateLimit(request, "reset-password", { limit: 5, windowMs: 60_000 });
    if (limited) return limited;

    const parsed = await parseJsonBody(request, resetPasswordSchema);
    if (!parsed.success) return parsed.response;
    const { token, newPassword } = parsed.data;

    await connectDB();
    
    // Cari user dengan token yang valid dan belum expired
    const user = await Relawan.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return NextResponse.json({ error: "Token tidak valid atau sudah kadaluarsa" }, { status: 400 });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password user dan hapus token
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    
    await user.save();

    return NextResponse.json({ message: "Password berhasil diubah. Silakan login dengan password baru." });
  } catch (error) {
    console.error("[POST /api/auth/reset-password]", error);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
