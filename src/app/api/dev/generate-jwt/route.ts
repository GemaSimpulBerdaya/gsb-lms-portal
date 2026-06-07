import { NextResponse } from "next/server";
import { SignJWT } from "jose";
import { notFoundInProduction } from "../_utils";

export async function GET(request: Request) {
  const productionGuard = notFoundInProduction();
  if (productionGuard) return productionGuard;

  try {
    // Ambil param dari URL (opsional)
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || "dummy-student-123";
    const name = searchParams.get("name") || "Siswa Dummy";

    const secretKey = process.env.SSO_JWT_SECRET;
    if (!secretKey) {
      return NextResponse.json({ error: "SSO_JWT_SECRET belum di-set di .env.local" }, { status: 500 });
    }

    const secret = new TextEncoder().encode(secretKey);
    const alg = 'HS256';

    // Buat JWT
    const jwt = await new SignJWT({ 
      id: userId, 
      name: name,
      role: 'STUDENT' 
    })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime('24h') // Berlaku 24 jam untuk testing
      .sign(secret);

    return NextResponse.json({
      message: "Berhasil membuat Mock JWT",
      user: { id: userId, name: name },
      token: jwt,
      usage: "Simpan token ini di cookie browser Anda (misalnya dengan nama 'legacy_token') atau kirim sebagai Authorization Bearer untuk testing halaman SMA."
    });

  } catch (error) {
    console.error("Error generating JWT:", error);
    return NextResponse.json({ error: "Gagal membuat JWT" }, { status: 500 });
  }
}
