import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Settings } from "@/models/Settings";

export async function GET() {
  try {
    await connectDB();
    const settings = await Settings.find({});
    
    const settingsMap = settings.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as any);

    // Defaults
    if (!settingsMap.activeSemester) {
      const d = new Date();
      const defaultValue = `${d.getFullYear()}-1`;
      await Settings.create({ key: "activeSemester", value: defaultValue });
      settingsMap.activeSemester = defaultValue;
    }

    if (!settingsMap.availableSemesters) {
      const defaultValue = ["2024-1", "2024-2", "2025-1", "2025-2", "2026-1"];
      await Settings.create({ key: "availableSemesters", value: defaultValue });
      settingsMap.availableSemesters = defaultValue;
    }

    return NextResponse.json(settingsMap);
  } catch (error) {
    return NextResponse.json({ error: "Gagal mengambil pengaturan" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    await connectDB();

    const updates = Object.entries(body).map(([key, value]) => {
      return Settings.findOneAndUpdate(
        { key },
        { value },
        { upsert: true, new: true }
      );
    });

    await Promise.all(updates);

    return NextResponse.json({ message: "Pengaturan diperbarui" });
  } catch (error) {
    return NextResponse.json({ error: "Gagal memperbarui pengaturan" }, { status: 500 });
  }
}
