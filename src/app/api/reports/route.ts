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
  const semester = searchParams.get("semester");
  const skip = (page - 1) * limit;

  await connectDB();

  const all = await Report.find().lean();
  console.log("TOTAL:", all.length);

  all.forEach((r) => {
    console.log("REL ID:", r.relawanId.toString());
  });
  const relawanObjectId = new Types.ObjectId(session.id);
  const query: any = { relawanId: relawanObjectId };
  if (semester) {
    query.semester = semester;
  }

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select("title description date photoUrl photoUrls location region level scheduleId semester createdAt"),

    Report.countDocuments(query),
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

    const { title, description, date, location, photoUrl, photoUrls, scheduleId, region, level, semester } = body;

    const getCurrentSemester = () => {
      const d = new Date();
      return `${d.getFullYear()}-1`;
    };

    if (semester && semester !== getCurrentSemester()) {
      return NextResponse.json({ error: "Tidak dapat membuat laporan di semester lampau" }, { status: 403 });
    }

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

    // Normalisasi: photoUrls (array) adalah primary; photoUrl (legacy) di-merge.
    const finalPhotoUrls: string[] = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
    if (photoUrl && !finalPhotoUrls.includes(photoUrl)) {
      finalPhotoUrls.unshift(photoUrl);
    }

    const newReport = await Report.create({
      relawanId: relawanObjectId,
      scheduleId: scheduleId ? new Types.ObjectId(scheduleId) : undefined,
      region,
      level,
      title,
      description,
      date: new Date(date),
      semester: semester || getCurrentSemester(),
      location: location || "",
      photoUrl: finalPhotoUrls[0] || "",
      photoUrls: finalPhotoUrls,
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

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { id, title, description, date, location, photoUrl, photoUrls, scheduleId, region, level } = body;

    const getCurrentSemester = () => {
      const d = new Date();
      return `${d.getFullYear()}-1`;
    };

    if (!id) {
      return NextResponse.json({ error: "ID Laporan wajib diisi" }, { status: 400 });
    }

    if (!title || !description || !date) {
      return NextResponse.json(
        { error: "Tanggal, judul, dan deskripsi wajib diisi" },
        { status: 400 }
      );
    }

    await connectDB();
    const relawanObjectId = new Types.ObjectId(session.id);

    const existingReport = await Report.findOne({ _id: id, relawanId: relawanObjectId });
    if (!existingReport) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    if (existingReport.semester && existingReport.semester !== getCurrentSemester()) {
      return NextResponse.json({ error: "Tidak dapat mengubah laporan semester lampau" }, { status: 403 });
    }

    // Normalisasi: photoUrls (array) adalah primary; photoUrl (legacy) di-merge.
    const finalPhotoUrls: string[] = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
    if (photoUrl && !finalPhotoUrls.includes(photoUrl)) {
      finalPhotoUrls.unshift(photoUrl);
    }

    const updatedReport = await Report.findOneAndUpdate(
      { _id: id, relawanId: relawanObjectId },
      {
        scheduleId: scheduleId ? new Types.ObjectId(scheduleId) : undefined,
        region,
        level,
        title,
        description,
        date: new Date(date),
        location: location || "",
        photoUrl: finalPhotoUrls[0] || "",
        photoUrls: finalPhotoUrls,
      },
      { new: true }
    );

    if (!updatedReport) {
      return NextResponse.json({ error: "Laporan tidak ditemukan atau tidak berhak" }, { status: 404 });
    }

    return NextResponse.json({
      message: "Berhasil memperbarui laporan",
      report: updatedReport,
    });
  } catch (error) {
    console.error("ERROR PUT REPORT:", error);
    return NextResponse.json(
      { error: "Gagal memperbarui laporan" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID laporan wajib disertakan" }, { status: 400 });
    }

    await connectDB();
    const relawanObjectId = new Types.ObjectId(session.id);

    const getCurrentSemester = () => {
      const d = new Date();
      return `${d.getFullYear()}-1`;
    };

    const existingReport = await Report.findOne({ _id: id, relawanId: relawanObjectId });
    if (!existingReport) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    if (existingReport.semester && existingReport.semester !== getCurrentSemester()) {
      return NextResponse.json({ error: "Tidak dapat menghapus laporan semester lampau" }, { status: 403 });
    }

    const deletedReport = await Report.findOneAndDelete({
      _id: id,
      relawanId: relawanObjectId,
    });

    if (!deletedReport) {
      return NextResponse.json({ error: "Laporan tidak ditemukan atau tidak berhak" }, { status: 404 });
    }

    return NextResponse.json({ message: "Laporan berhasil dihapus" });
  } catch (error) {
    console.error("ERROR DELETE REPORT:", error);
    return NextResponse.json(
      { error: "Gagal menghapus laporan" },
      { status: 500 }
    );
  }
}