import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Module } from "@/models/Core";

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { id } = await params;
    const data = await request.json();
    await connectDB();
    const updated = await Module.findByIdAndUpdate(id, { $set: data }, { new: true });
    
    if (!updated) return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });
    
    return NextResponse.json({ message: "Modul berhasil diperbarui", module: updated });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { id } = await params;
    await connectDB();
    const deleted = await Module.findByIdAndDelete(id);
    
    if (!deleted) return NextResponse.json({ error: "Modul tidak ditemukan" }, { status: 404 });
    
    return NextResponse.json({ message: "Modul berhasil dihapus" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
