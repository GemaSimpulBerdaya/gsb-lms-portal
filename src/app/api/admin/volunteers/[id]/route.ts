import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { Relawan } from "@/models/Relawan";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const deleted = await Relawan.findByIdAndDelete(id);

    if (!deleted) {
      return NextResponse.json({ error: "Relawan tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Relawan berhasil dihapus" });
  } catch (error) {
    console.error("Delete Volunteer Error:", error);
    return NextResponse.json({ error: "Gagal menghapus relawan" }, { status: 500 });
  }
}
