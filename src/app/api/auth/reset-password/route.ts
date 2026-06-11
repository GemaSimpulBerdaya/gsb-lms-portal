import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Fitur lupa password dinonaktifkan." },
    { status: 403 }
  );
}
