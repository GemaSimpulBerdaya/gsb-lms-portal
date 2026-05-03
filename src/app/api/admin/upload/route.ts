import { NextResponse } from "next/server";
import { writeFile } from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Tidak ada file yang diunggah" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Buat nama file unik
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const uploadDir = path.join(process.cwd(), "public/uploads/modules");
    const filePath = path.join(uploadDir, filename);

    await writeFile(filePath, buffer);
    
    const fileUrl = `/uploads/modules/${filename}`;

    return NextResponse.json({ 
      message: "File berhasil diunggah",
      url: fileUrl 
    });
  } catch (error) {
    console.error("Upload Error:", error);
    return NextResponse.json({ error: "Gagal mengunggah file" }, { status: 500 });
  }
}
