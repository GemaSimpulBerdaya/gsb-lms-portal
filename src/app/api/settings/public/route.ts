import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Settings } from "@/models/Settings";

/**
 * Public read-only endpoint untuk settings yang dipakai di FE umum
 * (filter semester, label, dll). Tanpa auth supaya komponen shared
 * gak butuh session khusus.
 *
 * Hanya expose subset yang benar-benar safe-public:
 * - activeSemester
 * - availableSemesters
 * - semesterLabels (custom label per kode semester)
 *
 * SETTINGS LAIN (faseConfig, reportRubric, dll) tetap di /api/admin/settings.
 */
export async function GET() {
  try {
    await connectDB();
    const docs = await Settings.find({
      key: { $in: ["activeSemester", "availableSemesters", "semesterLabels"] },
    }).lean();

    const out: Record<string, unknown> = {
      activeSemester: null,
      availableSemesters: [],
      semesterLabels: {},
    };

    for (const d of docs) {
      out[d.key] = d.value;
    }

    return NextResponse.json(out);
  } catch (err) {
    console.error("GET /api/settings/public error:", err);
    return NextResponse.json(
      { activeSemester: null, availableSemesters: [], semesterLabels: {} },
      { status: 200 }
    );
  }
}
