import { NextResponse } from "next/server";
import { verifySsoJWT, signStudentSessionJWT } from "@/lib/jwt";
import { enforceRateLimit } from "@/lib/rateLimit";

/**
 * GET /api/student/sso?token=<jwt>
 *
 * Route Handler untuk SSO handoff dari gsb-web.
 * Cookie hanya boleh di-set di Route Handler / Server Action (Next.js 16),
 * jadi penanganan token dipindah ke sini dari page `/student`.
 *
 * Token handoff dari gsb-web berumur pendek (5 menit, secret bersama). Setelah
 * diverifikasi, LMS menerbitkan token sesi sendiri (24 jam, secret internal) lalu
 * menyimpannya sebagai cookie. Dengan begitu secret bersama tidak ngendon di cookie.
 *
 * Lihat kontrak: gsb-lms-portal/SSO_CONTRACT.md
 */
export async function GET(request: Request) {
  // Anti token-guessing pada handoff SSO: 10 percobaan per IP tiap menit.
  const limited = enforceRateLimit(request, "student-sso", { limit: 10, windowMs: 60_000 });
  if (limited) return limited;

  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=no_token", origin));
  }

  const payload = await verifySsoJWT(token);

  if (!payload || payload.role !== "STUDENT") {
    return NextResponse.redirect(new URL("/?error=invalid_token", origin));
  }

  // Terbitkan token sesi LMS sendiri (24 jam) dari klaim handoff
  const sessionToken = await signStudentSessionJWT({
    id: String(payload.id),
    name: String(payload.name ?? ""),
    role: "STUDENT",
  });

  const response = NextResponse.redirect(new URL("/student/dashboard", origin));
  response.cookies.set("gsb_student_token", sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 1 hari
    path: "/",
  });

  return response;
}
