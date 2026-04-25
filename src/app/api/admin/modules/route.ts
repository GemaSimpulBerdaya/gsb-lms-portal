import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Module } from "@/models/Core";

/**
 * POST /api/admin/modules
 * Menambah modul baru
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const data = await request.json();
    await connectDB();
    const newModule = await Module.create(data);
    return NextResponse.json({ message: "Modul berhasil dibuat", module: newModule }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/modules
 * Mengambil semua modul untuk manajemen (tanpa filter category)
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await connectDB();
    const modules = await Module.find({}).sort({ category: 1, week: 1, order: 1 });
    return NextResponse.json({ modules });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
