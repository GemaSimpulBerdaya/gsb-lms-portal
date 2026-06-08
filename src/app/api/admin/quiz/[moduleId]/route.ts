import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { withModuleManager } from "@/lib/apiAuth";
import { Quiz } from "@/models/Quiz";

export const GET = withModuleManager<{ params: Promise<{ moduleId: string }> }>(
  async (_request, _session, { params }) => {
  try {
    const { moduleId } = await params;
    await connectDB();
    const quiz = await Quiz.findOne({ moduleId });
    return NextResponse.json({ quiz });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const POST = withModuleManager<{ params: Promise<{ moduleId: string }> }>(
  async (request, _session, { params }) => {
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
});
