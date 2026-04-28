import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Report } from "@/models/Report";
import { Types } from "mongoose";

export async function GET(request: NextRequest) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const skip = (page - 1) * limit;

  await connectDB();

  const all = await Report.find().lean();
  console.log("TOTAL:", all.length);

  all.forEach((r) => {
    console.log("REL ID:", r.relawanId.toString());
  });
  const relawanObjectId = new Types.ObjectId(session.id);
  const [reports, total] = await Promise.all([
    Report.find({ relawanId: relawanObjectId }) // ✅ PAKAI INI
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select("title description date photoUrl location createdAt"),

    Report.countDocuments({ relawanId: relawanObjectId }), // ✅ SAMA
  ]);
  console.log("MONGO URI:", process.env.MONGODB_LMS_URI);
  return NextResponse.json({
    total,
    page,
    totalPages: Math.ceil(total / limit),
    reports,
  });
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();

    const { title, description, date, location, photoUrl } = body;

    // validasi wajib
    if (!title || !description || !date) {
      return NextResponse.json(
        { error: "Tanggal, judul, dan deskripsi wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();

    // ⚠️ pastikan ID valid
    const relawanObjectId = new Types.ObjectId(session.id);

    const newReport = await Report.create({
      relawanId: relawanObjectId,
      title,
      description,
      date: new Date(date),
      location: location || "",
      photoUrl: photoUrl || "",
    });

    return NextResponse.json({
      message: "Berhasil membuat laporan",
      report: newReport,
    });

  } catch (error) {
    console.error("ERROR POST REPORT:", error);
    return NextResponse.json(
      { error: "Gagal menyimpan laporan" },
      { status: 500 }
    );
  }
}