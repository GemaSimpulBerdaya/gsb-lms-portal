import { Settings } from "@/models/Settings";
import { formatSemester } from "@/utils/formatters";

export async function getSemesterDisplayLabel(semester: string): Promise<string> {
  const doc = await Settings.findOne({ key: "semesterLabels" }).lean<{
    value?: Record<string, string>;
  }>();

  return formatSemester(semester, doc?.value);
}
