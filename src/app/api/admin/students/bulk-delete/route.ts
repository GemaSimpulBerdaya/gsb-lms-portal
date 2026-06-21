import { NextResponse } from "next/server";
import mongoose from "mongoose";
import Student from "@/models/Student";
import { withAdmin } from "@/lib/apiAuth";

const MONGODB_URI = process.env.MONGODB_LMS_URI;

export const POST = withAdmin(async (request) => {
  try {
    const body = await request.json();
    const { region, fase } = body;

    if (!region && !fase) {
      return NextResponse.json({ error: "Filter lokasi belajar atau fase harus ditentukan" }, { status: 400 });
    }

    if (!MONGODB_URI) throw new Error("MONGODB_LMS_URI not found");
    if (mongoose.connection.readyState === 0) await mongoose.connect(MONGODB_URI);

    const query: Record<string, unknown> = {};
    if (region) query.region = region;
    if (fase) query.fase = fase;

    const result = await Student.deleteMany(query);

    return NextResponse.json({ 
      message: `${result.deletedCount} data anak didik berhasil dihapus`,
      deletedCount: result.deletedCount 
    });
  } catch (error) {
    console.error("Bulk Delete Students Error:", error);
    return NextResponse.json({ error: "Gagal menghapus data massal" }, { status: 500 });
  }
});
