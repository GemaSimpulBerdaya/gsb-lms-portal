import { NextResponse } from "next/server";
import mongoose from "mongoose";
import AnakDidik from "@/models/AnakDidik";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { region, category } = body;

    if (!region && !category) {
      return NextResponse.json({ error: "Filter wilayah atau jenjang harus ditentukan" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const query: Record<string, unknown> = {};
    if (region) query.region = region;
    if (category) query.category = category;

    const result = await AnakDidik.deleteMany(query);

    return NextResponse.json({ 
      message: `${result.deletedCount} data anak didik berhasil dihapus`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("Bulk Delete Students Error:", error);
    return NextResponse.json({ error: "Gagal menghapus data massal" }, { status: 500 });
  }
}
