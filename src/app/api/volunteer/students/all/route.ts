import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import AnakDidik from "@/models/AnakDidik";

export async function GET() {
  const session = await getSessionUser();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const students = await AnakDidik.find()
    .select("name region category parentName")
    .sort({ name: 1 });

  return NextResponse.json({
    total: students.length,
    students,
  });
}
