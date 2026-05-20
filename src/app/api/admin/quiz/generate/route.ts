import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import fs from "fs";
import path from "path";
import { PdfReader } from "pdfreader";

export async function POST(request: Request) {
  const apiKey = (process.env.GEMINI_API_KEY || "").replace(/["']/g, "").trim();
  if (!apiKey) return NextResponse.json({ error: "API Key belum diatur" }, { status: 400 });

  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const { fileUrl, title } = await request.json();
    let textContent = "";
    if (fileUrl && fileUrl.startsWith("/")) {
      const filePath = path.join(process.cwd(), "public", fileUrl);
      if (fs.existsSync(filePath)) {
        const dataBuffer = fs.readFileSync(filePath);
        textContent = await new Promise((resolve) => {
          const rows: string[] = [];
          new PdfReader().parseBuffer(dataBuffer, (err: unknown, item: { text?: string } | null | undefined) => {
            if (!item) resolve(rows.join(" "));
            else if (item.text) rows.push(item.text);
          });
        });
      }
    }

    const safeText = textContent.substring(0, 2000) || `Modul: ${title}`;
    const prompt = `Buatlah 5 soal kuis pilihan ganda (4 pilihan) berdasarkan materi ini: ${safeText}. Berikan output HANYA dalam format JSON array: [{"question": "...", "options": ["...", "...", "...", "..."], "correctAnswer": 0}]`;

    // DAFTAR MODEL UNTUK DICOBA (Dari yang paling mungkin punya kuota)
    const modelCandidates = [
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b",
      "gemini-1.5-pro",
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash"
    ];

    let lastError = "";

    for (const modelName of modelCandidates) {
      try {
        console.log(`Mencoba model: ${modelName}...`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        const data = await response.json();
        if (response.ok) {
          console.log(`BERHASIL pakai model: ${modelName}!`);
          const aiText = data.candidates[0].content.parts[0].text;
          const jsonStr = aiText.replace(/```json/g, "").replace(/```/g, "").trim();
          return NextResponse.json({ questions: JSON.parse(jsonStr) });
        } else {
          lastError = data.error?.message || "Unknown error";
          console.warn(`Model ${modelName} gagal: ${lastError}`);
        }
      } catch (err: unknown) {
        lastError = err instanceof Error ? err.message : "Unknown error";
      }
    }

    // FALLBACK: Jika semua model AI gagal karena kuota, berikan soal contoh agar user tetap bisa tes UI
    console.warn("Semua model AI gagal (kemungkinan masalah kuota). Memberikan soal contoh sebagai fallback.");
    const mockQuestions = [
      { "question": "Apa itu SNBT?", "options": ["Seleksi Nasional Berbasis Tes", "Seleksi Nilai Berbasis Teks", "Sistem Nasional Berbasis Tes", "Seleksi Nasional Bersama Tes"], "correctAnswer": 0 },
      { "question": "Apa kepanjangan dari UTBK?", "options": ["Ujian Tulis Berbasis Komputer", "Unit Tulis Berbasis Komputer", "Ujian Teknis Berbasis Komputer", "Ujian Terpadu Berbasis Komputer"], "correctAnswer": 0 },
      { "question": "Siapa penyelenggara SNBT?", "options": ["Kemendikbud", "SNPMB", "Lembaga Tes", "Universitas"], "correctAnswer": 1 }
    ];
    return NextResponse.json({ questions: mockQuestions, note: "Ini adalah soal contoh karena kuota API Gemini Mas sedang 0 (limit: 0). Silakan tunggu 15-30 menit sampai kuota aktif." });

  } catch (error: unknown) {
    console.error("Final AI Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: "Gagal: " + message }, { status: 500 });
  }
}
