import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Quiz } from "@/models/SMA";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { moduleId } = await params;
    await connectDB();
    const quiz = await Quiz.findOne({ moduleId });
    return NextResponse.json({ quiz });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ moduleId: string }> }
) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { moduleId } = await params;
    const data = await request.json();
    await connectDB();
    
    const quiz = await Quiz.findOneAndUpdate(
      { moduleId },
      { $set: { ...data, moduleId } },
      { upsert: true, new: true }
    );
    
    return NextResponse.json({ message: "Kuis berhasil disimpan", quiz });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
