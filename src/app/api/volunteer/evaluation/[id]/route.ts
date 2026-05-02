import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { NilaiOffline } from "@/models/Relawan";
import mongoose from "mongoose";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  const { type, week, score, notes, moduleId, semester, title } = await request.json();

  const getCurrentSemester = () => {
    const d = new Date();
    return `${d.getFullYear()}-1`;
  };

  if (semester !== getCurrentSemester()) {
    return NextResponse.json({ error: "Tidak dapat mengubah data semester lampau" }, { status: 403 });
  }

  if (!type || score === undefined || !semester) {
    return NextResponse.json(
      { error: "type, score, dan semester wajib diisi" },
      { status: 400 }
    );
  }

  const validTypes = ["TUGAS", "UJIAN", "KUIS"];
  if (!validTypes.includes(type.toUpperCase())) {
    return NextResponse.json(
      { error: `Type tidak valid. Pilihan: ${validTypes.join(", ")}` },
      { status: 400 }
    );
  }

  if (type.toUpperCase() === "TUGAS" && !week) {
    return NextResponse.json({ error: "week wajib diisi untuk tipe TUGAS" }, { status: 400 });
  }

  await connectDB();

  const nilai = await NilaiOffline.findOne({ _id: id, relawanId: session.id });
  if (!nilai) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  if (nilai.semester !== getCurrentSemester()) {
    return NextResponse.json({ error: "Tidak dapat mengubah data semester lampau (Arsip)" }, { status: 403 });
  }

  nilai.type = type.toUpperCase();
  nilai.week = week ?? null;
  nilai.score = score;
  nilai.title = title ?? nilai.title;
  nilai.notes = notes ?? nilai.notes;
  nilai.moduleId = moduleId ?? nilai.moduleId;
  nilai.semester = semester;
  await nilai.save();

  return NextResponse.json({ message: "Nilai berhasil diperbarui", nilai });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getSessionUser();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "ID tidak valid" }, { status: 400 });
  }

  await connectDB();

  const getCurrentSemester = () => {
    const d = new Date();
    return `${d.getFullYear()}-1`;
  };

  const existingNilai = await NilaiOffline.findOne({ _id: id, relawanId: session.id });
  if (!existingNilai) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  if (existingNilai.semester !== getCurrentSemester()) {
    return NextResponse.json({ error: "Tidak dapat menghapus data semester lampau (Arsip)" }, { status: 403 });
  }

  const result = await NilaiOffline.findOneAndDelete({ _id: id, relawanId: session.id });
  if (!result) {
    return NextResponse.json({ error: "Nilai tidak ditemukan atau bukan milik Anda" }, { status: 404 });
  }

  return NextResponse.json({ message: "Nilai berhasil dihapus" });
}
