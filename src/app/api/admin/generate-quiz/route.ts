import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSessionUser } from "@/lib/session";

/**
 * POST /api/admin/generate-quiz
 * Menggunakan AI (Gemini) untuk membuat soal kuis dari teks materi
 */
export async function POST(request: Request) {
  try {
    // 1. Proteksi Admin
    const session = await getSessionUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized - Hanya Admin yang dapat menggunakan fitur ini" }, { status: 403 });
    }

    const body = await request.json();
    const { content, questionCount = 5 } = body;

    if (!content) {
      return NextResponse.json({ error: "Konten materi wajib diisi" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GEMINI_API_KEY belum dikonfigurasi di .env.local" }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    // Menggunakan alias model terbaru yang tersedia
    const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });

    const prompt = `
      Anda adalah pakar pembuat soal ujian pendidikan. 
      Berdasarkan materi di bawah ini, buatlah ${questionCount} soal pilihan ganda yang berkualitas.
      
      MATERI:
      ${content}
      
      FORMAT OUTPUT (Wajib JSON murni, tanpa markdown):
      [
        {
          "question": "Pertanyaan di sini?",
          "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
          "correctAnswer": 0
        }
      ]
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    console.log("AI Raw Response:", text);

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "AI tidak mengembalikan JSON valid", raw: text }, { status: 500 });
    }
    
    const questions = JSON.parse(jsonMatch[0]);

    return NextResponse.json({
      message: "Berhasil generate kuis",
      questions
    });

  } catch (error: any) {
    console.error("CRITICAL API ERROR:", error);
    return NextResponse.json({ 
      error: "Eror Fatal di API", 
      message: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
