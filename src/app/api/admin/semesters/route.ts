import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import { Settings } from "@/models/Settings";
import { Schedule } from "@/models/Schedule";
import { Module } from "@/models/Module";
import { Report } from "@/models/Report";
import { getSessionUser } from "@/lib/session";

export async function GET() {
  try {
    const session = await getSessionUser();
    if (!session || session.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    
    // Get available semesters
    const semestersSetting = await Settings.findOne({ key: "availableSemesters" });
    const semesters = semestersSetting?.value || ["2025-1"];
    
    const activeSemSetting = await Settings.findOne({ key: "activeSemester" });
    const activeSemester = activeSemSetting?.value || "2025-1";

    const closedSemSetting = await Settings.findOne({ key: "closedSemesters" });
    const closedSemesters = closedSemSetting?.value || [];

    // Fetch stats for each semester
    const semesterData = await Promise.all(semesters.map(async (sem: string) => {
      const scheduleCount = await Schedule.countDocuments({ semester: sem });
      const reportCount = await Report.countDocuments({ semester: sem });
      const moduleCount = await Module.countDocuments({ semester: sem });
      
      const successRate = scheduleCount > 0 
        ? Math.min(Math.round((reportCount / scheduleCount) * 100), 100) 
        : 0;

      return {
        id: sem,
        name: sem,
        schedules: scheduleCount,
        reports: reportCount,
        modules: moduleCount,
        isActive: sem === activeSemester,
        isClosed: closedSemesters.includes(sem),
        successRate
      };
    }));

    return NextResponse.json({ semesters: semesterData });
  } catch (error) {
    console.error("Fetch Semesters Error:", error);
    return NextResponse.json({ error: "Gagal mengambil data semester" }, { status: 500 });
  }
}
