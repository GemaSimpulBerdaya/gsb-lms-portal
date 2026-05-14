import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import {
  DEFAULT_FASE_CONFIG,
  DEFAULT_REPORT_RUBRIC,
} from "@/lib/reportDefaults";

/**
 * Mengembalikan nilai default seed untuk key tertentu.
 * Dipakai UI /admin/report-config untuk tombol "Reset ke Default" tanpa
 * harus duplikasi konstanta defaults di sisi client.
 *
 * GET /api/admin/settings/defaults?key=faseConfig
 * GET /api/admin/settings/defaults?key=reportRubric
 */
export async function GET(request: Request) {
  const session = await getSessionUser();
  if (!session || session.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  switch (key) {
    case "faseConfig":
      return NextResponse.json({ key, value: DEFAULT_FASE_CONFIG });
    case "reportRubric":
      return NextResponse.json({ key, value: DEFAULT_REPORT_RUBRIC });
    default:
      return NextResponse.json(
        { error: "Key tidak dikenal. Gunakan 'faseConfig' atau 'reportRubric'." },
        { status: 400 }
      );
  }
}
