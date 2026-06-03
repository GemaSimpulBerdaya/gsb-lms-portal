import { NextResponse } from "next/server";
import mongoose from "mongoose";
import AnakDidik from "@/models/AnakDidik";
import { getSessionUser } from "@/lib/session";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { region, fase } = body;

    if (!region && !fase) {
      return NextResponse.json({ error: "Filter wilayah atau fase harus ditentukan" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const query: Record<string, unknown> = {};
    if (region) query.region = region;
    if (fase) query.fase = fase;

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
