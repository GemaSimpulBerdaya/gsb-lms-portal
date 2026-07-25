import connectDB from "@/lib/mongodb";
import { Settings } from "@/models/Settings";
import { getCurrentSemester } from "@/utils/formatters";

export async function getActiveSemester(): Promise<string> {
  await connectDB();
  const setting = await Settings.findOne({ key: "activeSemester" }).lean();
  return typeof setting?.value === "string" && setting.value.trim()
    ? setting.value.trim()
    : getCurrentSemester();
}