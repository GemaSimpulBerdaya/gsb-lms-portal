import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Report } from "@/models/Report";

export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { title, description, date, photoUrl, location } = await request.json();

  if (!title || !description || !date) {
    return NextResponse.json(
      { error: "title, description, dan date wajib diisi" },
      { status: 400 }
    );
  }

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Format date tidak valid" }, { status: 400 });
  }

  await connectDB();

  const report = await Report.create({
    relawanId: session.id,
    title,
    description,
    date: parsedDate,
    photoUrl: photoUrl ?? null,
    location: location ?? null,
  });

  return NextResponse.json({ message: "Laporan berhasil dikirim", report }, { status: 201 });
}
