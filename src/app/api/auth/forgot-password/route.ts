import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Fitur lupa password dinonaktifkan. Silakan hubungi Super Admin untuk mereset password akun Tim Anda." },
    { status: 403 }
  );
}
