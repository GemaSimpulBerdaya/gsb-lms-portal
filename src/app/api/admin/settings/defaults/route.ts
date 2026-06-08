import { NextResponse } from "next/server";
import { withAdmin } from "@/lib/apiAuth";
import {
  DEFAULT_AVAILABLE_REGIONS,
  DEFAULT_AVAILABLE_SUBJECTS,
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
 * GET /api/admin/settings/defaults?key=availableRegions
 * GET /api/admin/settings/defaults?key=availableSubjects
 */
export const GET = withAdmin(async (request) => {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("key");

  switch (key) {
    case "faseConfig":
      return NextResponse.json({ key, value: DEFAULT_FASE_CONFIG });
    case "reportRubric":
      return NextResponse.json({ key, value: DEFAULT_REPORT_RUBRIC });
    case "availableRegions":
      return NextResponse.json({ key, value: DEFAULT_AVAILABLE_REGIONS });
    case "availableSubjects":
      return NextResponse.json({ key, value: DEFAULT_AVAILABLE_SUBJECTS });
    default:
      return NextResponse.json(
        {
          error:
            "Key tidak dikenal. Gunakan 'faseConfig', 'reportRubric', 'availableRegions', atau 'availableSubjects'.",
        },
        { status: 400 }
      );
  }
});
