import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import StudentPortfolio from "@/models/StudentPortfolio";
import { getActiveSemester } from "@/lib/semester";
import { UTApi } from "uploadthing/server";

function uploadThingKey(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    return (url.hostname === "ufs.sh" || url.hostname.endsWith(".ufs.sh"))
      ? url.pathname.replace(/^\/f\//, "").replace(/^\//, "") || null
      : null;
  } catch {
    return null;
  }
}

/**
 * DELETE /api/volunteer/portfolio/[id]
 * Hanya entry milik relawan yang login & semester berjalan yang bisa dihapus.
 * Semester lampau dianggap final / read-only.
 */
export const DELETE = withVolunteer<{ params: Promise<{ id: string }> }>(
  async (_request, session, { params }) => {
  const { id } = await params;
  if (!id || !Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  await connectDB();

  const item = await StudentPortfolio.findOne({
    _id: id,
    teamAccountId: session.id,
  });
  if (!item) {
    return NextResponse.json({ error: "Portofolio tidak ditemukan" }, { status: 404 });
  }

  const activeSemester = await getActiveSemester();
  if (item.semester !== activeSemester) {
    return NextResponse.json(
      { error: "Tidak dapat menghapus entry semester lampau" },
      { status: 403 }
    );
  }

  const stored = await StudentPortfolio.collection.findOne(
    { _id: new Types.ObjectId(id) },
    { projection: { fileUrls: 1 } }
  );
  await StudentPortfolio.deleteOne({ _id: id });
  if (item.storageType === "UPLOADTHING") {
    const urls = stored?.fileUrls?.length ? stored.fileUrls : [item.fileUrl];
    const keys = (urls as string[])
      .map(uploadThingKey)
      .filter((key): key is string => Boolean(key));
    if (keys.length > 0) {
      await new UTApi().deleteFiles(keys).catch((error) => {
        console.error("Gagal menghapus file karya dari UploadThing:", error);
      });
    }
  }
  return NextResponse.json({ message: "Portofolio dihapus" });
});
