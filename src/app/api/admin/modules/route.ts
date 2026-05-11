import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { getSessionUser } from "@/lib/session";
import { Module } from "@/models/Core";
import mongoose from "mongoose";

/**
 * POST /api/admin/modules
 * Menambah modul baru
 */
export async function POST(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const data = await request.json();
    await connectDB();
    const newModule = await Module.create(data);
    return NextResponse.json({ message: "Modul berhasil dibuat", module: newModule }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/admin/modules
 * Mengambil semua modul untuk manajemen (tanpa filter category)
 */
export async function GET() {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    await connectDB();
    const modules = await Module.find({}).sort({ category: 1, week: 1, order: 1 }).lean();
    
    // Use the model name to avoid dynamic import issues if possible
    let quizzes: any[] = [];
    try {
      const Quiz = mongoose.models.Quiz || (await import("@/models/SMA")).Quiz;
      const moduleIds = modules.map(m => m._id);
      quizzes = await Quiz.find({ moduleId: { $in: moduleIds } }).select("moduleId").lean();
    } catch (qError) {
      console.warn("Quiz model not yet registered or error fetching quizzes:", qError);
      // We can continue without quiz info if necessary, but here we'll just have an empty quiz map
    }

    const quizMap = new Set(quizzes.map((q: any) => q.moduleId.toString()));

    const modulesWithQuiz = modules.map(m => ({
      ...m,
      hasQuiz: quizMap.has(m._id.toString())
    }));

    return NextResponse.json({ modules: modulesWithQuiz });
  } catch (error: any) {
    console.error("Error in GET /api/admin/modules:", error);
    return NextResponse.json({ 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}
