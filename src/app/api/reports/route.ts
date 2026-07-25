import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import { Report } from "@/models/Report";
import { Schedule } from "@/models/Schedule";
import { parseJsonBody } from "@/lib/validation";
import { getActiveSemester } from "@/lib/semester";
import { Types } from "mongoose";
import { z } from "zod";

const requiredText = (message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value ?? ""),
    z.string().min(1, message),
  );
const optionalText = z.string().trim().optional();
const photoUrlsSchema = z.array(z.string().trim().min(1)).optional();
const objectIdString = (field: string, requiredMessage = `${field} wajib diisi`) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value ?? ""),
    z.string().min(1, requiredMessage).refine((value) => Types.ObjectId.isValid(value), `${field} tidak valid`),
  );
const optionalObjectIdString = (field: string) =>
  z.string().trim().refine((value) => value === "" || Types.ObjectId.isValid(value), `${field} tidak valid`).optional();
const validDateString = requiredText("Tanggal, judul, dan deskripsi wajib diisi").refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  "Tanggal tidak valid",
);

const reportCreateSchema = z.object({
  title: requiredText("Tanggal, judul, dan deskripsi wajib diisi"),
  description: requiredText("Tanggal, judul, dan deskripsi wajib diisi"),
  date: validDateString,
  location: optionalText,
  photoUrl: optionalText,
  photoUrls: photoUrlsSchema,
  scheduleId: optionalObjectIdString("ID jadwal"),
  region: optionalText,
  fase: optionalText,
  level: optionalText,
  semester: optionalText,
});

const reportUpdateSchema = reportCreateSchema.extend({
  id: objectIdString("ID laporan", "ID Laporan wajib diisi"),
});

const reportDeleteQuerySchema = z.object({
  id: objectIdString("ID laporan", "ID laporan wajib disertakan"),
});

const mergePhotoUrls = (photoUrl?: string, photoUrls?: string[]) => {
  const finalPhotoUrls = Array.isArray(photoUrls) ? photoUrls.filter(Boolean) : [];
  if (photoUrl && !finalPhotoUrls.includes(photoUrl)) {
    finalPhotoUrls.unshift(photoUrl);
  }
  return finalPhotoUrls;
};

async function findOwnedSchedule(scheduleId: string | undefined, teamAccountId: Types.ObjectId) {
  if (!scheduleId) return null;
  return Schedule.findOne({ _id: scheduleId, teamAccountId })
    .select("region fase semester")
    .lean();
}

export const GET = withVolunteer(async (request, session) => {

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(20, Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)));
  const semester = searchParams.get("semester");
  const skip = (page - 1) * limit;

  await connectDB();

  const relawanObjectId = new Types.ObjectId(session.id);
  const query: Record<string, unknown> = { teamAccountId: relawanObjectId };
  if (semester) {
    query.semester = semester;
  }

  const [reports, total] = await Promise.all([
    Report.find(query)
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select("title description date photoUrl photoUrls location region fase scheduleId semester createdAt")
      .lean(),

    Report.countDocuments(query),
  ]);

  // Alias level = fase untuk backward-compat dengan FE lama yang masih baca
  // report.level. Schema canonical pakai fase.
  const reportsWithAlias = reports.map((r) => ({
    ...r,
    level: (r as { fase?: string }).fase,
  }));

  return NextResponse.json({
    total,
    page,
    totalPages: Math.ceil(total / limit),
    reports: reportsWithAlias,
  });
});

export const POST = withVolunteer(async (request, session) => {
  try {

    const parsed = await parseJsonBody(request, reportCreateSchema);
    if (!parsed.success) return parsed.response;
    const { title, description, date, location, photoUrl, photoUrls, scheduleId, region, semester } = parsed.data;
    const fase = parsed.data.fase ?? parsed.data.level;

    const activeSemester = await getActiveSemester();
    if (semester && semester !== activeSemester) {
      return NextResponse.json({ error: "Tidak dapat membuat laporan di semester lampau" }, { status: 403 });
    }

    await connectDB();

    const relawanObjectId = new Types.ObjectId(session.id);
    const schedule = await findOwnedSchedule(scheduleId, relawanObjectId);
    if (scheduleId && !schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan atau tidak berhak" }, { status: 404 });
    }

    // Normalisasi: photoUrls (array) adalah primary; photoUrl (legacy) di-merge.
    const finalPhotoUrls = mergePhotoUrls(photoUrl, photoUrls);

    const newReport = await Report.create({
      teamAccountId: relawanObjectId,
      scheduleId: scheduleId ? new Types.ObjectId(scheduleId) : undefined,
      region: schedule?.region ?? region,
      fase: schedule?.fase ?? fase,
      title,
      description,
      date: new Date(date),
      semester: semester || activeSemester,
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
});

export const PUT = withVolunteer(async (request, session) => {
  try {

    const parsed = await parseJsonBody(request, reportUpdateSchema);
    if (!parsed.success) return parsed.response;
    const { id, title, description, date, location, photoUrl, photoUrls, scheduleId, region } = parsed.data;
    const fase = parsed.data.fase ?? parsed.data.level;

    await connectDB();
    const relawanObjectId = new Types.ObjectId(session.id);
    const schedule = await findOwnedSchedule(scheduleId, relawanObjectId);
    if (scheduleId && !schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan atau tidak berhak" }, { status: 404 });
    }

    const existingReport = await Report.findOne({ _id: id, teamAccountId: relawanObjectId });
    if (!existingReport) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    if (existingReport.semester && existingReport.semester !== await getActiveSemester()) {
      return NextResponse.json({ error: "Tidak dapat mengubah laporan semester lampau" }, { status: 403 });
    }

    // Normalisasi: photoUrls (array) adalah primary; photoUrl (legacy) di-merge.
    const finalPhotoUrls = mergePhotoUrls(photoUrl, photoUrls);

    const updatedReport = await Report.findOneAndUpdate(
      { _id: id, teamAccountId: relawanObjectId },
      {
        scheduleId: scheduleId ? new Types.ObjectId(scheduleId) : undefined,
        region: schedule?.region ?? region,
        fase: schedule?.fase ?? fase,
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
});

export const DELETE = withVolunteer(async (request, session) => {
  try {

    const parsedQuery = reportDeleteQuerySchema.safeParse({ id: request.nextUrl.searchParams.get("id") });
    if (!parsedQuery.success) {
      return NextResponse.json({ error: parsedQuery.error.issues[0]?.message ?? "ID laporan tidak valid" }, { status: 400 });
    }
    const { id } = parsedQuery.data;

    await connectDB();
    const relawanObjectId = new Types.ObjectId(session.id);

    const existingReport = await Report.findOne({ _id: id, teamAccountId: relawanObjectId });
    if (!existingReport) {
      return NextResponse.json({ error: "Laporan tidak ditemukan" }, { status: 404 });
    }

    if (existingReport.semester && existingReport.semester !== await getActiveSemester()) {
      return NextResponse.json({ error: "Tidak dapat menghapus laporan semester lampau" }, { status: 403 });
    }

    const deletedReport = await Report.findOneAndDelete({
      _id: id,
      teamAccountId: relawanObjectId,
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
});
