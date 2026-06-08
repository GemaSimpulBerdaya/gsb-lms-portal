import { NextResponse } from "next/server";
import { Types } from "mongoose";
import connectDB from "@/lib/mongodb";
import { withVolunteer } from "@/lib/apiAuth";
import StudentPortfolio from "@/models/StudentPortfolio";
import { Settings } from "@/models/Settings";

async function getActiveSemester(): Promise<string> {
  const setting = await Settings.findOne({ key: "activeSemester" });
  if (setting?.value && typeof setting.value === "string") return setting.value;
  const d = new Date();
  return `${d.getFullYear()}-1`;
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
    relawanId: session.id,
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

  await StudentPortfolio.deleteOne({ _id: id });
  return NextResponse.json({ message: "Portofolio dihapus" });
});
