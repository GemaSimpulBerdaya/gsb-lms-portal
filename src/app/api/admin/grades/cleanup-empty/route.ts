import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { NilaiOffline } from "@/models/Relawan";
import { getSessionUser } from "@/lib/session";

/**
 * POST /api/admin/grades/cleanup-empty
 *
 * Bersihkan record TUGAS yang K=Q=S=0 (dummy/legacy yang ke-save sebelum
 * validasi pre-submit di /evaluation aktif).
 *
 * Body JSON:
 *   { dryRun?: boolean }   // default true
 *
 * Response:
 *   { matched: number, deleted: number, sample: Array<{...}> }
 */
export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { dryRun?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  const dryRun = body.dryRun !== false; // default true (safe)

  await connectDB();

  // Filter: TUGAS yang ketiga komponen 0 atau missing
  const filter = {
    type: "TUGAS",
    $and: [
      { $or: [{ scoreConcept: { $exists: false } }, { scoreConcept: 0 }] },
      { $or: [{ scoreQuiz: { $exists: false } }, { scoreQuiz: 0 }] },
      { $or: [{ scoreAttitude: { $exists: false } }, { scoreAttitude: 0 }] },
    ],
  };

  const matched = await NilaiOffline.countDocuments(filter);

  const sample = await NilaiOffline.find(filter)
    .limit(10)
    .populate("anakDidikId", "name")
    .select("anakDidikId week title scoreConcept scoreQuiz scoreAttitude semester createdAt")
    .lean();

  let deleted = 0;
  if (!dryRun && matched > 0) {
    const result = await NilaiOffline.deleteMany(filter);
    deleted = result.deletedCount || 0;
  }

  return NextResponse.json({
    matched,
    deleted,
    dryRun,
    sample: sample.map((s: { 
      _id: unknown; 
      anakDidikId?: unknown; 
      week?: number | null; 
      title?: string; 
      semester: string; 
      createdAt?: unknown 
    }) => ({
      _id: String(s._id),
      student:
        typeof s.anakDidikId === "object" && s.anakDidikId
          ? (s.anakDidikId && typeof s.anakDidikId === 'object' && 'name' in (s.anakDidikId as object) ? (s.anakDidikId as { name: string }).name : 'Unknown')
          : String(s.anakDidikId),
      week: s.week,
      title: s.title,
      semester: s.semester,
      createdAt: s.createdAt,
    })),
  });
}
