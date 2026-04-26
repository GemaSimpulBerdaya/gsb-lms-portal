import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Schedule } from "@/models/Schedule";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();

    const schedules = await Schedule.find({ relawanId: session.id }).sort({ createdAt: -1 });
    return NextResponse.json({ schedules });
  } catch (err) {
    console.error("GET /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { region, level, activeWeek } = await request.json();

    if (!region || !level) {
      return NextResponse.json({ error: "Region dan level wajib diisi" }, { status: 400 });
    }

    const validLevels = ["DISABILITAS", "TK", "SD", "SMP"];
    if (!validLevels.includes(level.toUpperCase())) {
      return NextResponse.json(
        { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
        { status: 400 }
      );
    }

    await connectDB();

    const schedule = await Schedule.create({
      relawanId: session.id,
      region: region.trim(),
      level: level.toUpperCase(),
      activeWeek: activeWeek ?? 1,
    });

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (err) {
    console.error("POST /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, region, level, activeWeek } = await request.json();

    if (!id) {
      return NextResponse.json({ error: "ID jadwal diperlukan" }, { status: 400 });
    }
    if (!region || !level) {
      return NextResponse.json({ error: "Region dan level wajib diisi" }, { status: 400 });
    }

    const validLevels = ["DISABILITAS", "TK", "SD", "SMP"];
    if (!validLevels.includes(level.toUpperCase())) {
      return NextResponse.json(
        { error: `Level tidak valid. Pilihan: ${validLevels.join(", ")}` },
        { status: 400 }
      );
    }

    await connectDB();

    const schedule = await Schedule.findOneAndUpdate(
      { _id: id, relawanId: session.id },
      { region: region.trim(), level: level.toUpperCase(), activeWeek },
      { new: true }
    );

    if (!schedule) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ schedule });
  } catch (err) {
    console.error("PUT /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID jadwal diperlukan" }, { status: 400 });
    }

    await connectDB();

    const deleted = await Schedule.findOneAndDelete({ _id: id, relawanId: session.id });

    if (!deleted) {
      return NextResponse.json({ error: "Jadwal tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ message: "Jadwal berhasil dihapus" });
  } catch (err) {
    console.error("DELETE /schedule error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
