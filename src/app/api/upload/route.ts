import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import * as path from "path";
import * as crypto from "crypto";
import { getSessionUser } from "@/lib/session";

// ─── Upload endpoint ──────────────────────────────────────────────────────
// Menerima body { image: "data:image/...;base64,..." } dan menyimpan ke
// filesystem di `public/uploads/reports/`. Return JSON { url: "/uploads/..." }.
//
// Kenapa filesystem & bukan inline base64 ke DB:
//  - Foto base64 bikin DB membengkak (1 record bisa puluhan MB)
//  - Multi-foto gampang nabrak Next.js bodyParser limit
//  - URL pendek lebih cepat di-fetch & lebih ramah CDN
//
// Trade-off: file disimpan di disk Vercel/server lokal — di Vercel ini
// ephemeral. Untuk production yang scale, tetap disarankan ganti ke S3/R2/
// Cloudinary nanti. Tapi untuk dev & on-prem deployment, ini cukup.
//
// Body cap di 15MB untuk allow burst upload dari multi-file picker.

export const runtime = "nodejs"; // butuh fs, gak bisa di Edge
export const maxDuration = 30;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_BYTES = 15 * 1024 * 1024; // 15MB raw base64 cap
const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "reports");

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

export async function POST(request: NextRequest) {
  try {
    // Auth — hanya user login yg boleh upload
    const session = await getSessionUser();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.image !== "string") {
      return NextResponse.json({ error: "Field 'image' wajib diisi" }, { status: 400 });
    }

    const dataUrl: string = body.image;
    // Format yang diterima: data:<mime>;base64,<payload>
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return NextResponse.json({ error: "Format data URL tidak valid" }, { status: 400 });
    }

    const mime = match[1].toLowerCase();
    const base64Payload = match[2];

    if (!ALLOWED_MIME.includes(mime)) {
      return NextResponse.json({ error: `Format ${mime} tidak didukung` }, { status: 400 });
    }

    // Validasi ukuran sebelum decode (rough estimate: base64 ~1.37x)
    if (base64Payload.length > MAX_BYTES * 1.4) {
      return NextResponse.json({ error: "File terlalu besar (maks 15MB)" }, { status: 413 });
    }

    const buffer = Buffer.from(base64Payload, "base64");
    if (buffer.length > MAX_BYTES) {
      return NextResponse.json({ error: "File terlalu besar (maks 15MB)" }, { status: 413 });
    }

    // Generate filename unik: <timestamp>-<random8>.<ext>
    const ext = extFromMime(mime);
    const timestamp = Date.now();
    const randomId = crypto.randomBytes(4).toString("hex");
    const filename = `${timestamp}-${randomId}.${ext}`;

    // Ensure directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const filepath = path.join(UPLOAD_DIR, filename);
    await writeFile(filepath, buffer);

    // Public URL — Next.js auto-serve dari `public/`
    const publicUrl = `/uploads/reports/${filename}`;

    return NextResponse.json({ url: publicUrl, filename, size: buffer.length });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    return NextResponse.json({ error: "Gagal upload file" }, { status: 500 });
  }
}
